import type {
  Action,
  Affiliate,
  Cadence,
  Condition,
  ManagerExecuteMsg,
  StrategyConfig,
} from "../calc";
import { Config, Environment } from "./fixtures";
import {
  isAction,
  isCondition,
  isSchedule,
  type ActionNode,
  type ConditionNode,
  type Node,
} from "./types";

type Config = {
  managerAddress: string;
  schedulerAddress: string;
};

export class StrategyBuilder {
  private source: string | null;
  private nodes: Node[] = [];
  private currentIndex: number | null = null;
  private previousConditionIndex: number | null = null;
  private label: string;
  private owner: string | null = null;
  private affiliates: Affiliate[] = [];

  constructor(label: string, source?: string | null) {
    this.label = label;
    this.source = source || null;
  }

  static from(strategy: StrategyConfig) {
    const builder = new StrategyBuilder("", null);

    builder.nodes = strategy.nodes.map((n) =>
      "action" in n ? n.action : n.condition
    );
    builder.owner = strategy.owner;

    return builder;
  }

  static create(label: string, source?: string) {
    return new StrategyBuilder(label, source);
  }

  every(cadence: Cadence): this {
    let condition = {
      schedule: {
        executors: [],
        execution_rebate: [],
        manager_address: "",
        scheduler_address: "",
        cadence,
      },
    };

    if (!isSchedule(condition)) {
      throw new Error(
        "when(...) requires a schedule condition (e.g., CONDITION.schedule({...}))"
      );
    }

    if (this.currentIndex !== null) {
      this.addEdge(this.currentIndex, this.addNode({ condition }));
    } else {
      this.addNode({ condition });
    }

    return this;
  }

  if(condition: Condition): this {
    if (!isCondition(condition)) {
      throw new Error("if(...) requires a condition object");
    }

    if (this.currentIndex !== null) {
      this.addEdge(this.currentIndex, this.addNode({ condition }));
    } else {
      this.addNode({ condition });
    }

    return this;
  }

  then(payload: Action | Condition): this {
    if (this.currentIndex === null) {
      throw new Error(
        "then(...) cannot be the first step. Call when(...) or if(...) first."
      );
    }

    const isActionNode = isAction(payload);
    const isConditionNode = isCondition(payload);

    if (!isActionNode && !isConditionNode) {
      throw new Error("then(...) requires an action or a condition");
    }

    this.addEdge(
      this.currentIndex,
      this.addNode(isActionNode ? { action: payload } : { condition: payload })
    );

    return this;
  }

  else(payload: Action | Condition): this {
    if (this.previousConditionIndex === null) {
      throw new Error(
        "else(...) must follow a condition added via when/if/then."
      );
    }

    const isActionNode = isAction(payload);
    const isConditionNode = isCondition(payload);

    if (!isActionNode && !isConditionNode) {
      throw new Error("then(...) requires an action or a condition");
    }

    this.addEdge(
      this.previousConditionIndex,
      this.addNode(isActionNode ? { action: payload } : { condition: payload }),
      true
    );

    return this;
  }

  update(index: number, payload: Action | Condition): this {
    const node = this.nodes[index];

    if (!node) {
      throw new Error(`update(${index}) failed: node does not exist`);
    }

    const stepIsAction = isAction(payload);
    const stepIsCondition = isCondition(payload);

    if (!stepIsAction && !stepIsCondition) {
      throw new Error("update(...) requires an Action or Condition payload");
    }

    if ("action" in node) {
      if (!stepIsAction) {
        throw new Error(
          `update(${index}) type mismatch: expected Action, received Condition`
        );
      }

      node.action = payload;
      return this;
    }

    if (!stepIsCondition) {
      throw new Error(
        `update(${index}) type mismatch: expected Condition, received Action`
      );
    }

    node.condition = payload;
    return this;
  }

  withOwner(owner: string): this {
    this.owner = owner;
    return this;
  }

