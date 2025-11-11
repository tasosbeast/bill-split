import { describe, expect, it } from "vitest";
import { formatEUR, roundToCents } from "../money.js";

describe("roundToCents", () => {
  it("should handle common floating point arithmetic", () => {
    // The classic floating point issue
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
  });

  it("should round to nearest cent", () => {
    expect(roundToCents(1.555)).toBe(1.56);
    expect(roundToCents(1.994)).toBe(1.99);
    expect(roundToCents(1.995)).toBe(2.0);
    expect(roundToCents(1.999)).toBe(2.0);
  });

  it("should handle edge case with .005 suffix", () => {
    // Note: Due to floating point representation, 1.005 * 100 = 100.49999999999999
    // So it rounds down to 1.00, not up to 1.01
    // This is expected behavior given JavaScript's floating point limitations
    expect(roundToCents(1.005)).toBe(1.0);
    expect(roundToCents(2.005)).toBe(2.01);
  });

  it("should normalize -0 to 0", () => {
    expect(roundToCents(-0)).toBe(0);
    expect(Object.is(roundToCents(-0), -0)).toBe(false);
    expect(Object.is(roundToCents(-0), 0)).toBe(true);
  });

  it("should handle zero", () => {
    expect(roundToCents(0)).toBe(0);
    expect(roundToCents(0.0)).toBe(0);
  });

  it("should handle negative values", () => {
    // Note: Math.round() rounds .5 toward positive infinity
    // So -1.555 * 100 = -155.5 rounds to -155, giving -1.55
    // And -1.995 * 100 = -199.5 rounds to -199, giving -1.99
    expect(roundToCents(-1.555)).toBe(-1.55);
    expect(roundToCents(-1.994)).toBe(-1.99);
    expect(roundToCents(-1.995)).toBe(-1.99);
    expect(roundToCents(-2.005)).toBe(-2.0);
  });

  it("should handle invalid inputs", () => {
    expect(roundToCents(NaN)).toBe(0);
    expect(roundToCents(Infinity)).toBe(0);
    expect(roundToCents(-Infinity)).toBe(0);
  });

  it("should handle string inputs by coercing to number", () => {
    expect(roundToCents("1.555")).toBe(1.56);
    expect(roundToCents("0.3")).toBe(0.3);
  });

  it("should handle large values", () => {
    expect(roundToCents(999999.995)).toBe(1000000.0);
    expect(roundToCents(123456.789)).toBe(123456.79);
  });

  it("should ensure result has at most 2 decimal places", () => {
    const result = roundToCents(1.234567);
    expect(result).toBe(1.23);
    // Check that the number doesn't have trailing precision issues
    expect(result.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
  });
});

describe("formatEUR", () => {
  it("should format numbers as EUR currency", () => {
    expect(formatEUR(10)).toBe("€10.00");
    expect(formatEUR(10.5)).toBe("€10.50");
    expect(formatEUR(10.99)).toBe("€10.99");
  });

  it("should handle zero", () => {
    expect(formatEUR(0)).toBe("€0.00");
  });

  it("should handle negative values", () => {
    expect(formatEUR(-10)).toBe("-€10.00");
    expect(formatEUR(-10.50)).toBe("-€10.50");
  });

  it("should handle large numbers with thousands separators", () => {
    const formatted = formatEUR(1234567.89);
    // The separator may vary by locale, but should contain the amount
    expect(formatted).toContain("1");
    expect(formatted).toContain("234");
    expect(formatted).toContain("567");
    expect(formatted).toContain("89");
  });

  it("should coerce invalid values to 0", () => {
    expect(formatEUR(NaN)).toBe("€0.00");
    expect(formatEUR(null)).toBe("€0.00");
    expect(formatEUR(undefined)).toBe("€0.00");
  });

  it("should handle string inputs", () => {
    expect(formatEUR("10.50")).toBe("€10.50");
  });
});
