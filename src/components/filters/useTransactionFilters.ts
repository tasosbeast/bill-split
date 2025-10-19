import { useCallback, useMemo, useState } from "react";
import { CATEGORY_FILTER_ALL, filterTransactions } from "../../lib/transactionFilters";
import type { DateRange, TransactionFilters } from "./types";

type InitialState = Partial<TransactionFilters>;

const createEmptyRange = (): DateRange => ({ start: null, end: null });

export function useTransactionFilters(initialState: InitialState = {}) {
  const [category, setCategory] = useState<string>(
    initialState.category ?? CATEGORY_FILTER_ALL,
  );
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    ...createEmptyRange(),
    ...(initialState.dateRange ?? {}),
  }));

  const filters = useMemo<TransactionFilters>(
    () => ({ category, dateRange }),
    [category, dateRange],
  );

  const applyFilters = useCallback(
    <T,>(transactions: T[]) => filterTransactions(transactions as any[], filters) as T[],
    [filters],
  );

  const hasActiveFilters = useMemo(
    () => {
      if (category !== CATEGORY_FILTER_ALL) return true;
      if (dateRange.start) return true;
      if (dateRange.end) return true;
      return false;
    },
    [category, dateRange.end, dateRange.start],
  );

  const resetFilters = useCallback(() => {
    setCategory(CATEGORY_FILTER_ALL);
    setDateRange(createEmptyRange());
  }, []);

  return {
    filters,
    setCategory,
    setDateRange,
    applyFilters,
    resetFilters,
    hasActiveFilters,
  };
}
