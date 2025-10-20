import type { Transaction } from "./transaction";

export interface LegacyFriend {
  id: string;
  name: string;
  email?: string;
  tag?: string;
}

export type StoredTransaction = Transaction & Record<string, unknown>;

export interface UISnapshot {
  friends: LegacyFriend[];
  selectedId: string | null;
  transactions: StoredTransaction[];
}

export interface RestoreSnapshotResult extends UISnapshot {
  skippedTransactions: Array<{
    transaction: unknown;
    reason: string;
  }>;
}
