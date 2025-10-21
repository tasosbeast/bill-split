import type { Transaction } from "./transaction";
import type { TransactionTemplate } from "./transactionTemplate";

export interface LegacyFriend {
  id: string;
  name: string;
  email?: string;
  tag?: string;
}

export type StoredTransaction = Transaction & Record<string, unknown>;

export interface StoredSnapshotTemplate
  extends TransactionTemplate,
    Record<string, unknown> {}

export interface UISnapshot {
  friends: LegacyFriend[];
  selectedId: string | null;
  transactions: StoredTransaction[];
  templates: StoredSnapshotTemplate[];
}

export interface RestoreSnapshotResult extends UISnapshot {
  skippedTransactions: Array<{
    transaction: unknown;
    reason: string;
  }>;
}

export type { SettlementStatus, TransactionPaymentMetadata } from "./transaction";
