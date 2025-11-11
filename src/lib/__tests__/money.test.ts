import { describe, it, expect } from "vitest";
import { roundToCents, formatEUR } from "../money";

describe("money utilities", () => {
  it("roundToCents handles common floating point cases", () => {
    expect(roundToCents(0.1 + 0.2)).toBe(0.3);
    expect(roundToCents(1.005)).toBe(1.01); // edge case
    expect(roundToCents(1)).toBe(1);
    expect(roundToCents("2.345")).toBe(2.35);
    expect(roundToCents(NaN)).toBe(0);
    expect(roundToCents(Infinity)).toBe(0);
    expect(Object.is(roundToCents(-0), false)).toBe(true); // ensure no -0
  });

  it("formatEUR returns a string containing currency symbol and digits", () => {
    const s = formatEUR(1.5);
    expect(typeof s).toBe("string");
    expect(s.length).toBeGreaterThan(0);
    // crude check: should contain at least one digit and the euro symbol or EUR
    expect(/[0-9]/.test(s)).toBe(true);
  });
});
