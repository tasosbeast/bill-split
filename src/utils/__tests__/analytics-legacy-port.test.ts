import { describe, expect, it } from "vitest";
import {
  AnalyticsOverview,
  CategoryBreakdown,
  CategoryTotal,
  MonthlyDataPoint,
  FriendBalance,
  BudgetStatus,
  computeAnalyticsOverview,
  computeCategoryBreakdown,
  computeCategoryTotals,
  computeMonthlyTrend,
  computeFriendBalances,
  computeMonthlyVolume,
  computeBudgetStatus,
} from "../analytics";
import { Transaction } from "../../types/transaction";

describe("Legacy Analytics Port - Phase 1", () => {
  const baseSplitTransaction: Transaction = {
    id: "tx-1",
    type: "split",
    total: 100,
    category: "Food",
    createdAt: "2024-03-15T12:00:00.000Z",
    payer: "you",
    participants: [
      { id: "you", amount: 50 },
      { id: "friend-1", amount: 50 },
    ],
    effects: [{ friendId: "friend-1", delta: 50, share: 50 }],
  };

  const baseSettlementTransaction: Transaction = {
    id: "settle-1",
    type: "settlement",
    total: null,
    friendId: "friend-1",
    createdAt: "2024-03-20T12:00:00.000Z",
    settlementStatus: "confirmed",
    effects: [{ friendId: "friend-1", delta: -50, share: 50 }],
  };

  describe("computeAnalyticsOverview", () => {
    it("returns zero values for empty array", () => {
      const result = computeAnalyticsOverview([]);
      expect(result).toEqual({
        count: 0,
        totalVolume: 0,
        owedToYou: 0,
        youOwe: 0,
        netBalance: 0,
        average: 0,
      });
    });

    it("calculates overview stats for split transactions", () => {
      const transactions: Transaction[] = [
        baseSplitTransaction,
        {
          ...baseSplitTransaction,
          id: "tx-2",
          total: 80,
          participants: [
            { id: "you", amount: 40 },
            { id: "friend-2", amount: 40 },
          ],
          effects: [{ friendId: "friend-2", delta: 40, share: 40 }],
        },
      ];

      const result = computeAnalyticsOverview(transactions);

      expect(result.count).toBe(2);
      expect(result.totalVolume).toBe(180);
      expect(result.owedToYou).toBe(90);
      expect(result.youOwe).toBe(0);
      expect(result.netBalance).toBe(90);
      expect(result.average).toBe(90);
    });

    it("handles confirmed settlements in balance calculation", () => {
      const transactions: Transaction[] = [
        baseSplitTransaction,
        baseSettlementTransaction,
      ];

      const result = computeAnalyticsOverview(transactions);

      expect(result.count).toBe(2);
      expect(result.totalVolume).toBe(150);
      expect(result.owedToYou).toBe(50);
      expect(result.youOwe).toBe(50);
      expect(result.netBalance).toBe(0);
    });

    it("ignores unconfirmed settlements in balance calculation", () => {
      const transactions: Transaction[] = [
        baseSplitTransaction,
        {
          ...baseSettlementTransaction,
          settlementStatus: "pending",
        },
      ];

      const result = computeAnalyticsOverview(transactions);

      expect(result.count).toBe(2);
      expect(result.owedToYou).toBe(50);
      expect(result.youOwe).toBe(0);
      expect(result.netBalance).toBe(50);
    });

    it("handles null and undefined transactions", () => {
      const transactions: Array<
        Transaction | null | undefined | Record<string, unknown>
      > = [baseSplitTransaction, null, undefined, {}];

      const result = computeAnalyticsOverview(transactions as Transaction[]);

      expect(result.count).toBe(2);
    });

    it("rounds values to cents correctly", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          total: 33.333,
          participants: [
            { id: "you", amount: 16.666 },
            { id: "friend-1", amount: 16.667 },
          ],
          effects: [{ friendId: "friend-1", delta: 16.667, share: 16.667 }],
        },
      ];

      const result = computeAnalyticsOverview(transactions);

      expect(result.totalVolume).toBe(33.33);
      expect(result.owedToYou).toBe(16.67);
    });
  });

  describe("computeCategoryBreakdown", () => {
    it("returns empty array for empty input", () => {
      const result = computeCategoryBreakdown([]);
      expect(result).toEqual([]);
    });

    it("aggregates by category with counts and percentages", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          category: "Food",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          category: "Food",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          category: "Travel",
          participants: [{ id: "you", amount: 50 }],
        },
      ];

      const result = computeCategoryBreakdown(transactions);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        category: "Food",
        count: 2,
        total: 150,
        percentage: 75,
      });
      expect(result[1]).toEqual({
        category: "Travel",
        count: 1,
        total: 50,
        percentage: 25,
      });
    });

    it("normalizes empty/whitespace categories to Uncategorized", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          category: "",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          category: "   ",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          category: null,
          participants: [{ id: "you", amount: 50 }],
        },
      ];

      const result = computeCategoryBreakdown(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("Uncategorized");
      expect(result[0].total).toBe(200);
    });

    it("only includes split transactions", () => {
      const transactions: Transaction[] = [
        baseSplitTransaction,
        {
          ...baseSettlementTransaction,
          type: "settlement",
        },
      ];

      const result = computeCategoryBreakdown(transactions);

      expect(result).toHaveLength(1);
      expect(result[0].category).toBe("Food");
    });

    it("sorts by total descending", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          category: "A",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          category: "B",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          category: "C",
          participants: [{ id: "you", amount: 75 }],
        },
      ];

      const result = computeCategoryBreakdown(transactions);

      expect(result[0].category).toBe("B");
      expect(result[1].category).toBe("C");
      expect(result[2].category).toBe("A");
    });

    it("calculates percentage with precision", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          participants: [{ id: "you", amount: 33.33 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          category: "Travel",
          participants: [{ id: "you", amount: 66.67 }],
        },
      ];

      const result = computeCategoryBreakdown(transactions);

      expect(result[0].percentage).toBe(66.7);
      expect(result[1].percentage).toBe(33.3);
    });
  });

  describe("computeCategoryTotals", () => {
    it("returns empty array for empty input", () => {
      const result = computeCategoryTotals([]);
      expect(result).toEqual([]);
    });

    it("aggregates amounts by category", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          category: "Food",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          category: "Food",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          category: "Travel",
          participants: [{ id: "you", amount: 80 }],
        },
      ];

      const result = computeCategoryTotals(transactions);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ category: "Food", amount: 150 });
      expect(result[1]).toEqual({ category: "Travel", amount: 80 });
    });

    it("only includes split transactions", () => {
      const transactions: Transaction[] = [
        baseSplitTransaction,
        {
          ...baseSettlementTransaction,
          type: "settlement",
        },
      ];

      const result = computeCategoryTotals(transactions);

      expect(result).toHaveLength(1);
    });

    it("ignores zero or negative personal shares", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          total: null,
          payer: null,
          participants: [{ id: "you", amount: 0 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          total: null,
          payer: "friend-1",
          participants: [
            { id: "you", amount: 0 },
            { id: "friend-1", amount: 100 },
          ],
        },
      ];

      const result = computeCategoryTotals(transactions);

      expect(result).toEqual([]);
    });

    it("sorts by amount descending", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          category: "A",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          category: "B",
          participants: [{ id: "you", amount: 100 }],
        },
      ];

      const result = computeCategoryTotals(transactions);

      expect(result[0].category).toBe("B");
      expect(result[1].category).toBe("A");
    });
  });

  describe("computeMonthlyTrend", () => {
    it("returns empty array for no transactions", () => {
      const result = computeMonthlyTrend([]);
      expect(result).toEqual([]);
    });

    it("groups transactions by month", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-01-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          createdAt: "2024-01-20T12:00:00.000Z",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          createdAt: "2024-02-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 75 }],
        },
      ];

      const result = computeMonthlyTrend(transactions, 6);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("2024-01");
      expect(result[0].amount).toBe(150);
      expect(result[1].key).toBe("2024-02");
      expect(result[1].amount).toBe(75);
    });

    it("returns only the last N months", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-01-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          createdAt: "2024-02-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          createdAt: "2024-03-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-4",
          createdAt: "2024-04-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
      ];

      const result = computeMonthlyTrend(transactions, 2);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("2024-03");
      expect(result[1].key).toBe("2024-04");
    });

    it("formats month labels correctly", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-03-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
      ];

      const result = computeMonthlyTrend(transactions, 6);

      expect(result[0].label).toBe("Mar");
    });

    it("handles transactions without timestamps", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: null,
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          createdAt: "2024-03-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 50 }],
        },
      ];

      const result = computeMonthlyTrend(transactions, 6);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("2024-03");
    });

    it("falls back to updatedAt if createdAt is missing", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: null,
          updatedAt: "2024-03-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
      ];

      const result = computeMonthlyTrend(transactions, 6);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("2024-03");
    });
  });

  describe("computeFriendBalances", () => {
    it("returns empty array for no transactions", () => {
      const result = computeFriendBalances([]);
      expect(result).toEqual([]);
    });

    it("calculates balances from transaction effects", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          effects: [{ friendId: "friend-1", delta: 50, share: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          effects: [{ friendId: "friend-1", delta: 30, share: 30 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          effects: [{ friendId: "friend-2", delta: -20, share: 20 }],
        },
      ];

      const result = computeFriendBalances(transactions);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ friendId: "friend-1", balance: 80 });
      expect(result[1]).toEqual({ friendId: "friend-2", balance: -20 });
    });

    it("respects confirmed settlements only", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          effects: [{ friendId: "friend-1", delta: 50, share: 50 }],
        },
        {
          ...baseSettlementTransaction,
          settlementStatus: "confirmed",
          effects: [{ friendId: "friend-1", delta: -50, share: 50 }],
        },
        {
          ...baseSettlementTransaction,
          id: "settle-2",
          settlementStatus: "pending",
          effects: [{ friendId: "friend-1", delta: -50, share: 50 }],
        },
      ];

      const result = computeFriendBalances(transactions);

      expect(result).toEqual([]);
    });

    it("filters out zero balances", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          effects: [{ friendId: "friend-1", delta: 50, share: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          effects: [{ friendId: "friend-1", delta: -50, share: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          effects: [{ friendId: "friend-2", delta: 30, share: 30 }],
        },
      ];

      const result = computeFriendBalances(transactions);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ friendId: "friend-2", balance: 30 });
    });

    it("sorts by absolute balance descending", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          effects: [{ friendId: "friend-1", delta: 10, share: 10 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          effects: [{ friendId: "friend-2", delta: -50, share: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          effects: [{ friendId: "friend-3", delta: 30, share: 30 }],
        },
      ];

      const result = computeFriendBalances(transactions);

      expect(result[0].friendId).toBe("friend-2");
      expect(result[1].friendId).toBe("friend-3");
      expect(result[2].friendId).toBe("friend-1");
    });
  });

  describe("computeMonthlyVolume", () => {
    it("returns empty array for no transactions", () => {
      const result = computeMonthlyVolume([]);
      expect(result).toEqual([]);
    });

    it("calculates volume over time", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          total: 100,
          createdAt: "2024-01-15T12:00:00.000Z",
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          total: 50,
          createdAt: "2024-02-15T12:00:00.000Z",
        },
      ];

      const result = computeMonthlyVolume(transactions, 2);

      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("2024-01");
      expect(result[0].amount).toBe(100);
      expect(result[1].key).toBe("2024-02");
      expect(result[1].amount).toBe(50);
    });

    it("fills zero-amount months if needed", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          total: 100,
          createdAt: "2024-01-15T12:00:00.000Z",
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          total: 50,
          createdAt: "2024-03-15T12:00:00.000Z",
        },
      ];

      const result = computeMonthlyVolume(transactions, 3);

      expect(result).toHaveLength(3);
      expect(result[0].key).toBe("2024-01");
      expect(result[0].amount).toBe(100);
      expect(result[1].key).toBe("2024-02");
      expect(result[1].amount).toBe(0);
      expect(result[2].key).toBe("2024-03");
      expect(result[2].amount).toBe(50);
    });

    it("returns empty array if no data in any month", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          total: 0,
          effects: [],
          participants: [],
          createdAt: "2024-01-15T12:00:00.000Z",
        },
      ];

      const result = computeMonthlyVolume(transactions, 6);

      expect(result).toEqual([]);
    });

    it("uses transaction volume from total or effects", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          total: null,
          createdAt: "2024-01-15T12:00:00.000Z",
          effects: [
            { friendId: "friend-1", delta: 50, share: 50 },
            { friendId: "friend-2", delta: 50, share: 50 },
          ],
        },
      ];

      const result = computeMonthlyVolume(transactions, 1);

      expect(result).toHaveLength(1);
      expect(result[0].amount).toBe(100);
    });

    it("handles invalid date strings", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          total: 100,
          createdAt: "invalid-date",
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          total: 50,
          createdAt: "2024-03-15T12:00:00.000Z",
        },
      ];

      const result = computeMonthlyVolume(transactions, 1);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("2024-03");
    });
  });

  describe("computeBudgetStatus", () => {
    const march2024 = new Date("2024-03-15T12:00:00.000Z");

    it("calculates budget status for current month", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          createdAt: "2024-03-15T12:00:00.000Z",
          participants: [{ id: "you", amount: 30 }],
        },
      ];

      const result = computeBudgetStatus(transactions, 100, march2024);

      expect(result.budget).toBe(100);
      expect(result.spent).toBe(80);
      expect(result.remaining).toBe(20);
      expect(result.utilization).toBe(0.8);
      expect(result.status).toBe("on-track");
    });

    it("returns on-track status when under 90% budget", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 80 }],
        },
      ];

      const result = computeBudgetStatus(transactions, 100, march2024);

      expect(result.status).toBe("on-track");
    });

    it("returns warning status when at or over 90% budget", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 90 }],
        },
      ];

      const result = computeBudgetStatus(transactions, 100, march2024);

      expect(result.status).toBe("warning");
    });

    it("returns over status when at or over 100% budget", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 110 }],
        },
      ];

      const result = computeBudgetStatus(transactions, 100, march2024);

      expect(result.status).toBe("over");
      expect(result.remaining).toBe(0);
    });

    it("only considers current month transactions", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-02-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-2",
          createdAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 50 }],
        },
        {
          ...baseSplitTransaction,
          id: "tx-3",
          createdAt: "2024-04-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 100 }],
        },
      ];

      const result = computeBudgetStatus(transactions, 100, march2024);

      expect(result.spent).toBe(50);
    });

    it("handles zero budget", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 50 }],
        },
      ];

      const result = computeBudgetStatus(transactions, 0, march2024);

      expect(result.budget).toBe(0);
      expect(result.spent).toBe(50);
      expect(result.remaining).toBe(0);
      expect(result.utilization).toBe(0);
      expect(result.status).toBe("on-track");
    });

    it("uses current date when today is invalid", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          participants: [{ id: "you", amount: 50 }],
        },
      ];

      const result = computeBudgetStatus(
        transactions,
        100,
        new Date("invalid")
      );

      // Should use current date without error
      expect(result.budget).toBe(100);
    });

    it("falls back to updatedAt if createdAt is missing", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: null,
          updatedAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 50 }],
        },
      ];

      const result = computeBudgetStatus(transactions, 100, march2024);

      expect(result.spent).toBe(50);
    });

    it("handles negative budget gracefully", () => {
      const transactions: Transaction[] = [
        {
          ...baseSplitTransaction,
          createdAt: "2024-03-10T12:00:00.000Z",
          participants: [{ id: "you", amount: 50 }],
        },
      ];

      const result = computeBudgetStatus(transactions, -100, march2024);

      expect(result.budget).toBe(0);
      expect(result.status).toBe("on-track");
    });
  });
});
