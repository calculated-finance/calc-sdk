import type { Cadence } from "../calc";

export const schedules = {
  blocks(interval: number): Cadence {
    return { blocks: { interval } };
  },

  seconds(seconds: number): Cadence {
    return { time: { duration: { secs: seconds, nanos: 0 } } };
  },
};
