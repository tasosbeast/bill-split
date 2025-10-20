import { describe, expect, it } from "vitest";
import { DEFAULT_MONTHLY_BUDGET, selectMonthlyBudget } from "../../lib/selectors";

describe("selectMonthlyBudget", () => {
  it("prefers the preferences monthly budget when valid", () => {
    const state = { preferences: { monthlyBudget: 750 } };
    expect(selectMonthlyBudget(state)).toBe(750);
  });

  it("coerces preference values provided as strings", () => {
    const state = { preferences: { monthlyBudget: "625" } };
    expect(selectMonthlyBudget(state)).toBe(625);
  });

  it("falls back to direct monthly budget when preference is invalid", () => {
    const state = {
      preferences: { monthlyBudget: -10 },
      monthlyBudget: 820,
    };
    expect(selectMonthlyBudget(state)).toBe(820);
  });

  it("coerces direct monthly budget strings when preference is invalid", () => {
    const state = {
      preferences: { monthlyBudget: null },
      monthlyBudget: "540",
    };
    expect(selectMonthlyBudget(state)).toBe(540);
  });

  it("returns the default budget when no valid value is provided", () => {
    const state = {
      preferences: { monthlyBudget: "abc" },
      monthlyBudget: 0,
    };
    expect(selectMonthlyBudget(state)).toBe(DEFAULT_MONTHLY_BUDGET);
  });
});