  addNode(
    node: Pick<ActionNode, "action"> | Pick<ConditionNode, "condition">
  ): number {
    const index = this.nodes.length;
    this.nodes.push({ ...node, index });

    this.currentIndex = index;

    if ("condition" in node && isCondition(node.condition)) {
      this.previousConditionIndex = index;
    }

    return index;
  }

  addEdge(fromIndex: number, toIndex: number, isOnFailure: boolean = false) {
    const from = this.nodes[fromIndex];

    if (!from) {
      throw new Error(`Node ${fromIndex} does not exist.`);
    }

    if ("action" in from) {
      from.next = toIndex;
      return;
    }

    if (isOnFailure) {
      from.on_failure = toIndex;
    } else {
      from.on_success = toIndex;
    }
  }

  validate() {
    const size = this.nodes.length;
    if (size === 0) return;

    const adjacency_list: number[][] = Array.from({ length: size }, () => []);
    const in_degrees = new Array<number>(size).fill(0);

    const addEdgeChecked = (from: number, to?: number | null) => {
      if (to === undefined || to === null) return;

      if (to < 0 || to >= size) {
        throw new Error(`Invalid edge: ${from} -> ${to}`);
      }

      adjacency_list[from]!.push(to);
      in_degrees[to]!++;
    };

    this.nodes.forEach((n, i) => {
      if ("action" in n) {
        addEdgeChecked(i, n.next);
      } else {
        addEdgeChecked(i, n.on_success);
        addEdgeChecked(i, n.on_failure);
      }
    });

    const entries: number[] = [];

    for (let i = 0; i < size; i++) {
      if (in_degrees[i] === 0) entries.push(i);
    }

    if (entries.length === 0) {
      throw new Error(
        `Graph has no entry node (every node has an incoming edge) — likely a cycle. Graph: ${JSON.stringify(
          this.nodes,
          null,
          2
        )}`
      );
    }

    if (entries.length > 1) {
      throw new Error(
        `Graph must be a single connected component with exactly one entry node; found ${
          entries.length
        } entries at indices [${entries.join(", ")}]. Graph: ${JSON.stringify(
          this.nodes,
          null,
          2
        )}`
      );
    }

    const in_degree = in_degrees.slice();
    const q: number[] = [entries[0]!];
    let visited = 0;

    while (q.length) {
      const u = q.shift()!;
      visited++;

      for (const v of adjacency_list[u]!) {
        in_degree[v]!--;
        if (in_degree[v] === 0) q.push(v);
      }
    }

    if (visited !== size) {
      const remaining = in_degree
        .map((d, i) => ({ i, d }))
        .filter((x) => x.d > 0)
        .map((x) => x.i);

      throw new Error(
        `Graph contains a cycle or unreachable nodes from entry ${
          entries[0]
        }; unprocessed node indices: [${remaining.join(
          ", "
        )}]. Graph: ${JSON.stringify(this.nodes, null, 2)}`
      );
    }
  }

  build(config?: Config): Extract<ManagerExecuteMsg, { instantiate: any }> {
    this.validate();

    const { managerAddress, schedulerAddress } =
      config ?? Config[Environment.THORCHAIN_MAINNET];

    return {
      instantiate: {
        nodes: this.nodes.map((node, index) => {
          if ("action" in node) {
            return {
              action: { ...node, index },
            };
          } else {
            const condition = { ...node.condition };

            if ("schedule" in condition) {
              if (!condition.schedule.manager_address) {
                condition.schedule.manager_address = managerAddress;
              }

              if (!condition.schedule.scheduler_address) {
                condition.schedule.scheduler_address = schedulerAddress;
              }
            }

            return {
              condition: {
                ...node,
                condition,
                index,
              },
            };
          }
        }),
        label: this.label,
        owner: this.owner,
        source: this.source,
        affiliates: this.affiliates,
      },
    };
  }
}

export function strategy(label: string, source?: string) {
  return StrategyBuilder.create(label, source);
}
