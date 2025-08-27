import type { Action, Condition } from "../calc";

export type Index = number;

export type ActionNode = {
  index: Index;
  action: Action;
  next?: Index | null;
};

export type ConditionNode = {
  index: Index;
  condition: Condition;
  on_success?: Index | null;
  on_failure?: Index | null;
};

export type Node = ActionNode | ConditionNode;

export function isAction(x: any): x is Action {
  return (
    x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    ["swap", "limit_order", "distribute"].some((k) =>
      Object.prototype.hasOwnProperty.call(x, k)
    )
  );
}

export function isCondition(x: any): x is Condition {
  return (
    x &&
    typeof x === "object" &&
    !Array.isArray(x) &&
    [
      "schedule",
      "can_swap",
      "timestamp_elapsed",
      "blocks_completed",
      "balance_available",
      "strategy_status",
      "oracle_price",
      "fin_limit_order_filled",
      "asset_value_ratio",
    ].some((k) => Object.prototype.hasOwnProperty.call(x, k))
  );
}

export function isSchedule(x: any): boolean {
  return x && typeof x === "object" && !Array.isArray(x) && "schedule" in x;
}
