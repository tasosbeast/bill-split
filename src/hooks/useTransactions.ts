import { useCallback, useMemo } from "react";
import {
  getTransactionEffects,
  transactionIncludesFriend,
} from "../lib/transactions";
import { useAppStore } from "../state/appStore";
import type { StoredTransaction } from "../types/legacySnapshot";
import type { TransactionEffect } from "../types/transaction";

export interface FriendTransaction extends StoredTransaction {
  effect?: TransactionEffect | null;
}

export interface UseTransactionsResult {
  transactions: StoredTransaction[];
  filter: string;
  transactionsByFilter: FriendTransaction[];
  transactionsForSelectedFriend: FriendTransaction[];
  setFilter: (next: string) => void;
  clearFilter: () => void;
  addTransaction: (transaction: StoredTransaction) => void;
  updateTransaction: (transaction: StoredTransaction) => void;
  removeTransaction: (id: string) => void;
}

function computeEffect(
  transaction: StoredTransaction,
  friendId: string | null
): TransactionEffect | null {
  if (!friendId) return null;
  const effects = getTransactionEffects(transaction) as TransactionEffect[];
  return effects.find((entry) => entry.friendId === friendId) ?? null;
}

function matchesFilter(filter: string, transaction: StoredTransaction): boolean {
  if (filter === "All") return true;
  const category =
    typeof transaction.category === "string" ? transaction.category.trim() : null;
  return category === filter;
}

export function useTransactions(): UseTransactionsResult {
  const transactions = useAppStore((state) => state.transactions);
  const selectedFriendId = useAppStore((state) => state.selectedId);
  const filter = useAppStore((state) => state.filter);
  const setFilter = useAppStore((state) => state.setFilter);
  const clearFilter = useAppStore((state) => state.clearFilter);
  const setTransactions = useAppStore((state) => state.setTransactions);

  const transactionsByFilter = useMemo<FriendTransaction[]>(() => {
    return transactions
      .filter((transaction) => matchesFilter(filter, transaction))
      .map((transaction) => {
        const effect = computeEffect(transaction, selectedFriendId);
        return effect ? { ...transaction, effect } : transaction;
      });
  }, [transactions, filter, selectedFriendId]);

  const transactionsForSelectedFriend = useMemo<FriendTransaction[]>(() => {
    if (!selectedFriendId) return [];
    return transactions
      .filter((transaction) =>
        transactionIncludesFriend(transaction, selectedFriendId)
      )
      .filter((transaction) => matchesFilter(filter, transaction))
      .map((transaction) => {
        const effect = computeEffect(transaction, selectedFriendId);
        return effect ? { ...transaction, effect } : transaction;
      });
  }, [transactions, selectedFriendId, filter]);

  const addTransaction = useCallback<UseTransactionsResult["addTransaction"]>(
    (transaction) => {
      setTransactions((previous) => [transaction, ...previous]);
    },
    [setTransactions]
  );

  const updateTransaction = useCallback<
    UseTransactionsResult["updateTransaction"]
  >(
    (transaction) => {
      setTransactions((previous) => {
        const index = previous.findIndex((entry) => entry.id === transaction.id);
        if (index === -1) return previous;
        const next = [...previous];
        next[index] = transaction;
        return next;
      });
    },
    [setTransactions]
  );

  const removeTransaction = useCallback<
    UseTransactionsResult["removeTransaction"]
  >(
    (id) => {
      setTransactions((previous) => previous.filter((entry) => entry.id !== id));
    },
    [setTransactions]
  );

  return {
    transactions,
    filter,
    transactionsByFilter,
    transactionsForSelectedFriend,
    setFilter,
    clearFilter,
    addTransaction,
    updateTransaction,
    removeTransaction,
  };
}

