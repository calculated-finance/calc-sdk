import type {
  Action,
  Affiliate,
  Condition,
  ManagerExecuteMsg,
  Node,
} from "../calc";

export class BaseNode {
  public parent?: BaseNode;

  constructor(parent?: BaseNode) {
    this.parent = parent;
  }

  withParent(parent: BaseNode): BaseNode {
    this.parent = parent;
    return this;
  }
}

export class ActionNode extends BaseNode {
  public action: Action;
  public next?: BaseNode;

  constructor(action: Action, parent?: BaseNode) {
    super(parent);
    this.action = action;
  }

  Then(next: BaseNode): ActionNode {
    this.next = next.withParent(this);
    return this;
  }
}

export class ConditionNode extends BaseNode {
  public condition: Condition;
  public onSuccess?: BaseNode;
  public onFailure?: BaseNode;

  constructor(condition: Condition, parent?: BaseNode) {
    super(parent);
    this.condition = condition;
  }

  Then(onSuccess: BaseNode): ConditionNode {
    this.onSuccess = onSuccess.withParent(this);
    return this;
  }

  Else(onFailure: BaseNode): ConditionNode {
    this.onFailure = onFailure.withParent(this);
    return this;
  }
}

export const If = (condition: Condition) => new ConditionNode(condition);

export const Every = (schedule: Condition, then: BaseNode) =>
  new ConditionNode(schedule).Then(then);

export const Do = (action: Action) => new ActionNode(action);

const traverse = (
  index: number,
  node: BaseNode,
  config: StrategyConfig
): Node[] => {
  if (node instanceof ActionNode) {
    if (!node.next) {
      return [
        {
          action: {
            action: node.action,
            index,
            next: null,
          },
        },
      ];
    }

    return [
      {
        action: {
          action: node.action,
          index,
          next: index + 1,
        },
      },
      ...traverse(index + 1, node.next, config),
    ];
  }

  if (node instanceof ConditionNode) {
    if ("schedule" in node.condition) {
      node.condition.schedule.manager_address = config.managerAddress;
      node.condition.schedule.scheduler_address = config.schedulerAddress;
    }

    const onSuccessBranch = node.onSuccess
      ? traverse(index + 1, node.onSuccess, config)
      : [];

    const onFailureBranch = node.onFailure
      ? traverse(index + 1 + onSuccessBranch.length, node.onFailure, config)
      : [];

    return [
      {
        condition: {
          index,
          condition: node.condition,
          on_success: node.onSuccess ? index + 1 : null,
          on_failure: node.onFailure
            ? index + 1 + onSuccessBranch.length
            : null,
        },
      },
      ...onSuccessBranch,
      ...onFailureBranch,
    ];
  }

  throw new Error("Unknown node type");
};

// const unique = (nodes: Node[]) => {
//   let workingNodes = [...nodes];

//   for (const node of nodes.reverse()) {
//     let duplicates = [];
//     let parents = [];

//     const nodeIsAction = "action" in node;

//     nodes.forEach((other, index) => {
//       const otherIsAction = "action" in other;

//       if (other === node || nodeIsAction !== otherIsAction) {
//         return;
//       }

//       if (nodeIsAction && otherIsAction && node.action !== other.action) {
//         return;
//       }

//       if (
//         !nodeIsAction &&
//         !otherIsAction &&
//         node.condition !== other.condition
//       ) {
//         return;
//       }

//       duplicates.push(index);
//     });
//   }
// };

const unique = (nodes: Node[]): Node[] => {
  if (nodes.length === 0) return nodes;

  const lastIndexByAction = new Map<any, number>();
  const lastIndexByCondition = new Map<any, number>();

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if ("action" in n) {
      lastIndexByAction.set(n.action.action, i);
    } else {
      lastIndexByCondition.set(n.condition.condition, i);
    }
  }

  const repOf: number[] = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    if ("action" in n) {
      repOf[i] = lastIndexByAction.get(n.action.action)!;
    } else {
      repOf[i] = lastIndexByCondition.get(n.condition.condition)!;
    }
  }

  const keptOldIndices = [];
  for (let i = 0; i < nodes.length; i++) {
    if (repOf[i] === i) keptOldIndices.push(i);
  }

  const newIndexOfOld: number[] = new Array(nodes.length).fill(-1);
  keptOldIndices.forEach((oldIdx, newIdx) => {
    newIndexOfOld[oldIdx] = newIdx;
  });

  const result: Node[] = keptOldIndices.map((oldIdx, newIdx) => {
    const n = nodes[oldIdx]!;

    if ("action" in n) {
      const oldNext = n.action.next;

      const replaceNext =
        oldNext === null || oldNext === undefined ? null : repOf[oldNext];

      const newNext =
        replaceNext === null || replaceNext === undefined
          ? null
          : newIndexOfOld[replaceNext];

      return {
        action: {
          action: n.action.action,
          index: newIdx,
          next: newNext,
        },
      };
    } else {
      const oldOnSuccess = n.condition.on_success;
      const oldOnFailure = n.condition.on_failure;

      const replaceOnSuccess =
        oldOnSuccess === null || oldOnSuccess === undefined
          ? null
          : repOf[oldOnSuccess];

      const replaceOnFailure =
        oldOnFailure === null || oldOnFailure === undefined
          ? null
          : repOf[oldOnFailure];

      const newOnSuccess =
        replaceOnSuccess === null || replaceOnSuccess === undefined
          ? null
          : newIndexOfOld[replaceOnSuccess];

      const newOnFailure =
        replaceOnFailure === null || replaceOnFailure === undefined
          ? null
          : newIndexOfOld[replaceOnFailure];

      return {
        condition: {
          index: newIdx,
          condition: n.condition.condition,
          on_success: newOnSuccess,
          on_failure: newOnFailure,
        },
      };
    }
  });

  return result;
};

export type StrategyConfig = {
  managerAddress: string;
  schedulerAddress: string;
  label: string;
  owner?: string;
  affiliates?: Affiliate[];
  source?: string;
};

export const Build = (
  rootNode: BaseNode,
  config: StrategyConfig
): Extract<ManagerExecuteMsg, { instantiate: any }> => {
  const nodes = unique(traverse(0, rootNode, config));

  return {
    instantiate: {
      label: config.label,
      owner: config.owner,
      affiliates: config.affiliates || [],
      nodes,
      source: config.source,
    },
  };
};
