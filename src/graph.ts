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

export const Not = (node: ConditionNode): ConditionNode => {
  const newNode = new ConditionNode(node.condition);

  newNode.onSuccess = node.onFailure;
  newNode.onFailure = node.onSuccess;
  newNode.parent = node.parent;

  return newNode;
};

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
  const nodes = traverse(0, rootNode, config);

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
