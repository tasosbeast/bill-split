import type {
  SettlementStatus,
  Transaction,
  TransactionEffect,
} from "../types/transaction";
import type { StoredTransaction } from "../types/legacySnapshot";

export const SETTLEMENT_STATUSES: SettlementStatus[] = [
  "initiated",
  "pending",
  "confirmed",
  "cancelled",
];

export function normalizeSettlementStatus(
  value: unknown,
  fallback: SettlementStatus
): SettlementStatus {
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (lowered === "canceled") {
      return "cancelled";
    }
    if (
      SETTLEMENT_STATUSES.includes(lowered as SettlementStatus)
    ) {
      return lowered as SettlementStatus;
    }
  }
  if (
    typeof value === "string" &&
    SETTLEMENT_STATUSES.includes(value as SettlementStatus)
  ) {
    return value as SettlementStatus;
  }
  return fallback;
}

export function extractSettlementFriendId(
  transaction: Pick<
    StoredTransaction,
    "friendId" | "friendIds" | "effects"
  >,
  fallback?: string | null
): string | null {
  if (
    typeof transaction.friendId === "string" &&
    transaction.friendId.trim()
  ) {
    return transaction.friendId.trim();
  }
  if (Array.isArray(transaction.friendIds)) {
    const found = transaction.friendIds.find(
      (id): id is string =>
        typeof id === "string" && id.trim().length > 0
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

export function extractSettlementDelta(
  transaction: Pick<
    StoredTransaction,
    "effects" | "participants"
  >
): number {
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

export function deriveSettlementAmounts(
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

export function buildSettlementContext(
  transaction: Pick<
    StoredTransaction,
    "friendId" | "friendIds" | "effects" | "participants"
  >
): { friendId: string | null; balance: number } {
  const friendId = extractSettlementFriendId(transaction);
  const delta = extractSettlementDelta(transaction);
  const balance = -delta;
  return { friendId, balance };
}

export function isConfirmedSettlement(
  transaction: Transaction | StoredTransaction | null | undefined
): boolean {
  if (!transaction || typeof transaction !== "object") return true;
  if (transaction.type !== "settlement") return true;
  const status = typeof transaction.settlementStatus === "string"
    ? transaction.settlementStatus.trim().toLowerCase()
    : null;
  if (!status) return true;
  return status === "confirmed";
}
