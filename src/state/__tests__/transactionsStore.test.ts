import { describe, expect, beforeEach, it } from "vitest";
import {
  selectBudgetAggregates,
  selectBudgetForCategory,
  selectBudgetTotals,
  selectBudgets,
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
});
