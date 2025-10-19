import { useCallback, useMemo, useState } from "react";
import {
  CATEGORY_FILTER_ALL,
  filterTransactions,
} from "../../lib/transactionFilters";

const createEmptyRange = () => ({ start: null, end: null });

export function useTransactionFilters(initialState = {}) {
  const [category, setCategory] = useState(
    initialState.category ?? CATEGORY_FILTER_ALL,
  );
  const [dateRange, setDateRange] = useState(() => ({
    ...createEmptyRange(),
    ...(initialState.dateRange ?? {}),
  }));

  const filters = useMemo(() => ({ category, dateRange }), [category, dateRange]);

  const applyFilters = useCallback(
    (transactions = []) => {
      const source = Array.isArray(transactions) ? transactions : [];
      return filterTransactions(source, filters);
    },
    [filters],
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
