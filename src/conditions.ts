import type {
  Addr,
  Condition,
  PriceSource,
  Schedule,
  Side,
  Swap,
  Timestamp,
} from "../calc";
import { toDecimal18 } from "./serde";

export const conditions = {
  schedule(payload: Pick<Schedule, "cadence"> & Partial<Schedule>): Condition {
    return {
      schedule: {
        executors: [],
        execution_rebate: [],
        manager_address: "",
        scheduler_address: "",
        ...payload,
      },
    };
  },

  canSwap(payload: Swap): Condition {
    return { can_swap: payload };
  },

  timestampElapsed(ts: Timestamp): Condition {
    return { timestamp_elapsed: ts };
  },

  blocksCompleted(n: number): Condition {
    return { blocks_completed: n };
  },

  balanceAvailable(amount: bigint, asset: string, address?: string): Condition {
    return {
      balance_available: {
        address,
        amount: {
          amount: amount.toString(),
          denom: asset,
        },
      },
    };
  },

  strategyStatus(input: {
    contract_address: Addr;
    manager_contract: Addr;
    status: "active" | "paused";
  }): Condition {
    return { strategy_status: input };
  },

  oraclePrice(input: {
    asset: string;
    direction: "above" | "below";
    price: string | number;
  }): Condition {
    return {
      oracle_price: {
        asset: input.asset,
        direction: input.direction,
        price: toDecimal18(input.price),
      },
    };
  },

  finLimitOrderFilled(input: {
    pair_address: Addr;
    side: Side;
    price: string | number;
    owner?: Addr | null;
  }): Condition {
    return {
      fin_limit_order_filled: {
        pair_address: input.pair_address,
        side: input.side,
        price: toDecimal18(input.price),
        owner: input.owner ?? null,
      },
    };
  },

  assetValueRatio(input: {
    numerator: string;
    denominator: string;
    oracle: PriceSource;
    ratio: string | number;
    tolerance: string | number;
  }): Condition {
    return {
      asset_value_ratio: {
        numerator: input.numerator,
        denominator: input.denominator,
        oracle: input.oracle,
        ratio: toDecimal18(input.ratio),
        tolerance: toDecimal18(input.tolerance),
      },
    };
  },
};
