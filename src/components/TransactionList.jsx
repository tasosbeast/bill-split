import { useMemo } from "react";
import Transactions from "./Transactions";
import {
  CategoryFilter,
  DateRangeFilter,
  useTransactionFilters,
} from "./filters";
import { CATEGORIES } from "../lib/categories";
import { CATEGORY_FILTER_ALL } from "../lib/transactionFilters";

function ensureMap(source) {
  if (source instanceof Map) return source;
  const map = new Map();
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
  items,
  onRequestEdit,
  onDelete,
}) {
  const {
    filters,
    setCategory,
    setDateRange,
    resetFilters,
    applyFilters,
    hasActiveFilters,
  } = useTransactionFilters();

  const sourceTransactions = useMemo(() => {
    if (Array.isArray(transactions)) return transactions;
    if (Array.isArray(items)) return items;
    return [];
  }, [items, transactions]);

  const filteredTransactions = useMemo(
    () => applyFilters(sourceTransactions),
    [sourceTransactions, applyFilters],
  );

  const normalizedFriends = useMemo(() => ensureMap(friendsById), [friendsById]);

  if (!friend) {
    return null;
  }

  const selectedCategory = filters.category ?? CATEGORY_FILTER_ALL;
  const dateRange = filters.dateRange;

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
