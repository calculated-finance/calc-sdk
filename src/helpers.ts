import type { Coin, Decimal, Uint128 } from "../calc";
import { toDecimal18, toUint128 } from "./serde";

export function coin(amount: string | number | bigint, denom: string): Coin {
  return { denom, amount: toUint128(amount) };
}

export function decimal(value: string | number): Decimal {
  return toDecimal18(value);
}

export function uint128(value: string | number | bigint): Uint128 {
  return toUint128(value);
}
