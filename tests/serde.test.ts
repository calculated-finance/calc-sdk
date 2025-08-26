import { describe, expect, test } from "bun:test";
import {
  isDecimal18String,
  isUint128String,
  toDecimal18,
  toUint128,
} from "../src/serde";

describe("serde: Uint128", () => {
  test("valid strings/numbers/bigints", () => {
    expect(isUint128String("0")).toBe(true);
    expect(toUint128("42")).toBe("42");
    expect(toUint128(42)).toBe("42");
    expect(toUint128(42n)).toBe("42");
  });

  test("reject leading zeros and negatives", () => {
    expect(isUint128String("01")).toBe(false);
    expect(() => toUint128(-1)).toThrow();
  });
});

describe("serde: Decimal(18)", () => {
  test("normalizes and caps to 18dp", () => {
    expect(isDecimal18String("1")).toBe(true);
    expect(toDecimal18("1")).toBe("1");
    expect(toDecimal18("1.23000")).toBe("1.23");
    expect(toDecimal18("0.123456789012345678")).toBe("0.123456789012345678");
    expect(isDecimal18String(toDecimal18(1.23))).toBe(true);
  });

  test("reject exponent and negative", () => {
    expect(() => toDecimal18("1e3")).toThrow();
    expect(() => toDecimal18("-0.1")).toThrow();
  });
});
