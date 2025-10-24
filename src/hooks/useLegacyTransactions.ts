import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  getTransactionEffects,
  transactionIncludesFriend,
} from "../lib/transactions";
import {
  buildSettlementContext,
  deriveSettlementAmounts,
  extractSettlementDelta,
  extractSettlementFriendId,
  normalizeSettlementStatus,
} from "../lib/settlements";
import type { StoredTransaction } from "../types/legacySnapshot";
import { useAppStore } from "../state/appStore";
import type {
  SettlementStatus,
  TransactionEffect,
  TransactionPaymentMetadata,
} from "../types/transaction";

export interface FriendTransaction extends StoredTransaction {
  effect?: TransactionEffect | null;
}

export interface LegacySettlementSummary {
  transactionId: string;
  status: SettlementStatus;
  balance: number;
  createdAt: string | null;
  payment: TransactionPaymentMetadata | null;
}

export interface LegacyTransactionsState {
  transactions: StoredTransaction[];
  filter: string;
  transactionsByFilter: FriendTransaction[];
  transactionsForSelectedFriend: FriendTransaction[];
  settlementSummaries: Map<string, LegacySettlementSummary>;
}

export interface LegacyTransactionsHandlers {
  setFilter: (next: string) => void;
  clearFilter: () => void;
  addTransaction: (transaction: StoredTransaction) => void;
  updateTransaction: (transaction: StoredTransaction) => void;
  removeTransaction: (id: string) => void;
  addSettlement: (settlement: SettlementDraft) => void;
  confirmSettlement: (transactionId: string) => void;
  cancelSettlement: (transactionId: string) => void;
  reopenSettlement: (transactionId: string) => void;
}

export interface SettlementDraft {
  friendId: string;
  balance?: number;
  status?: SettlementStatus;
  transactionId?: string;
  payment?: TransactionPaymentMetadata | null;
  initiatedAt?: string | null;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
}

