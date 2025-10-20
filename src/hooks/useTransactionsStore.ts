import { useMemo, useSyncExternalStore } from "react";
import {
  getTransactionsState,
  subscribeToTransactionsStore,
  selectBudgetAggregates,
  selectBudgetTotals,
  selectBudgets,
  type BudgetAggregate,
  type BudgetTotals,
  type TransactionsState,
} from "../state/transactionsStore";

export function useTransactionsStoreState(): TransactionsState {
  return useSyncExternalStore(
    subscribeToTransactionsStore,
    getTransactionsState,
    getTransactionsState
  );
}

export function useBudgetAggregates(): BudgetAggregate[] {
  const snapshot = useTransactionsStoreState();
  return useMemo(() => {
    void snapshot.transactions.length;
    void Object.keys(snapshot.budgets).length;
    return selectBudgetAggregates();
  }, [snapshot]);
}

export function useBudgetTotals(): BudgetTotals {
  const snapshot = useTransactionsStoreState();
  return useMemo(() => {
    void snapshot.transactions.length;
    void Object.keys(snapshot.budgets).length;
    return selectBudgetTotals();
  }, [snapshot]);
}

export function useBudgets(): Record<string, number> {
  const snapshot = useTransactionsStoreState();
  return useMemo(() => {
    void Object.keys(snapshot.budgets).length;
    return selectBudgets();
  }, [snapshot]);
}
