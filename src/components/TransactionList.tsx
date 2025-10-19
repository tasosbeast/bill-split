import { useMemo } from "react";
import Transactions from "./Transactions";
import type { DateRange } from "./filters";
import {
  CategoryFilter,
  DateRangeFilter,
  useTransactionFilters,
} from "./filters";
import { CATEGORIES } from "../lib/categories";
import { CATEGORY_FILTER_ALL } from "../lib/transactionFilters";

export type TransactionListProps = {
  friend: any;
  friendsById: Map<string, any> | Record<string, any>;
  transactions: any[];
  onRequestEdit?: (tx: any) => void;
  onDelete?: (id: string) => void;
};

function ensureMap(source: Map<string, any> | Record<string, any> | undefined) {
  if (source instanceof Map) return source;
  const map = new Map<string, any>();
  if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source)) {
      map.set(key, value);
    }
  }
  return map;
}

export default function TransactionList({
  friend,
  friendsById,
  transactions,
  onRequestEdit,
  onDelete,
}: TransactionListProps) {
  const {
    filters,
    setCategory,
    setDateRange,
    resetFilters,
    applyFilters,
    hasActiveFilters,
  } = useTransactionFilters();

  const filteredTransactions = useMemo(
    () => applyFilters(transactions ?? []),
    [transactions, applyFilters],
  );

  const normalizedFriends = useMemo(() => ensureMap(friendsById), [friendsById]);

  if (!friend) {
    return null;
  }

  const selectedCategory = filters.category ?? CATEGORY_FILTER_ALL;
  const dateRange: DateRange = filters.dateRange;

  return (
    <div className="transaction-list">
      <div className="row justify-between align-center gap-12 flex-wrap">
        <h2 className="transaction-list__title">Transactions</h2>
        <div className="row gap-12 flex-wrap align-end">
          <CategoryFilter
            categories={CATEGORIES}
            value={selectedCategory}
            onChange={setCategory}
          />
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
          {hasActiveFilters && (
            <button className="btn-ghost" type="button" onClick={resetFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <Transactions
        friend={friend}
        friendsById={normalizedFriends}
        items={filteredTransactions}
        onRequestEdit={onRequestEdit}
        onDelete={onDelete}
      />
    </div>
  );
}