function safeTimestamp(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function isTransactionPaymentMetadata(
  value: unknown
): value is TransactionPaymentMetadata {
  return !!value && typeof value === "object";
}

function resolveSettlementTimestamp(
  transaction: StoredTransaction
): string | null {
  const updated =
    typeof transaction.updatedAt === "string" && transaction.updatedAt
      ? transaction.updatedAt
      : null;
  if (updated) return updated;
  const initiated =
    typeof transaction.settlementInitiatedAt === "string" &&
    transaction.settlementInitiatedAt
      ? transaction.settlementInitiatedAt
      : null;
  if (initiated) return initiated;
  const created =
    typeof transaction.createdAt === "string" && transaction.createdAt
      ? transaction.createdAt
      : null;
  return created;
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

export function useLegacyTransactions(): {
  state: LegacyTransactionsState;
  handlers: LegacyTransactionsHandlers;
} {
  const transactions = useAppStore((state) => state.transactions);
  const selectedFriendId = useAppStore((state) => state.selectedId);
  const filter = useAppStore((state) => state.filter);
  const setFilterAction = useAppStore((state) => state.setFilter);
  const clearFilterAction = useAppStore((state) => state.clearFilter);
  const setTransactions = useAppStore((state) => state.setTransactions);
  const transactionsRef = useRef(transactions);

  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

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

  const settlementSummaries = useMemo(
    () => {
      const summaries = new Map<string, LegacySettlementSummary>();
      for (const transaction of transactions) {
        if (!transaction || transaction.type !== "settlement") continue;
        const { friendId, balance } = buildSettlementContext(transaction);
        if (!friendId) continue;
        const summary: LegacySettlementSummary = {
          transactionId: transaction.id,
          status: normalizeSettlementStatus(
            transaction.settlementStatus,
            "confirmed"
          ),
          balance,
          createdAt: resolveSettlementTimestamp(transaction),
          payment: isTransactionPaymentMetadata(transaction.payment)
            ? transaction.payment
            : null,
        };
        const existing = summaries.get(friendId);
        if (!existing) {
          summaries.set(friendId, summary);
          continue;
        }
        if (
          safeTimestamp(summary.createdAt) >=
          safeTimestamp(existing.createdAt)
        ) {
          summaries.set(friendId, summary);
        }
      }
      return summaries;
    },
    [transactions]
  );

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
      status,
      transactionId,
      payment,
      initiatedAt,
      confirmedAt,
      cancelledAt,
    }: SettlementDraft) => {
      const now = new Date().toISOString();
      const trimmedFriendId = friendId.trim();

      setTransactions((previous) => {
        if (transactionId) {
          return previous.map((entry) => {
            if (entry.id !== transactionId) return entry;
            if (entry.type !== "settlement") return entry;

            const resolvedFriendId =
              extractSettlementFriendId(entry, trimmedFriendId) ??
              trimmedFriendId;
            if (!resolvedFriendId) {
              return entry;
            }

            const existingDelta = extractSettlementDelta(entry);
            const {
              delta,
              friendShare,
              youShare,
              share,
            } = deriveSettlementAmounts(balance, existingDelta);

            const previousStatus = normalizeSettlementStatus(
              entry.settlementStatus,
              "initiated"
            );
            const normalizedStatus = status
              ? normalizeSettlementStatus(status, previousStatus)
              : previousStatus;

            const initialTimestamp =
              entry.settlementInitiatedAt ??
              initiatedAt ??
              (typeof entry.createdAt === "string" && entry.createdAt
                ? entry.createdAt
                : now);

            const statusChangedToConfirmed =
              normalizedStatus === "confirmed" &&
              previousStatus !== "confirmed";
            const statusChangedToCancelled =
              normalizedStatus === "cancelled" &&
              previousStatus !== "cancelled";
            const statusReopenedFromCancelled =
              previousStatus === "cancelled" &&
              normalizedStatus !== "cancelled";

            const nextParticipants = Array.isArray(entry.participants)
              ? entry.participants.map((participant) => {
                  if (!participant || typeof participant !== "object") {
                    return participant;
                  }
                  if (participant.id === "you") {
                    return { ...participant, amount: youShare };
                  }
                  if (participant.id === resolvedFriendId) {
                    return { ...participant, amount: friendShare };
                  }
                  return participant;
                })
              : [
                  { id: "you", amount: youShare },
                  { id: resolvedFriendId, amount: friendShare },
                ];

            const nextFriendIds =
              Array.isArray(entry.friendIds) && entry.friendIds.length > 0
                ? Array.from(
                    new Set(
                      entry.friendIds
                        .concat(resolvedFriendId)
                        .filter(
                          (id): id is string =>
                            typeof id === "string" && id.trim().length > 0
                        )
                    )
                  )
                : [resolvedFriendId];

            const existingConfirmedAt =
              typeof entry.settlementConfirmedAt === "string" &&
              entry.settlementConfirmedAt
                ? entry.settlementConfirmedAt
                : null;
            const nextConfirmedAt =
              normalizedStatus === "confirmed"
                ? confirmedAt ??
                  existingConfirmedAt ??
                  (statusChangedToConfirmed ? now : initialTimestamp)
                : normalizedStatus === "cancelled" || statusReopenedFromCancelled
                ? null
                : existingConfirmedAt;

            const existingCancelledAt =
              typeof entry.settlementCancelledAt === "string" &&
              entry.settlementCancelledAt
                ? entry.settlementCancelledAt
                : null;
            const nextCancelledAt =
              normalizedStatus === "cancelled"
                ? cancelledAt ??
                  existingCancelledAt ??
                  (statusChangedToCancelled ? now : initialTimestamp)
                : normalizedStatus === "confirmed" || statusReopenedFromCancelled
                ? null
                : existingCancelledAt;

            const resolvedPayment =
              payment === undefined ? entry.payment ?? null : payment;

            return {
              ...entry,
              friendId: resolvedFriendId,
              friendIds: nextFriendIds,
              participants: nextParticipants,
              effects: [
                {
                  friendId: resolvedFriendId,
                  delta,
                  share,
                },
              ],
              settlementStatus: normalizedStatus,
              settlementInitiatedAt:
                initiatedAt ??
                entry.settlementInitiatedAt ??
                initialTimestamp,
              settlementConfirmedAt: nextConfirmedAt,
              settlementCancelledAt: nextCancelledAt,
              payment: resolvedPayment,
              updatedAt: now,
            } as StoredTransaction;
          });
        }

        if (typeof balance !== "number" || !Number.isFinite(balance)) {
          console.warn(
            "Attempted to create settlement without a valid balance."
          );
          return previous;
        }

        const normalizedStatus = status ?? "initiated";
        const {
          delta,
          friendShare,
          youShare,
          share,
        } = deriveSettlementAmounts(balance, 0);
        const createdAt = initiatedAt ?? now;
        const resolvedPayment =
          payment === undefined ? null : payment ?? null;

        const settlement: StoredTransaction = {
          id:
            typeof crypto?.randomUUID === "function"
              ? crypto.randomUUID()
              : `tx-${Date.now()}`,
          type: "settlement",
          friendId: trimmedFriendId,
          total: null,
          payer: null,
          participants: [
            { id: "you", amount: youShare },
            { id: trimmedFriendId, amount: friendShare },
          ],
          effects: [
            {
              friendId: trimmedFriendId,
              delta,
              share,
            },
          ],
          friendIds: [trimmedFriendId],
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
          payment: resolvedPayment,
        } as StoredTransaction;
        return [settlement, ...previous];
      });
    },
    [setTransactions]
  );

  const confirmSettlement = useCallback(
    (transactionId: string) => {
      const existing = transactionsRef.current.find(
        (entry) => entry.id === transactionId && entry.type === "settlement"
      );
      if (!existing) return;
      const { friendId, balance } = buildSettlementContext(existing);
      if (!friendId) return;
      addSettlement({
        transactionId,
        friendId,
        balance,
        status: "confirmed",
      });
    },
    [addSettlement]
  );

  const cancelSettlement = useCallback(
    (transactionId: string) => {
      const existing = transactionsRef.current.find(
        (entry) => entry.id === transactionId && entry.type === "settlement"
      );
      if (!existing) return;
      const { friendId, balance } = buildSettlementContext(existing);
      if (!friendId) return;
      addSettlement({
        transactionId,
        friendId,
        balance,
        status: "cancelled",
      });
    },
    [addSettlement]
  );

  const reopenSettlement = useCallback(
    (transactionId: string) => {
      const existing = transactionsRef.current.find(
        (entry) => entry.id === transactionId && entry.type === "settlement"
      );
      if (!existing) return;
      const { friendId, balance } = buildSettlementContext(existing);
      if (!friendId) return;
      addSettlement({
        transactionId,
        friendId,
        balance,
        status: "initiated",
      });
    },
    [addSettlement]
  );

  const state: LegacyTransactionsState = {
    transactions,
    filter,
    transactionsByFilter,
    transactionsForSelectedFriend,
    settlementSummaries,
  };

  const handlers: LegacyTransactionsHandlers = {
    setFilter: setFilterAction,
    clearFilter: clearFilterAction,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addSettlement,
    confirmSettlement,
    cancelSettlement,
    reopenSettlement,
  };

  return { state, handlers };
}
