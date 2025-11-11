import { useMemo } from "react";
import Transactions from "./Transactions";
import {
  CategoryFilter,
  DateRangeFilter,
  useTransactionFilters,
} from "./filters";
import { CATEGORIES } from "../lib/categories";
import { CATEGORY_FILTER_ALL } from "../lib/transactionFilters";
import type { LegacyFriend, StoredTransaction } from "../types/legacySnapshot";

function ensureMap(
  source: Map<string, LegacyFriend> | Record<string, LegacyFriend> | undefined
): Map<string, LegacyFriend> {
  if (source instanceof Map) return source;
  const map = new Map<string, LegacyFriend>();
  if (source && typeof source === "object") {
    for (const [key, value] of Object.entries(source)) {
      map.set(key, value);
    }
  }
  return map;
}

interface TransactionListProps {
  friend: LegacyFriend | null;
  friendsById: Map<string, LegacyFriend> | Record<string, LegacyFriend>;
  transactions?: StoredTransaction[];
  items?: StoredTransaction[];
  onRequestEdit: (transaction: StoredTransaction) => void;
  onDelete: (transactionId: string) => void;
  onConfirmSettlement?: (transactionId: string) => void;
  onCancelSettlement?: (transactionId: string) => void;
  onReopenSettlement?: (transactionId: string) => void;
}

export default function TransactionList({
  friend,
  friendsById,
  transactions,
  items,
  onRequestEdit,
  onDelete,
  onConfirmSettlement,
  onCancelSettlement,
  onReopenSettlement,
}: TransactionListProps) {
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

  const filteredTransactions = useMemo(() => {
    const filtered = applyFilters(
      sourceTransactions as Parameters<typeof applyFilters>[0]
    );
    return filtered as StoredTransaction[];
  }, [sourceTransactions, applyFilters]);

  const normalizedFriends = useMemo(
    () => ensureMap(friendsById),
    [friendsById]
  );

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
        onConfirmSettlement={onConfirmSettlement ?? undefined}
        onCancelSettlement={onCancelSettlement ?? undefined}
        onReopenSettlement={onReopenSettlement ?? undefined}
      />
    </div>
  );
}
