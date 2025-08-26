import { describe, expect, test } from "bun:test";
import type { Distribution, Schedule, Swap } from "../calc";
import { actions } from "../src/actions";
import { conditions } from "../src/conditions";
import { strategy, StrategyBuilder } from "../src/strategy";
import type { ActionNode, ConditionNode } from "../src/types";

function schedule(data?: Partial<Schedule>) {
  return conditions.schedule({
    cadence: { time: { duration: { secs: 3600, nanos: 0 }, previous: null } },
    execution_rebate: [],
    executors: [],
    jitter: null,
    manager_address: "mgr",
    next: null,
    scheduler_address: "sch",
    ...data,
  });
}

function swap(data?: Partial<Swap>) {
  return actions.swap({
    swap_amount: { amount: "1000", denom: "uatom" },
    minimum_receive_amount: { amount: "950", denom: "uusdc" },
    maximum_slippage_bps: 50,
    routes: [{ fin: { pair_address: "fin1" } }],
    adjustment: "fixed" as const,
    ...data,
  });
}

function distribute(data?: Partial<Distribution>) {
  return actions.distribute({
    denoms: ["uusdc"],
    destinations: [
      {
        recipient: { bank: { address: "addr1" } },
        shares: "1000",
        label: null,
      },
    ],
    ...data,
  });
}

const C = (
  index: number,
  condition: any,
  on_success?: number,
  on_failure?: number
) => ({ index, condition, on_success, on_failure } as const);

const A = (index: number, action: any, next?: number) =>
  ({ index, action, next } as const);

describe("StrategyBuilder", () => {
  test("valid linear: condition -> action -> action", () => {
    expect(() =>
      StrategyBuilder.from({
        label: "valid",
        nodes: [
          C(0, { schedule: {} }, 1),
          A(1, { swap: {} }, 2),
          A(2, { distribute: {} }),
        ],
      }).validate()
    ).not.toThrow();
  });

  test("cycle detected: condition -> action -> back to condition", () => {
    expect(() =>
      StrategyBuilder.from({
        label: "cycle",
        nodes: [C(0, { schedule: {} }, 1), A(1, { swap: {} }, 0)],
      }).validate()
    ).toThrow(/no entry node|cycle/i);
  });

  test("multiple entries rejected (disconnected component)", () => {
    expect(() =>
      StrategyBuilder.from({
        label: "multi-entries",
        nodes: [C(0, { schedule: {} }), A(1, { swap: {} })],
      }).validate()
    ).toThrow(/exactly one entry node/i);
  });

  test("unreachable nodes (disconnected cycle component) rejected", () => {
    expect(() =>
      StrategyBuilder.from({
        label: "unreachable",
        nodes: [
          C(0, { schedule: {} }, 1),
          A(1, { swap: {} }),
          C(2, { blocks_completed: 1 }, 3),
          A(3, { swap: {} }, 2),
        ],
      }).validate()
    ).toThrow(/cycle|unreachable/i);

    try {
      StrategyBuilder.from({
        label: "unreachable",
        nodes: [
          C(0, { schedule: {} }, 1),
          A(1, { swap: {} }),
          C(2, { blocks_completed: 1 }, 3),
          A(3, { swap: {} }, 2),
        ],
      }).validate();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      expect(msg).toMatch(/\b2\b/);
      expect(msg).toMatch(/\b3\b/);
    }
  });

  test("invalid edge indices are rejected", () => {
    expect(() =>
      StrategyBuilder.from({
        label: "invalid-edge",
        nodes: [C(0, { schedule: {} }, 99)],
      }).validate()
    ).toThrow(/invalid edge/i);
  });

  test("when -> then(action) -> then(action)", () => {
    const s = strategy("DCA")
      .when(schedule())
      .then(swap())
      .then(distribute())
      .build();

    expect(s.nodes.length).toBe(3);

    const [c, a1, a2] = s.nodes as [ConditionNode, ActionNode, ActionNode];

    expect("condition" in c).toBe(true);
    expect("action" in a1).toBe(true);
    expect("action" in a2).toBe(true);
    expect(c.on_success).toBe(1);
    expect(a1.next).toBe(2);
    expect(a2.next).toBeUndefined();
  });

  test("if -> then/else branches", () => {
    const s = strategy("Branch")
      .if(conditions.blocksCompleted(10))
      .then(distribute())
      .else(distribute())
      .build();

    const [cond, onSuccess, onFailure] = s.nodes as [
      ConditionNode,
      ActionNode,
      ActionNode
    ];

    expect(cond.on_success).toBe(1);
    expect(cond.on_failure).toBe(2);
    expect(onSuccess.next).toBeUndefined();
    expect(onFailure.next).toBeUndefined();
  });

  test("then without a prior condition throws", () => {
    expect(() => strategy("Invalid").then(distribute())).toThrow();
  });

  test("else without a prior condition throws", () => {
    expect(() => strategy("Invalid").else(distribute())).toThrow();
  });

  test("if rejects schedule condition", () => {
    expect(() => strategy("Invalid-if").if(schedule())).toThrow();
  });

  test("then requires action or condition shape", () => {
    expect(() =>
      strategy("Invalid-then")
        .when(schedule())
        .then({ not_a_valid_key: true } as any)
    ).toThrow();
  });
});
