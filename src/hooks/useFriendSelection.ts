import { useCallback, useMemo } from "react";
import { computeBalances } from "../lib/compute";
import {
  transactionIncludesFriend,
  type TransactionLike,
} from "../lib/transactions";
import {
  useLegacySnapshot,
  type UseLegacySnapshotResult,
} from "./useLegacySnapshot";
import type { Friend, UISnapshot } from "../types/legacySnapshot";

type CreateFriendOutcome =
  | { ok: true }
  | { ok: false; reason: "duplicate-email" };

type SettleGuardOutcome =
  | { allowed: true; friendId: string; balance: number }
  | { allowed: false; reason: "no-selection" | "no-balance" };

type RemoveFriendOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" | "outstanding-balance" };

const DUPLICATE_EMAIL_MESSAGE = "A friend with this email already exists.";
const NO_SELECTION_MESSAGE = "Select a friend before settling the balance.";
const ZERO_BALANCE_MESSAGE = "This friend is already settled.";
const OUTSTANDING_BALANCE_MESSAGE =
  "Settle any outstanding balance with this friend before removing them.";

function normalizeEmail(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export interface UseFriendSelectionResult {
  snapshot: UISnapshot;
  friends: Friend[];
  selectedId: string | null;
  selectedFriend: Friend | null;
  friendsById: Map<string, Friend>;
  balances: Map<string, number>;
  selectedBalance: number;
  createFriend: (friend: Friend) => CreateFriendOutcome;
  selectFriend: (friendId: string | null) => void;
  ensureSettle: () => SettleGuardOutcome;
  removeFriend: (friendId: string) => RemoveFriendOutcome;
  updaters: UseLegacySnapshotResult["updaters"];
}

export function useFriendSelection(): UseFriendSelectionResult {
  const { snapshot, updaters } = useLegacySnapshot();
  const { friends, selectedId, transactions } = snapshot;
  const { setFriends, setSelectedId, setTransactions } = updaters;

  const normalizedEmails = useMemo(() => {
    const set = new Set<string>();
    for (const friend of friends) {
      set.add(normalizeEmail(friend.email));
    }
    return set;
  }, [friends]);

  const friendsById = useMemo(() => {
    const map = new Map<string, Friend>();
    for (const friend of friends) {
      map.set(friend.id, friend);
    }
    return map;
  }, [friends]);

  const balances = useMemo(() => computeBalances(transactions), [transactions]);

  const selectedFriend = useMemo(
    () => (selectedId ? friendsById.get(selectedId) ?? null : null),
    [friendsById, selectedId]
  );

  const selectedBalance = useMemo(() => {
    if (!selectedId) return 0;
    return balances.get(selectedId) ?? 0;
  }, [balances, selectedId]);

  const createFriend = useCallback<UseFriendSelectionResult["createFriend"]>(
    (friend) => {
      const normalizedEmail = normalizeEmail(friend.email);
      if (normalizedEmails.has(normalizedEmail)) {
        return { ok: false, reason: "duplicate-email" };
      }
      setFriends((prev) => [...prev, friend]);
      setSelectedId(friend.id);
      return { ok: true };
    },
    [normalizedEmails, setFriends, setSelectedId]
  );

  const selectFriend = useCallback<UseFriendSelectionResult["selectFriend"]>(
    (friendId) => {
      setSelectedId(friendId);
    },
    [setSelectedId]
  );

  const ensureSettle = useCallback<
    UseFriendSelectionResult["ensureSettle"]
  >(() => {
    if (!selectedId) {
      return { allowed: false, reason: "no-selection" };
    }
    const balance = balances.get(selectedId) ?? 0;
    if (balance === 0) {
      return { allowed: false, reason: "no-balance" };
    }
    return {
      allowed: true,
      friendId: selectedId,
      balance,
    };
  }, [balances, selectedId]);

  const removeFriend = useCallback<UseFriendSelectionResult["removeFriend"]>(
    (friendId) => {
      if (!friendId || !friendsById.has(friendId)) {
        return { ok: false, reason: "not-found" };
      }
      const balance = balances.get(friendId) ?? 0;
      if (Math.abs(balance) > 0.0001) {
        return { ok: false, reason: "outstanding-balance" };
      }

      setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
      setTransactions((prev) =>
        prev.filter((transaction) => {
          // Normalize legacy StoredTransaction to TransactionLike shape
          const normalizedEffects = Array.isArray(transaction.effects)
            ? transaction.effects
                .map((e) => {
                  if (!e || typeof e !== "object") return null;
                  const friendId =
                    typeof e.friendId === "string" ? e.friendId : "";
                  if (!friendId) return null;
                  return {
                    friendId,
                    delta: Number(e.delta) || 0,
                    share: Number(e.share) || 0,
                  };
                })
                .filter(
                  (
                    e
                  ): e is { friendId: string; delta: number; share: number } =>
                    e !== null
                )
            : undefined;
          const normalizedParticipants = Array.isArray(transaction.participants)
            ? transaction.participants
                .map((p) => {
                  if (!p || typeof p !== "object") return null;
                  const id = typeof p.id === "string" ? p.id : "";
                  if (!id) return null;
                  return { id, amount: Number(p.amount) || 0 };
                })
                .filter((p): p is { id: string; amount: number } => p !== null)
            : undefined;
          const normalized: TransactionLike = {
            id: transaction.id,
            type: transaction.type,
            total: transaction.total,
            payer: transaction.payer ?? null,
            participants: normalizedParticipants,
            effects: normalizedEffects,
            friendId: transaction.friendId ?? null,
            friendIds: Array.isArray(transaction.friendIds)
              ? transaction.friendIds.filter(
                  (id): id is string => typeof id === "string"
                )
              : null,
            category:
              typeof transaction.category === "string"
                ? transaction.category
                : undefined,
            note:
              typeof transaction.note === "string"
                ? transaction.note
                : undefined,
            createdAt:
              typeof transaction.createdAt === "string"
                ? transaction.createdAt
                : undefined,
            updatedAt:
              typeof transaction.updatedAt === "string" ||
              transaction.updatedAt === null
                ? transaction.updatedAt
                : undefined,
            templateId:
              typeof transaction.templateId === "string" ||
              transaction.templateId === null
                ? transaction.templateId
                : undefined,
            templateName:
              typeof transaction.templateName === "string" ||
              transaction.templateName === null
                ? transaction.templateName
                : undefined,
          };
          return !transactionIncludesFriend(normalized, friendId);
        })
      );
      if (selectedId === friendId) {
        setSelectedId(null);
      }

      return { ok: true };
    },
    [
      balances,
      friendsById,
      selectedId,
      setFriends,
      setSelectedId,
      setTransactions,
    ]
  );

  return {
    snapshot,
    updaters,
    friends,
    selectedId,
    selectedFriend,
    friendsById,
    balances,
    selectedBalance,
    createFriend,
    selectFriend,
    ensureSettle,
    removeFriend,
  };
}

export const FRIEND_SELECTION_MESSAGES = {
  duplicateEmail: DUPLICATE_EMAIL_MESSAGE,
  noSelection: NO_SELECTION_MESSAGE,
  zeroBalance: ZERO_BALANCE_MESSAGE,
  outstandingBalance: OUTSTANDING_BALANCE_MESSAGE,
} as const;
