import { useCallback, useMemo, useState } from "react";
import {
  getTransactionEffects,
  transactionIncludesFriend,
} from "../lib/transactions";
import type { StoredTransaction } from "../types/legacySnapshot";
import type {
  SettlementStatus,
  TransactionEffect,
  TransactionPaymentMetadata,
} from "../types/transaction";

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
  addSettlement: (settlement: SettlementDraft) => void;
}

export interface SettlementDraft {
  friendId: string;
  balance: number;
  status?: SettlementStatus;
  transactionId?: string;
  payment?: TransactionPaymentMetadata | null;
  initiatedAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
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
    ({
      friendId,
      balance,
      status = "initiated",
      transactionId,
      payment = null,
      initiatedAt,
      confirmedAt,
      cancelledAt,
    }: SettlementDraft) => {
      const now = new Date().toISOString();
      const normalizedStatus: SettlementStatus = status;
      const youShare = Math.max(-balance, 0);
      const friendShare = Math.max(balance, 0);
      const delta = -balance;

      setTransactions((previous) => {
        if (transactionId) {
          return previous.map((entry) => {
            if (entry.id !== transactionId) return entry;
            if (entry.type !== "settlement") return entry;

            const existingFriendId =
              typeof entry.friendId === "string" && entry.friendId
                ? entry.friendId
                : friendId;

            const initialTimestamp =
              entry.settlementInitiatedAt ??
              initiatedAt ??
              (typeof entry.createdAt === "string" && entry.createdAt
                ? entry.createdAt
                : now);
            const previousStatus =
              (typeof entry.settlementStatus === "string"
                ? entry.settlementStatus
                : null) ?? "initiated";
            const statusChangedToConfirmed =
              normalizedStatus === "confirmed" &&
              previousStatus !== "confirmed";
            const statusChangedToCancelled =
              normalizedStatus === "cancelled" &&
              previousStatus !== "cancelled";

            const nextParticipants = Array.isArray(entry.participants)
              ? entry.participants.map((participant) => {
                  if (!participant || typeof participant !== "object") {
                    return participant;
                  }
                  if (participant.id === "you") {
                    return { ...participant, amount: youShare };
                  }
                  if (participant.id === existingFriendId) {
                    return { ...participant, amount: friendShare };
                  }
                  return participant;
                })
              : [
                  { id: "you", amount: youShare },
                  { id: existingFriendId, amount: friendShare },
                ];

            return {
              ...entry,
              friendId: existingFriendId,
              friendIds:
                Array.isArray(entry.friendIds) && entry.friendIds.length > 0
                  ? entry.friendIds
                  : [existingFriendId],
              participants: nextParticipants,
              effects: [
                {
                  friendId: existingFriendId,
                  delta,
                  share: Math.abs(balance),
                },
              ],
              settlementStatus: normalizedStatus,
              settlementInitiatedAt: initiatedAt ?? initialTimestamp,
              settlementConfirmedAt:
                normalizedStatus === "confirmed"
                  ? confirmedAt ??
                    entry.settlementConfirmedAt ??
                    (statusChangedToConfirmed ? now : initialTimestamp)
                  : entry.settlementConfirmedAt ?? null,
              settlementCancelledAt:
                normalizedStatus === "cancelled"
                  ? cancelledAt ??
                    entry.settlementCancelledAt ??
                    (statusChangedToCancelled ? now : initialTimestamp)
                  : normalizedStatus === "confirmed"
                  ? null
                  : entry.settlementCancelledAt ?? null,
              payment: payment ?? entry.payment ?? null,
              updatedAt: now,
            } as StoredTransaction;
          });
        }

        const createdAt = initiatedAt ?? now;
        const settlement: StoredTransaction = {
          id:
            typeof crypto?.randomUUID === "function"
              ? crypto.randomUUID()
              : `tx-${Date.now()}`,
          type: "settlement",
          friendId,
          total: null,
          payer: null,
          participants: [
            { id: "you", amount: youShare },
            { id: friendId, amount: friendShare },
          ],
          effects: [
            {
              friendId,
              delta,
              share: Math.abs(balance),
            },
          ],
          friendIds: [friendId],
          createdAt,
          updatedAt: now,
          settlementStatus: normalizedStatus,
          settlementInitiatedAt: createdAt,
          settlementConfirmedAt:
            normalizedStatus === "confirmed"
              ? confirmedAt ?? now
              : null,
          settlementCancelledAt:
            normalizedStatus === "cancelled"
              ? cancelledAt ?? now
              : null,
          payment: payment ?? null,
        } as StoredTransaction;
        return [settlement, ...previous];
      });
    },
    [setTransactions]
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
