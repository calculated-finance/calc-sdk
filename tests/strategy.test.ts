import { describe, expect, test } from "bun:test";
import { actions } from "../src/actions";
import { conditions } from "../src/conditions";
import { strategy, StrategyBuilder } from "../src/strategy";
import type { ActionNode, ConditionNode } from "../src/types";

const C = (
  index: number,
  condition: any,
  on_success?: number,
  on_failure?: number
) => ({ index, condition, on_success, on_failure } as const);

const A = (index: number, action: any, next?: number) =>
  ({ index, action, next } as const);

describe("StrategyBuilder", () => {
  process.env.CALC_MANAGER_ADDRESS = "mgr";
  process.env.CALC_SCHEDULER_ADDRESS = "sch";

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
      .when(conditions.schedule({ cadence: { blocks: { interval: 2131 } } }))
      .then(
        actions.swap({
          swap_amount: {
            amount: "2321123",
            denom: "rune",
          },
          minimum_receive_amount: {
            amount: "3278645",
            denom: "x/ruji",
          },
          routes: [{ fin: { pair_address: "thor...pair" } }],
        })
      )
      .then(
        actions.distribute({
          denoms: [],
          destinations: [],
        })
      )
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
      .then(actions.distribute({ denoms: [], destinations: [] }))
      .else(actions.distribute({ denoms: [], destinations: [] }))
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
    expect(() =>
      strategy("Invalid").then(
        actions.distribute({
          denoms: [],
          destinations: [],
        })
      )
    ).toThrow();
  });

  test("else without a prior condition throws", () => {
    expect(() =>
      strategy("Invalid").else(
        actions.distribute({
          denoms: [],
          destinations: [],
        })
      )
    ).toThrow();
  });

  test("if rejects schedule condition", () => {
    expect(() =>
      strategy("Invalid-if").if(
        conditions.schedule({
          cadence: { blocks: { interval: 2131 } },
        })
      )
    ).toThrow();
  });

  test("then requires action or condition shape", () => {
    expect(() =>
      strategy("Invalid-then")
        .when(
          conditions.schedule({
            cadence: { blocks: { interval: 2131 } },
          })
        )
        .then({ not_a_valid_key: true } as any)
    ).toThrow();
  });
});
