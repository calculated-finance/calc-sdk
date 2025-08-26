import type { Decimal, Uint128 } from "../calc";

const UINT128_MAX = "340282366920938463463374607431768211455";
const UINT128_MAX_LEN = UINT128_MAX.length;

function isAllDigits(s: string): boolean {
  return /^[0-9]+$/.test(s);
}

function cmpNumStr(a: string, b: string): number {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  return a === b ? 0 : a < b ? -1 : 1;
}

export function isUint128String(v: unknown): v is Uint128 {
  if (typeof v !== "string") return false;
  if (v === "0") return true;
  if (!isAllDigits(v)) return false;
  if (v.startsWith("0")) return false; // no leading zeros unless exactly "0"
  if (v.length > UINT128_MAX_LEN) return false;
  if (v.length === UINT128_MAX_LEN && cmpNumStr(v, UINT128_MAX) > 0)
    return false;
  return true;
}

export function toUint128(value: string | number | bigint): Uint128 {
  if (typeof value === "string") {
    const s = value.trim();
    if (!isUint128String(s))
      throw new Error(`Invalid Uint128 string: ${value}`);
    return s;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
      throw new Error(
        `Uint128 number must be a non-negative integer: ${value}`
      );
    }
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new Error(
        `Uint128 exceeds JS safe integer; pass a string or bigint instead: ${value}`
      );
    }
    return String(value);
  }
  if (typeof value === "bigint") {
    if (value < 0n) throw new Error(`Uint128 bigint must be non-negative`);
    const s = value.toString(10);
    if (!isUint128String(s)) throw new Error(`Uint128 bigint out of range`);
    return s as Uint128;
  }
  throw new Error(`Unsupported Uint128 input type`);
}

// Decimal(18dp). Non-negative, up to 18 fractional digits, no exponent.
const DECIMAL_18_RE = /^(?:0|[0-9]+)(?:\.[0-9]{1,18})?$/;

export function isDecimal18String(v: unknown): v is Decimal {
  return typeof v === "string" && DECIMAL_18_RE.test(v);
}

function stripLeadingZeros(intPart: string): string {
  return intPart.replace(/^0+(?=\d)/, "") || "0";
}

export function normalizeDecimal18(value: string): Decimal {
  if (value.includes("e") || value.includes("E")) {
    throw new Error(`Decimal cannot be in exponent form: ${value}`);
  }
  if (value.startsWith("-")) {
    throw new Error(`Decimal must be non-negative: ${value}`);
  }
  const [intRaw = "", fracRaw = ""] = value.split(".");
  const intPart = stripLeadingZeros(intRaw);
  let frac = fracRaw.slice(0, 18);
  frac = frac.replace(/0+$/, "");
  const out = frac.length ? `${intPart}.${frac}` : intPart;
  if (!isDecimal18String(out)) {
    throw new Error(`Invalid Decimal(18) format: ${value}`);
  }
  return out as Decimal;
}

export function toDecimal18(value: string | number): Decimal {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(
        `Decimal number must be finite and non-negative: ${value}`
      );
    }
    // Convert without scientific notation; then normalize
    return normalizeDecimal18(value.toFixed(18));
  }
  return normalizeDecimal18(value.trim());
}
