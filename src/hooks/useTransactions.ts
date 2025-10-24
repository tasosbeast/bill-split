import { useCallback, useMemo } from "react";
import {
  getTransactionEffects,
  transactionIncludesFriend,
} from "../lib/transactions";
import { useAppStore } from "../state/appStore";
import type { StoredTransaction } from "../types/legacySnapshot";
import type { TransactionEffect } from "../types/transaction";
import { buildSettlementContext, normalizeSettlementStatus } from "../lib/settlements";
import type {
  Transaction as DomainTransaction,
  Settlement as DomainSettlement,
  SettlementLinkType,
} from "../types/domain";

export interface FriendTransaction extends StoredTransaction {
  effect?: TransactionEffect | null;
}

export interface UseTransactionsResult {
  transactions: StoredTransaction[];
  filter: string;
  transactionsByFilter: FriendTransaction[];
  transactionsForSelectedFriend: FriendTransaction[];
  expenses: StoredTransaction[];
  settlementTransactions: StoredTransaction[];
  domainTransactions: DomainTransaction[];
  domainSettlements: DomainSettlement[];
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

  const [expenses, settlementTransactions] = useMemo(() => {
    const expenseList: StoredTransaction[] = [];
    const settlementList: StoredTransaction[] = [];
    for (const transaction of transactions) {
      if (transaction?.type === "settlement") {
        settlementList.push(transaction);
      } else {
        expenseList.push(transaction);
      }
    }
    return [expenseList, settlementList] as const;
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

  const domainTransactions = useMemo<DomainTransaction[]>(() => {
    return expenses.map((transaction) => toDomainTransaction(transaction));
  }, [expenses]);

  const domainSettlements = useMemo<DomainSettlement[]>(() => {
    return settlementTransactions
      .map((transaction) => toDomainSettlement(transaction))
      .filter((entry): entry is DomainSettlement => entry !== null);
  }, [settlementTransactions]);

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
    expenses,
    settlementTransactions,
    domainTransactions,
    domainSettlements,
    setFilter,
    clearFilter,
    addTransaction,
    updateTransaction,
    removeTransaction,
  };
}

function toDomainTransaction(transaction: StoredTransaction): DomainTransaction {
  const payerId =
    typeof transaction.payer === "string" && transaction.payer.trim().length > 0
      ? transaction.payer.trim()
      : "you";
  const participantIds = Array.isArray(transaction.participants)
    ? transaction.participants
        .map((participant) =>
          typeof participant?.id === "string" ? participant.id : null
        )
        .filter((id): id is string => !!id && id.length > 0)
    : [];
  if (!participantIds.includes(payerId)) {
    participantIds.push(payerId);
  }
  const amount =
    typeof transaction.total === "number" && Number.isFinite(transaction.total)
      ? transaction.total
      : 0;
  const createdAt =
    typeof transaction.createdAt === "number" && Number.isFinite(transaction.createdAt)
      ? transaction.createdAt
      : typeof transaction.createdAt === "string"
      ? safeTimestamp(transaction.createdAt, Date.now())
      : safeTimestamp(transaction.updatedAt, Date.now());
  const note =
    typeof transaction.note === "string" && transaction.note.trim().length > 0
      ? transaction.note
      : undefined;
  return {
    id: transaction.id,
    payerId,
    participantIds,
    amount,
    note,
    createdAt,
    status: transaction.type === "settlement" ? "settlement" : "final",
  };
}

function toDomainSettlement(transaction: StoredTransaction): DomainSettlement | null {
  if (transaction.type !== "settlement") return null;
  const { friendId, balance } = buildSettlementContext(transaction);
  const normalizedFriendId = friendId ?? "unknown";
  const normalizedBalance = typeof balance === "number" && Number.isFinite(balance) ? balance : 0;
  const amount = Math.abs(normalizedBalance);
  const statusRecord = normalizeSettlementStatus(
    transaction.settlementStatus,
    "initiated"
  );
  const status = statusRecord === "confirmed" ? "confirmed" : "initiated";
  const createdAt =
    typeof transaction.settlementInitiatedAt === "string"
      ? safeTimestamp(transaction.settlementInitiatedAt, Date.now())
      : typeof transaction.createdAt === "string"
      ? safeTimestamp(transaction.createdAt, Date.now())
      : Date.now();
  const fromId = normalizedBalance > 0 ? normalizedFriendId : "you";
  const toId = normalizedBalance > 0 ? "you" : normalizedFriendId;
  const payment = transaction.payment as Record<string, unknown> | null | undefined;
  const provider =
    payment && typeof payment.provider === "string"
      ? payment.provider.trim().toLowerCase()
      : undefined;
  const url =
    payment && typeof (payment as Record<string, unknown>).url === "string"
      ? ((payment as Record<string, unknown>).url as string).trim()
      : undefined;
  const link =
    provider && url && isSupportedSettlementProvider(provider)
      ? { type: provider, url }
      : undefined;
  return {
    id: transaction.id,
    fromId,
    toId,
    amount,
    status,
    createdAt,
    link,
  };
}

function isSupportedSettlementProvider(value: string): value is SettlementLinkType {
  return value === "revolut" || value === "paypal" || value === "bank";
}

function safeTimestamp(value: string | null | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}
