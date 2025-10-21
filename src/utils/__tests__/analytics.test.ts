import { describe, expect, it } from "vitest";
import {
  BudgetComparisonEntry,
  compareBudgetByCategory,
  monthlySpendPerCategory,
  totalSpendPerCategory,
  __testOnlyGetTransactionAmount,
} from "../analytics";
import { Transaction } from "../../types/transaction";

describe("analytics utilities", () => {
  const baseTransaction: Transaction = {
    id: "tx-1",
    type: "split",
    total: 25,
    category: "Food",
    createdAt: "2024-03-15T12:00:00.000Z",
    participants: [
      { id: "you", amount: 10 },
      { id: "friend", amount: 15 },
    ],
    effects: [
      { friendId: "friend", delta: 5, share: 15 },
    ],
  };

  describe("totalSpendPerCategory", () => {
    it("returns an empty object for empty input", () => {
      expect(totalSpendPerCategory([])).toEqual({});
    });

    it("aggregates totals per category and normalizes blanks", () => {
      const transactions: Transaction[] = [
        baseTransaction,
        {
          ...baseTransaction,
          id: "tx-2",
          category: " food ",
          total: 5,
          createdAt: "2024-03-20T12:00:00.000Z",
        },
        {
          ...baseTransaction,
          id: "tx-3",
          category: "",
          total: 12.456,
          createdAt: "2024-03-25T12:00:00.000Z",
        },
        {
          ...baseTransaction,
          id: "tx-4",
          category: null,
          total: null,
          effects: [{ friendId: "friend", delta: -7.25, share: 7.25 }],
        },
      ];

      expect(totalSpendPerCategory(transactions)).toEqual({
        Food: 30,
        Uncategorized: 19.71,
      });
    });

    it("ignores transactions without a positive spend", () => {
      const transactions: Transaction[] = [
        { ...baseTransaction, id: "tx-5", total: -10 },
        { ...baseTransaction, id: "tx-6", total: NaN },
        { ...baseTransaction, id: "tx-7", total: null, effects: [] },
      ];

      expect(totalSpendPerCategory(transactions)).toEqual({});
    });
  });

  describe("monthlySpendPerCategory", () => {
    it("groups totals by year-month and category", () => {
      const transactions: Transaction[] = [
        baseTransaction,
        {
          ...baseTransaction,
          id: "tx-8",
          category: "Travel",
          total: 40,
          createdAt: "2024-03-01T08:30:00.000Z",
        },
        {
          ...baseTransaction,
          id: "tx-9",
          category: "Travel",
          total: 60,
          createdAt: "2024-04-02T10:00:00.000Z",
        },
        {
          ...baseTransaction,
          id: "tx-10",
          category: "",
          total: null,
          createdAt: "invalid-date",
          effects: [{ friendId: "friend", delta: -15, share: 15 }],
        },
      ];

      expect(monthlySpendPerCategory(transactions)).toEqual({
        "2024-03": {
          Food: 25,
          Travel: 40,
        },
        "2024-04": {
          Travel: 60,
        },
        unknown: {
          Uncategorized: 15,
        },
      });
    });
  });

  describe("compareBudgetByCategory", () => {
    it("combines categories from actuals and targets", () => {
      const actuals = {
        Food: 120.125,
        Travel: 80,
      };
      const targets = {
        Food: 150,
        Utilities: 60,
      };

      const result = compareBudgetByCategory(actuals, targets);

      const expected: Record<string, BudgetComparisonEntry> = {
        Food: { actual: 120.13, target: 150, remaining: 29.87 },
        Travel: { actual: 80, target: 0, remaining: -80 },
        Utilities: { actual: 0, target: 60, remaining: 60 },
      };

      expect(result).toEqual(expected);
    });
  });

  describe("__testOnlyGetTransactionAmount", () => {
    it("derives amount from effects when total is missing", () => {
      const transaction: Transaction = {
        ...baseTransaction,
        total: null,
        effects: [
          { friendId: "friend", delta: -10, share: 10 },
          { friendId: "friend-2", delta: -5.5, share: 5.5 },
        ],
      };

      expect(__testOnlyGetTransactionAmount(transaction)).toBe(15.5);
    });

    it("falls back to participants when effects are empty", () => {
      const transaction: Transaction = {
        ...baseTransaction,
        total: null,
        effects: [],
        participants: [
          { id: "you", amount: 7.333 },
          { id: "friend", amount: 2.667 },
        ],
      };

      expect(__testOnlyGetTransactionAmount(transaction)).toBe(10);
    });

    it("returns zero for settlements that are not confirmed", () => {
      const transaction: Transaction = {
        ...baseTransaction,
        id: "tx-11",
        type: "settlement",
        total: null,
        settlementStatus: "initiated",
        effects: [{ friendId: "friend", delta: -12, share: 12 }],
      };

      expect(__testOnlyGetTransactionAmount(transaction)).toBe(0);
    });
  });
});
