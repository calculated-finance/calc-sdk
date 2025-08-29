import { describe, expect, test } from "bun:test";
import { Node } from "../calc";
import { actions } from "../src/actions";
import { strategy, StrategyBuilder } from "../src/builder";
import { conditions } from "../src/conditions";
import { schedules } from "../src/schedules";

const C = (
  index: number,
  condition: any,
  on_success?: number,
  on_failure?: number
): Node => ({
  condition: { index, condition, on_success, on_failure },
});

const A = (index: number, action: any, next?: number): Node => ({
  action: { index, action, next },
});

describe("StrategyBuilder", () => {
  test("valid linear: condition -> action -> action", () => {
    expect(() =>
      StrategyBuilder.from({
        nodes: [
          C(0, { schedule: {} }, 1),
          A(1, { swap: {} }, 2),
          A(2, { distribute: {} }),
        ],
        manager: "manager",
        owner: "owner",
      }).validate()
    ).not.toThrow();
  });

  test("cycle detected: condition -> action -> back to condition", () => {
    expect(() =>
      StrategyBuilder.from({
        nodes: [C(0, { schedule: {} }, 1), A(1, { swap: {} }, 0)],
        manager: "manager",
        owner: "owner",
      }).validate()
    ).toThrow(/no entry node|cycle/i);
  });

  test("multiple entries rejected (disconnected component)", () => {
    expect(() =>
      StrategyBuilder.from({
        nodes: [C(0, { schedule: {} }), A(1, { swap: {} })],
        manager: "manager",
        owner: "owner",
      }).validate()
    ).toThrow(/exactly one entry node/i);
  });

  test("unreachable nodes (disconnected cycle component) rejected", () => {
    expect(() =>
      StrategyBuilder.from({
        nodes: [
          C(0, { schedule: {} }, 1),
          A(1, { swap: {} }),
          C(2, { blocks_completed: 1 }, 3),
          A(3, { swap: {} }, 2),
        ],
        manager: "manager",
        owner: "owner",
      }).validate()
    ).toThrow(/cycle|unreachable/i);

    try {
      StrategyBuilder.from({
        nodes: [
          C(0, { schedule: {} }, 1),
          A(1, { swap: {} }),
          C(2, { blocks_completed: 1 }, 3),
          A(3, { swap: {} }, 2),
        ],
        manager: "manager",
        owner: "owner",
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
        nodes: [C(0, { schedule: {} }, 99)],
        manager: "manager",
        owner: "owner",
      }).validate()
    ).toThrow(/invalid edge/i);
  });

  test("when -> then(action) -> then(action)", () => {
    const {
      instantiate: { nodes },
    } = strategy("DCA")
      .every(schedules.blocks(2131), [{ amount: "1", denom: "rune" }])
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

    expect(nodes.length).toBe(3);

    const [c, a1, a2] = nodes as [Node, Node, Node];

    expect("condition" in c && c.condition.on_success).toBe(1);
    expect("action" in a1 && a1.action.next).toBe(2);
    expect("action" in a2 && a2.action.next).toBeUndefined();
  });

  test("if -> then/else branches", () => {
    const s = strategy("Branch")
      .if(conditions.blocksCompleted(10))
      .then(actions.distribute({ denoms: [], destinations: [] }))
      .else(actions.distribute({ denoms: [], destinations: [] }))
      .build();

    const [cond, onSuccess, onFailure] = s.instantiate.nodes as [
      Node,
      Node,
      Node
    ];

    expect("condition" in cond && cond.condition.on_success).toBe(1);
    expect("condition" in cond && cond.condition.on_failure).toBe(2);
    expect("action" in onSuccess && onSuccess.action.next).toBeUndefined();
    expect("action" in onFailure && onFailure.action.next).toBeUndefined();
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

  test("then requires action or condition shape", () => {
    expect(() =>
      strategy("Invalid-then")
        .every(schedules.blocks(2131), [{ amount: "1", denom: "rune" }])
        .then({ not_a_valid_key: true } as any)
    ).toThrow();
  });
});
