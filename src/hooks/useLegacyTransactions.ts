import type { StoredTransaction } from "../types/legacySnapshot";
import type { SettlementDraft } from "./useSettleUp";
import {
  type FriendTransaction,
  useTransactions,
} from "./useTransactions";
import { useSettleUp } from "./useSettleUp";

export interface LegacyTransactionsState {
  transactions: StoredTransaction[];
  filter: string;
  transactionsByFilter: FriendTransaction[];
  transactionsForSelectedFriend: FriendTransaction[];
  settlementSummaries: ReturnType<typeof useSettleUp>["settlementSummaries"];
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

export function useLegacyTransactions(): {
  state: LegacyTransactionsState;
  handlers: LegacyTransactionsHandlers;
} {
  const transactionsResult = useTransactions();
  const settleUp = useSettleUp();

  const state: LegacyTransactionsState = {
    transactions: transactionsResult.transactions,
    filter: transactionsResult.filter,
    transactionsByFilter: transactionsResult.transactionsByFilter,
    transactionsForSelectedFriend:
      transactionsResult.transactionsForSelectedFriend,
    settlementSummaries: settleUp.settlementSummaries,
  };

  const handlers: LegacyTransactionsHandlers = {
    setFilter: transactionsResult.setFilter,
    clearFilter: transactionsResult.clearFilter,
    addTransaction: transactionsResult.addTransaction,
    updateTransaction: transactionsResult.updateTransaction,
    removeTransaction: transactionsResult.removeTransaction,
    addSettlement: settleUp.addSettlement,
    confirmSettlement: settleUp.confirmSettlement,
    cancelSettlement: settleUp.cancelSettlement,
    reopenSettlement: settleUp.reopenSettlement,
  };

  return { state, handlers };
}

export type { FriendTransaction } from "./useTransactions";
export type { SettlementDraft, LegacySettlementSummary } from "./useSettleUp";
