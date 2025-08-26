import type {
  Action,
  Addr,
  Distribution,
  FinLimitOrder,
  FinRoute,
  PriceStrategy,
  Side,
  Swap,
  ThorchainRoute,
} from "../calc";
import { toDecimal18 } from "./serde";

export const actions = {
  swap(
    payload: Pick<Swap, "swap_amount" | "minimum_receive_amount" | "routes"> &
      Partial<Swap>
  ): Action {
    return {
      swap: {
        maximum_slippage_bps: 200,
        adjustment: "fixed",
        ...payload,
      },
    };
  },

  limit_order(
    payload: Pick<
      FinLimitOrder,
      "bid_denom" | "pair_address" | "side" | "strategy"
    > &
      Partial<FinLimitOrder>
  ): Action {
    return {
      limit_order: payload,
    };
  },

  distribute(payload: Distribution): Action {
    return { distribute: payload };
  },
};

export const ROUTE = {
  fin(input: { pair_address: Addr }): { fin: FinRoute } {
    return { fin: { pair_address: input.pair_address } };
  },

  thorchain(input: Partial<ThorchainRoute> = {}): {
    thorchain: ThorchainRoute;
  } {
    return {
      thorchain: {
        affiliate_bps: input.affiliate_bps ?? null,
        affiliate_code: input.affiliate_code ?? null,
        latest_swap: input.latest_swap ?? null,
        max_streaming_quantity: input.max_streaming_quantity ?? null,
        streaming_interval: input.streaming_interval ?? null,
      },
    };
  },
};

export const PRICE = {
  fixed(v: string | number): PriceStrategy {
    return { fixed: toDecimal18(v) };
  },

  offset(input: {
    side: Side;
    direction: "above" | "below";
    offset: { exact?: string | number; percent?: number };
    tolerance?: { exact?: string | number; percent?: number } | null;
  }): PriceStrategy {
    const toOffset = (o: { exact?: string | number; percent?: number }) =>
      o.exact !== undefined
        ? { exact: toDecimal18(o.exact) }
        : { percent: o.percent ?? 0 };
    return {
      offset: {
        side: input.side,
        direction: input.direction,
        offset: toOffset(input.offset),
        tolerance: input.tolerance ? toOffset(input.tolerance) : null,
      },
    };
  },
};
