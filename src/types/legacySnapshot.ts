import type { Transaction } from "./transaction";
import type { TransactionTemplate } from "./transactionTemplate";
import type { Friend } from "./domain";

export type { Friend };

export type StoredTransaction = Transaction & Record<string, unknown>;

export interface StoredSnapshotTemplate
  extends TransactionTemplate,
    Record<string, unknown> {}

export interface UISnapshot {
  friends: Friend[];
  selectedId: string | null;
  transactions: StoredTransaction[];
  templates: StoredSnapshotTemplate[];
  settlements?: StoredTransaction[];
}

export interface RestoreSnapshotResult extends UISnapshot {
  skippedTransactions: Array<{
    transaction: unknown;
    reason: string;
  }>;
}

export type { SettlementStatus, TransactionPaymentMetadata } from "./transaction";
