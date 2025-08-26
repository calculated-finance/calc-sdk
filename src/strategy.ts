import type { Action, Condition } from "../calc";
import { isAction, isCondition, isSchedule, type Node } from "./types";

type Strategy = {
  nodes: Node[];
  label: string;
  owner?: string;
  source?: string;
};

export class StrategyBuilder {
  private source?: string;
  private nodes: Node[] = [];
  private currentIndex: number | null = null;
  private previousConditionIndex: number | null = null;
  private label: string;
  private owner?: string;

  constructor(label: string, source?: string) {
    this.label = label;
    this.source = source;
  }

  static create(label: string, source?: string) {
    return new StrategyBuilder(label, source);
  }

  static from(strategy: Strategy) {
    const builder = new StrategyBuilder(strategy.label, strategy.source);

    builder.nodes = strategy.nodes;
    builder.owner = strategy.owner;

    return builder;
  }

  when(condition: Condition): this {
    if (!isSchedule(condition)) {
      throw new Error(
        "when(...) requires a schedule condition (e.g., CONDITION.schedule({...}))"
      );
    }

    if (this.currentIndex !== null) {
      this.addEdge(this.currentIndex, this.addNode(condition));
    } else {
      this.addNode(condition);
    }

    return this;
  }

  if(condition: Omit<Condition, "schedule">): this {
    if (!isCondition(condition)) {
      throw new Error("if(...) requires a condition object");
    }

    if (isSchedule(condition)) {
      throw new Error(
        "if(...) cannot be used with schedule; use when(...) instead"
      );
    }

    if (this.currentIndex !== null) {
      this.addEdge(this.currentIndex, this.addNode(condition));
    } else {
      this.addNode(condition);
    }

    return this;
  }

  then(step: Action | Condition): this {
    if (this.currentIndex === null) {
      throw new Error(
        "then(...) cannot be the first step. Call when(...) or if(...) first."
      );
    }

    if (!isAction(step) && !isCondition(step)) {
      throw new Error("then(...) requires an action or a condition");
    }

    this.addEdge(this.currentIndex, this.addNode(step));
    return this;
  }

  else(step: Action | Condition): this {
    if (this.previousConditionIndex === null) {
      throw new Error(
        "else(...) must follow a condition (when/if/then with a condition)."
      );
    }

    this.addEdge(this.previousConditionIndex, this.addNode(step), true);
    return this;
  }

  update(index: number, step: Action | Condition): this {
    const node = this.nodes[index];

    if (!node) {
      throw new Error(`update(${index}) failed: node does not exist`);
    }

    const stepIsAction = isAction(step);
    const stepIsCondition = isCondition(step);

    if (!stepIsAction && !stepIsCondition) {
      throw new Error("update(...) requires an Action or Condition payload");
    }

    if ("action" in node) {
      if (!stepIsAction) {
        throw new Error(
          `update(${index}) type mismatch: expected Action, received Condition`
        );
      }

      node.action = step;
      return this;
    }

    if (!stepIsCondition) {
      throw new Error(
        `update(${index}) type mismatch: expected Condition, received Action`
      );
    }

    node.condition = step;
    return this;
  }

  withOwner(owner: string): this {
    this.owner = owner;
    return this;
  }

  addNode(data: Action | Condition): number {
    const index = this.nodes.length;

    this.nodes.push(
      isAction(data) ? { index, action: data } : { index, condition: data }
    );

    this.currentIndex = index;

    if (isCondition(data)) {
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

    const addEdgeChecked = (from: number, to?: number) => {
      if (to === undefined) return;
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
        "Graph has no entry node (every node has an incoming edge) — likely a cycle."
      );
    }

    if (entries.length > 1) {
      throw new Error(
        `Graph must be a single connected component with exactly one entry node; found ${
          entries.length
        } entries at indices [${entries.join(", ")}].`
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
        }; unprocessed node indices: [${remaining.join(", ")}].`
      );
    }
  }

  build(): Strategy {
    this.validate();

    return {
      nodes: this.nodes.map((node, index) => ({ ...node, index })),
      label: this.label,
      owner: this.owner,
      source: this.source,
    };
  }
}

export function strategy(label: string) {
  return StrategyBuilder.create(label);
}
