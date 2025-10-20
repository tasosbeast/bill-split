import { useCallback, useMemo, useState } from "react";
import {
  getTransactionEffects,
  transactionIncludesFriend,
} from "../lib/transactions";
import type { StoredTransaction } from "../types/legacySnapshot";
import type { TransactionEffect } from "../types/transaction";

export interface FriendTransaction extends StoredTransaction {
  effect?: TransactionEffect | null;
}

export interface LegacyTransactionsState {
  transactions: StoredTransaction[];
  filter: string;
  transactionsByFilter: FriendTransaction[];
  transactionsForSelectedFriend: FriendTransaction[];
}

export interface LegacyTransactionsHandlers {
  setFilter: (next: string) => void;
  clearFilter: () => void;
  addTransaction: (transaction: StoredTransaction) => void;
  updateTransaction: (transaction: StoredTransaction) => void;
  removeTransaction: (id: string) => void;
  addSettlement: (friendId: string, balance: number) => void;
}

interface UseLegacyTransactionsParams {
  transactions: StoredTransaction[];
  selectedFriendId: string | null;
  setTransactions: (
    updater:
      | StoredTransaction[]
      | ((previous: StoredTransaction[]) => StoredTransaction[])
  ) => void;
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

export function useLegacyTransactions({
  transactions,
  selectedFriendId,
  setTransactions,
}: UseLegacyTransactionsParams): {
  state: LegacyTransactionsState;
  handlers: LegacyTransactionsHandlers;
} {
  const [filter, setFilter] = useState<string>("All");

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

  const addTransaction = useCallback(
    (transaction: StoredTransaction) => {
      setTransactions((previous) => [transaction, ...previous]);
    },
    [setTransactions]
  );

  const updateTransaction = useCallback(
    (transaction: StoredTransaction) => {
      setTransactions((previous) =>
        previous.map((entry) => (entry.id === transaction.id ? transaction : entry))
      );
    },
    [setTransactions]
  );

  const removeTransaction = useCallback(
    (id: string) => {
      setTransactions((previous) =>
        previous.filter((transaction) => transaction.id !== id)
      );
    },
    [setTransactions]
  );

  const addSettlement = useCallback(
    (friendId: string, balance: number) => {
      const createdAt = new Date().toISOString();
      const settlement: StoredTransaction = {
        id: typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `tx-${Date.now()}`,
        type: "settlement",
        friendId,
        total: null,
        payer: null,
        participants: [
          { id: "you", amount: Math.max(-balance, 0) },
          { id: friendId, amount: Math.max(balance, 0) },
        ],
        effects: [
          {
            friendId,
            delta: -balance,
            share: Math.abs(balance),
          },
        ],
        friendIds: [friendId],
        createdAt,
      } as StoredTransaction;
      addTransaction(settlement);
    },
    [addTransaction]
  );

  const state: LegacyTransactionsState = {
    transactions,
    filter,
    transactionsByFilter,
    transactionsForSelectedFriend,
  };

  const handlers: LegacyTransactionsHandlers = {
    setFilter,
    clearFilter: () => setFilter("All"),
    addTransaction,
    updateTransaction,
    removeTransaction,
    addSettlement,
  };

  return { state, handlers };
}
