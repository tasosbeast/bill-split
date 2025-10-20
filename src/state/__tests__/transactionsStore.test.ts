import { describe, expect, beforeEach, it } from "vitest";
import {
  clearAllBudgets,
  selectBudgetAggregates,
  selectBudgetForCategory,
  selectBudgetTotals,
  selectBudgets,
  selectCategorySpendForMonth,
  selectPreviousMonthCategorySpend,
  setCategoryBudget,
  setTransactions,
  resetTransactionsStore,
} from "../transactionsStore";
import {
  createMemoryStorage,
  loadTransactionsState,
  setTransactionsPersistenceStorage,
  clearTransactionsStatePersistence,
  TRANSACTIONS_STATE_STORAGE_KEY,
  type PersistedTransactionsState,
} from "../persistence";

function sampleTransaction(
  id: string,
  category: string,
  yourShare: number,
  extras: Record<string, unknown> = {}
) {
  return {
    id,
    type: "split",
    category,
    total: yourShare * 2,
    participants: [
      { id: "you", amount: yourShare },
      { id: `friend-${id}`, amount: yourShare },
    ],
    ...extras,
  };
}

describe("transactionsStore budgets", () => {
  beforeEach(() => {
    const storage = createMemoryStorage();
    setTransactionsPersistenceStorage(storage);
    clearTransactionsStatePersistence();
    resetTransactionsStore({ hard: true });
  });

  it("sets, normalizes, and removes category budgets", () => {
    setCategoryBudget(" Food ", 120.456);
    setCategoryBudget("Entertainment", 0);
    expect(selectBudgets()).toEqual({
      Food: 120.46,
      Entertainment: 0,
    });

    expect(selectBudgetForCategory("Food")).toBe(120.46);
    expect(selectBudgetForCategory("food")).toBe(120.46);
    expect(selectBudgetForCategory("Unknown")).toBeNull();

    setCategoryBudget("Food", -5);
    expect(selectBudgetForCategory("Food")).toBeNull();
  });

  it("computes aggregates and totals for budgets and spending", () => {
    setTransactions([
      sampleTransaction("t1", "Food", 40),
      sampleTransaction("t2", "Food", 15.499),
      sampleTransaction("t3", "Drinks", 12),
      sampleTransaction("t4", "Travel", 20),
    ]);
    setCategoryBudget("Food", 100);
    setCategoryBudget("Drinks", 10);

    const aggregates = selectBudgetAggregates();
    expect(aggregates).toEqual([
      {
        category: "Drinks",
        budget: 10,
        spent: 12,
        remaining: -2,
        isOverBudget: true,
        utilization: 1.2,
      },
      {
        category: "Food",
        budget: 100,
        spent: 55.5,
        remaining: 44.5,
        isOverBudget: false,
        utilization: 0.555,
      },
      {
        category: "Travel",
        budget: null,
        spent: 20,
        remaining: null,
        isOverBudget: false,
        utilization: null,
      },
    ]);

    const totals = selectBudgetTotals();
    expect(totals).toEqual({
      totalBudgeted: 110,
      totalSpentAgainstBudget: 67.5,
      totalRemaining: 42.5,
      totalOverBudget: 2,
    });
  });

  it("persists budgets so they can be reloaded", () => {
    const storage = createMemoryStorage();
    setTransactionsPersistenceStorage(storage);
    clearTransactionsStatePersistence();
    resetTransactionsStore({ hard: true });

    setCategoryBudget("Food", 25);
    setCategoryBudget("Drinks", 15);

    const raw = storage.getItem(TRANSACTIONS_STATE_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as PersistedTransactionsState;
    expect(parsed.budgets).toEqual({ Food: 25, Drinks: 15 });

    resetTransactionsStore();
    expect(selectBudgets()).toEqual({ Food: 25, Drinks: 15 });

    const persisted = loadTransactionsState();
    expect(persisted?.budgets).toEqual({ Food: 25, Drinks: 15 });
  });

  it("clears all budgets at once", () => {
    setCategoryBudget("Food", 10);
    setCategoryBudget("Travel", 25);
    expect(selectBudgets()).toEqual({ Food: 10, Travel: 25 });
    clearAllBudgets();
    expect(selectBudgets()).toEqual({});
  });

  it("derives category spend per month and previous month snapshots", () => {
    const mayDate = new Date(Date.UTC(2024, 4, 10, 12)).toISOString();
    const juneDate = new Date(Date.UTC(2024, 5, 5, 9)).toISOString();
    const aprilDate = new Date(Date.UTC(2024, 3, 28, 15)).toISOString();

    setTransactions([
      sampleTransaction("t1", "Food", 20, { createdAt: mayDate }),
      sampleTransaction("t2", "Food", 30, { createdAt: juneDate }),
      sampleTransaction("t3", "Drinks", 15, { createdAt: mayDate }),
      sampleTransaction("t4", "Travel", 40, { createdAt: aprilDate }),
      sampleTransaction("t5", "Travel", 10, { createdAt: juneDate }),
    ]);

    expect(selectCategorySpendForMonth("2024-05")).toEqual({
      Food: 20,
      Drinks: 15,
    });

    expect(selectCategorySpendForMonth("2024-06")).toEqual({
      Food: 30,
      Travel: 10,
    });

    expect(
      selectPreviousMonthCategorySpend(new Date("2024-06-18T00:00:00Z"))
    ).toEqual({
      Food: 20,
      Drinks: 15,
    });

    expect(selectPreviousMonthCategorySpend(new Date("2024-01-01"))).toEqual({});
  });
});
