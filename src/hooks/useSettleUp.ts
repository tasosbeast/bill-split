import { useCallback, useEffect, useMemo, useRef } from "react";
import { computeBalances } from "../lib/compute";
import {
  buildSettlementContext,
  deriveSettlementAmounts,
  extractSettlementDelta,
  extractSettlementFriendId,
  normalizeSettlementStatus,
} from "../lib/settlements";
import type { StoredTransaction } from "../types/legacySnapshot";
import type {
  SettlementStatus,
  TransactionPaymentMetadata,
} from "../types/transaction";
import { useAppStore } from "../state/appStore";

export interface LegacySettlementSummary {
  transactionId: string;
  status: SettlementStatus;
  balance: number;
  createdAt: string | null;
  payment: TransactionPaymentMetadata | null;
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

export type SettleGuardOutcome =
  | { allowed: true; friendId: string; balance: number }
  | { allowed: false; reason: "no-selection" | "no-balance" };

const NO_SELECTION_MESSAGE = "Select a friend before settling the balance.";
const ZERO_BALANCE_MESSAGE = "This friend is already settled.";

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

export interface UseSettleUpResult {
  settlementSummaries: Map<string, LegacySettlementSummary>;
  ensureSettle: () => SettleGuardOutcome;
  addSettlement: (draft: SettlementDraft) => void;
  confirmSettlement: (transactionId: string) => void;
  cancelSettlement: (transactionId: string) => void;
  reopenSettlement: (transactionId: string) => void;
}

export function useSettleUp(): UseSettleUpResult {
  const transactions = useAppStore((state) => state.transactions);
  const selectedFriendId = useAppStore((state) => state.selectedId);
  const setTransactions = useAppStore((state) => state.setTransactions);

  const balances = useMemo(() => computeBalances(transactions), [transactions]);

  const ensureSettle = useCallback<UseSettleUpResult["ensureSettle"]>(() => {
    if (!selectedFriendId) {
      alert(NO_SELECTION_MESSAGE);
      return { allowed: false, reason: "no-selection" };
    }
    const balance = balances.get(selectedFriendId) ?? 0;
    if (balance === 0) {
      alert(ZERO_BALANCE_MESSAGE);
      return { allowed: false, reason: "no-balance" };
    }
    return {
      allowed: true,
      friendId: selectedFriendId,
      balance,
    };
  }, [balances, selectedFriendId]);

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const settlementSummaries = useMemo(() => {
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
        safeTimestamp(summary.createdAt) >= safeTimestamp(existing.createdAt)
      ) {
        summaries.set(friendId, summary);
      }
    }
    return summaries;
  }, [transactions]);

  const addSettlement = useCallback<UseSettleUpResult["addSettlement"]>(
    (draft) => {
      const {
        friendId,
        balance,
        status,
        transactionId,
        payment,
        initiatedAt,
        confirmedAt,
        cancelledAt,
      } = draft;
      const trimmedFriendId =
        typeof friendId === "string" ? friendId.trim() : "";
      if (trimmedFriendId.length === 0) return;

      const now = new Date().toISOString();

      setTransactions((previous) => {
        const existingIndex = previous.findIndex(
          (entry) => entry.id === transactionId && entry.type === "settlement"
        );
        if (existingIndex >= 0) {
          const entry = previous[existingIndex];
          const normalizedStatus = normalizeSettlementStatus(
            status,
            entry.settlementStatus ?? "initiated"
          );
          const resolvedFriendId =
            extractSettlementFriendId(entry) ?? trimmedFriendId;
          const delta = balance ?? extractSettlementDelta(entry) ?? 0;
          const {
            delta: nextDelta,
            friendShare,
            youShare,
            share,
          } = deriveSettlementAmounts(delta, 0);
          const initialTimestamp =
            entry.settlementInitiatedAt ??
            entry.createdAt ??
            entry.updatedAt ??
            now;

          const statusChangedToConfirmed =
            normalizedStatus === "confirmed" &&
            entry.settlementStatus !== "confirmed";
          const statusChangedToCancelled =
            normalizedStatus === "cancelled" &&
            entry.settlementStatus !== "cancelled";
          const statusReopenedFromCancelled =
            entry.settlementStatus === "cancelled" &&
            normalizedStatus !== "cancelled";

          const nextParticipants = [
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

          const nextTransactions = [...previous];
          nextTransactions[existingIndex] = {
            ...entry,
            friendId: resolvedFriendId,
            friendIds: nextFriendIds,
            participants: nextParticipants,
            effects: [
              {
                friendId: resolvedFriendId,
                delta: nextDelta,
                share,
              },
            ],
            settlementStatus: normalizedStatus,
            settlementInitiatedAt:
              initiatedAt ?? entry.settlementInitiatedAt ?? initialTimestamp,
            settlementConfirmedAt: nextConfirmedAt,
            settlementCancelledAt: nextCancelledAt,
            payment: resolvedPayment,
            updatedAt: now,
          } as StoredTransaction;
          return nextTransactions;
        }

        if (typeof balance !== "number" || !Number.isFinite(balance)) {
          console.warn(
            "Attempted to create settlement without a valid balance."
          );
          return previous;
        }

        const normalizedStatus = status ?? "initiated";
        const { delta, friendShare, youShare, share } = deriveSettlementAmounts(
          balance,
          0
        );
        const createdAt = initiatedAt ?? now;
        const resolvedPayment = payment === undefined ? null : payment ?? null;

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
            normalizedStatus === "confirmed" ? confirmedAt ?? now : null,
          settlementCancelledAt:
            normalizedStatus === "cancelled" ? cancelledAt ?? now : null,
          payment: resolvedPayment,
        } as StoredTransaction;
        return [settlement, ...previous];
      });
    },
    [setTransactions]
  );

  const confirmSettlement = useCallback<UseSettleUpResult["confirmSettlement"]>(
    (transactionId) => {
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

  const cancelSettlement = useCallback<UseSettleUpResult["cancelSettlement"]>(
    (transactionId) => {
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

  const reopenSettlement = useCallback<UseSettleUpResult["reopenSettlement"]>(
    (transactionId) => {
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

  return {
    settlementSummaries,
    ensureSettle,
    addSettlement,
    confirmSettlement,
    cancelSettlement,
    reopenSettlement,
  };
}
