import { describe, expect, it } from "vitest";
import {
  computeBudgetStatus,
  computeCategoryTotals,
  computeFriendBalances,
} from "../analytics";

function buildSplit({
  id,
  category = "Other",
  youShare,
  createdAt = "2024-05-05T12:00:00.000Z",
}) {
  return {
    id,
    type: "split",
    category,
    createdAt,
    participants: [
      { id: "you", amount: youShare },
      { id: "friend", amount: 10 },
    ],
    total: youShare + 10,
  };
}

describe("legacy analytics helpers", () => {
  describe("computeCategoryTotals", () => {
    it("aggregates personal spend per category and ignores non-split transactions", () => {
      const transactions = [
        buildSplit({ id: "tx-1", category: "Food", youShare: 12.5 }),
        buildSplit({
          id: "tx-2",
          category: " entertainment ",
          youShare: 7.499,
        }),
        buildSplit({ id: "tx-3", category: "", youShare: 3.249 }),
        buildSplit({ id: "tx-4", category: "Food", youShare: 0 }),
        {
          id: "tx-5",
          type: "settlement",
          friendId: "friend",
          delta: 25,
        },
        null,
      ];

      expect(computeCategoryTotals(transactions)).toEqual([
        { category: "Food", amount: 12.5 },
        { category: "entertainment", amount: 7.5 },
        { category: "Uncategorized", amount: 3.25 },
      ]);
    });
  });

  describe("computeBudgetStatus", () => {
    const transactions = [
      buildSplit({ id: "budget-1", youShare: 30 }),
      buildSplit({ id: "budget-2", youShare: 65 }),
      buildSplit({
        id: "budget-3",
        youShare: 42,
        createdAt: "2024-04-15T09:00:00.000Z",
      }),
      {
        ...buildSplit({ id: "budget-4", youShare: 15 }),
        createdAt: "invalid-date",
      },
    ];
    const today = new Date("2024-05-20T10:00:00.000Z");

    it("returns on-track status when utilization is below 90%", () => {
      const result = computeBudgetStatus(transactions, 500, today);
      expect(result).toEqual({
        budget: 500,
        spent: 95,
        remaining: 405,
        utilization: 0.19,
        status: "on-track",
      });
    });

    it("returns warning status when utilization is within 90-100%", () => {
      const result = computeBudgetStatus(transactions, 100, today);
      expect(result).toEqual({
        budget: 100,
        spent: 95,
        remaining: 5,
        utilization: 0.95,
        status: "warning",
      });
    });

    it("flags over-budget when spending exceeds the monthly limit", () => {
      const result = computeBudgetStatus(transactions, 80, today);
      expect(result).toEqual({
        budget: 80,
        spent: 95,
        remaining: 0,
        utilization: 1.1875,
        status: "over",
      });
    });
  });

  describe("computeFriendBalances", () => {
    it("aggregates balances per friend and sorts by absolute balance", () => {
      const transactions = [
        {
          id: "fb-1",
          type: "split",
          effects: [{ friendId: "alex", delta: 15.125, share: 15.125 }],
        },
        {
          id: "fb-2",
          type: "split",
          effects: [{ friendId: "alex", delta: -9.62, share: 9.62 }],
        },
        {
          id: "fb-3",
          type: "split",
          effects: [{ friendId: "sam", delta: -20, share: 20 }],
        },
        {
          id: "fb-4",
          type: "split",
          effects: [{ friendId: "skipped", delta: 0, share: 0 }],
        },
      ];

      expect(computeFriendBalances(transactions)).toEqual([
        { friendId: "sam", balance: -20 },
        { friendId: "alex", balance: 5.51 },
      ]);
    });
  });
});
