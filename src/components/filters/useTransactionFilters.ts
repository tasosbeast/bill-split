import { useCallback, useMemo, useState } from "react";
import {
  CATEGORY_FILTER_ALL,
  filterTransactions,
  type DateRange,
  type TransactionFilters,
} from "../../lib/transactionFilters";

const createEmptyRange = (): DateRange => ({ start: null, end: null });

export interface UseTransactionFiltersResult {
  filters: TransactionFilters;
  setCategory: (category: string) => void;
  setDateRange: (range: DateRange) => void;
  applyFilters: <
    T extends { category?: string | null; createdAt?: string | null }
  >(
    transactions?: T[]
  ) => T[];
  resetFilters: () => void;
  hasActiveFilters: boolean;
}

export function useTransactionFilters(
  initialState: Partial<TransactionFilters> = {}
): UseTransactionFiltersResult {
  const [category, setCategory] = useState(
    initialState.category ?? CATEGORY_FILTER_ALL
  );
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    ...createEmptyRange(),
    ...(initialState.dateRange ?? {}),
  }));

  const filters = useMemo<TransactionFilters>(
    () => ({ category, dateRange }),
    [category, dateRange]
  );

  const applyFilters = useCallback(
    <T extends { category?: string | null; createdAt?: string | null }>(
      transactions: T[] = []
    ) => {
      const source = Array.isArray(transactions) ? transactions : [];
      return filterTransactions(source, filters) as T[];
    },
    [filters]
  );

  const hasActiveFilters = useMemo(() => {
    if (category !== CATEGORY_FILTER_ALL) return true;
    if (dateRange.start) return true;
    if (dateRange.end) return true;
    return false;
  }, [category, dateRange.end, dateRange.start]);

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
