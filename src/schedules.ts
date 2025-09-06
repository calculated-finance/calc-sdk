import type { Condition, PriceStrategy, Schedule } from "../calc";

export const schedules = {
  blocks(interval: bigint, options?: Partial<Schedule>): Condition {
    return {
      schedule: {
        cadence: {
          blocks: { interval: Math.floor(Number(interval)), ...options },
        },
        execution_rebate: [],
        executors: [],
        manager_address: "",
        scheduler_address: "",
        ...(options || {}),
      },
    };
  },

  seconds(seconds: number, options?: Partial<Schedule>): Condition {
    return {
      schedule: {
        cadence: { time: { duration: { secs: seconds, nanos: 0 } } },
        execution_rebate: [],
        executors: [],
        manager_address: "",
        scheduler_address: "",
        ...(options || {}),
      },
    };
  },

  price(
    pairAddress: string,
    side: "base" | "quote",
    strategy: PriceStrategy,
    options?: Partial<Schedule>
  ): Condition {
    return {
      schedule: {
        cadence: {
          limit_order: {
            pair_address: pairAddress,
            side,
            strategy,
          },
        },
        execution_rebate: [],
        executors: [],
        manager_address: "",
        scheduler_address: "",
        ...(options || {}),
      },
    };
  },
};
