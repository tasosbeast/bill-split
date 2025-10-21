import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const SETTLEMENT_STATUSES: SettlementStatus[] = [
  "initiated",
  "pending",
  "confirmed",
  "cancelled",
];

function isSettlementStatus(value: unknown): value is SettlementStatus {
  if (typeof value !== "string") return false;
  const lowered = value.trim().toLowerCase();
  return SETTLEMENT_STATUSES.some((status) => status === lowered);
}

function normalizeStatus(
  value: unknown,
  fallback: SettlementStatus
): SettlementStatus {
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "canceled") {
      return "cancelled";
    }
    if (isSettlementStatus(lowered)) {
      return lowered;
    }
  }
  if (isSettlementStatus(value)) {
    return value;
  }
  return fallback;
}

function extractSettlementFriendId(
  transaction: StoredTransaction,
  fallback?: string | null
): string | null {
  if (typeof transaction.friendId === "string" && transaction.friendId.trim()) {
    return transaction.friendId.trim();
  }
  if (Array.isArray(transaction.friendIds)) {
    const found = transaction.friendIds.find(
      (id): id is string => typeof id === "string" && id.trim().length > 0
    );
    if (found) {
      return found.trim();
    }
  }
  if (Array.isArray(transaction.effects)) {
    const effectFriend = transaction.effects.find(
      (effect) =>
        effect &&
        typeof effect.friendId === "string" &&
        effect.friendId.trim().length > 0
    );
    if (effectFriend) {
      return effectFriend.friendId.trim();
    }
  }
  if (typeof fallback === "string" && fallback.trim()) {
    return fallback.trim();
  }
  return null;
}

function extractSettlementDelta(transaction: StoredTransaction): number {
  if (Array.isArray(transaction.effects)) {
    const effect = transaction.effects.find(
      (entry) => entry && typeof entry.delta === "number"
    );
    if (effect && typeof effect.delta === "number") {
      return effect.delta;
    }
  }
  if (Array.isArray(transaction.participants)) {
    const you = transaction.participants.find((p) => p?.id === "you");
    const friend = transaction.participants.find(
      (p) => p && p.id !== "you" && typeof p.amount === "number"
    );
    if (you && friend && typeof friend.amount === "number") {
      return -friend.amount;
    }
    if (friend) {
      return -Math.max(friend.amount ?? 0, 0);
    }
  }
  return 0;
}

function deriveSettlementAmounts(
  balance: number | undefined,
  existingDelta: number
): {
  delta: number;
  friendShare: number;
  youShare: number;
  share: number;
} {
  const delta =
    typeof balance === "number" && Number.isFinite(balance)
      ? -balance
      : existingDelta;
  const resolvedBalance = -delta;
  const friendShare = Math.max(resolvedBalance, 0);
  const youShare = Math.max(-resolvedBalance, 0);
  const share = Math.abs(resolvedBalance);
  return { delta, friendShare, youShare, share };
}

function buildSettlementContext(
  transaction: StoredTransaction
): { friendId: string | null; balance: number } {
  const friendId = extractSettlementFriendId(
    transaction,
    typeof transaction.friendId === "string" ? transaction.friendId : null
  );
  const delta = extractSettlementDelta(transaction);
  const balance = -delta;
  return { friendId, balance };
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

            const previousStatus = normalizeStatus(
              entry.settlementStatus,
              "initiated"
            );
            const normalizedStatus = status
              ? normalizeStatus(status, previousStatus)
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
  };

  const handlers: LegacyTransactionsHandlers = {
    setFilter,
    clearFilter: () => setFilter("All"),
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
