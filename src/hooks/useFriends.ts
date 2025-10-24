import { useCallback, useMemo } from "react";
import { computeBalances } from "../lib/compute";
import { useAppStore } from "../state/appStore";
import type { LegacyFriend } from "../types/legacySnapshot";

type CreateFriendOutcome =
  | { ok: true }
  | { ok: false; reason: "duplicate-email" };

type RemoveFriendOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" | "outstanding-balance" };

const DUPLICATE_EMAIL_MESSAGE = "A friend with this email already exists.";
const OUTSTANDING_BALANCE_MESSAGE =
  "Settle any outstanding balance with this friend before removing them.";

function normalizeEmail(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export interface UseFriendsResult {
  friends: LegacyFriend[];
  selectedId: string | null;
  selectedFriend: LegacyFriend | null;
  friendsById: Map<string, LegacyFriend>;
  balances: Map<string, number>;
  selectedBalance: number;
  createFriend: (friend: LegacyFriend) => CreateFriendOutcome;
  selectFriend: (friendId: string | null) => void;
  removeFriend: (friendId: string) => RemoveFriendOutcome;
}

export function useFriends(): UseFriendsResult {
  const friends = useAppStore((state) => state.friends);
  const transactions = useAppStore((state) => state.transactions);
  const selectedId = useAppStore((state) => state.selectedId);
  const addFriend = useAppStore((state) => state.addFriend);
  const setSelectedId = useAppStore((state) => state.setSelectedId);
  const removeFriendFromStore = useAppStore((state) => state.removeFriend);

  const normalizedEmails = useMemo(() => {
    const set = new Set<string>();
    for (const friend of friends) {
      set.add(normalizeEmail(friend.email));
    }
    return set;
  }, [friends]);

  const friendsById = useMemo(() => {
    const map = new Map<string, LegacyFriend>();
    for (const friend of friends) {
      map.set(friend.id, friend);
    }
    return map;
  }, [friends]);

  const balances = useMemo(
    () => computeBalances(transactions) as Map<string, number>,
    [transactions]
  );

  const selectedFriend = useMemo(
    () => (selectedId ? friendsById.get(selectedId) ?? null : null),
    [friendsById, selectedId]
  );

  const selectedBalance =
    selectedId && balances.has(selectedId) ? balances.get(selectedId)! : 0;

  const createFriend = useCallback<UseFriendsResult["createFriend"]>(
    (friend) => {
      const normalizedEmail = normalizeEmail(friend.email);
      if (normalizedEmails.has(normalizedEmail)) {
        alert(DUPLICATE_EMAIL_MESSAGE);
        return { ok: false, reason: "duplicate-email" };
      }
      addFriend(friend);
      return { ok: true };
    },
    [addFriend, normalizedEmails]
  );

  const selectFriend = useCallback<UseFriendsResult["selectFriend"]>(
    (friendId) => {
      setSelectedId(friendId);
    },
    [setSelectedId]
  );

  const removeFriend = useCallback<UseFriendsResult["removeFriend"]>(
    (friendId) => {
      if (!friendId || !friendsById.has(friendId)) {
        return { ok: false, reason: "not-found" };
      }
      const balance = balances.get(friendId) ?? 0;
      if (Math.abs(balance) > 0.0001) {
        alert(OUTSTANDING_BALANCE_MESSAGE);
        return { ok: false, reason: "outstanding-balance" };
      }

      removeFriendFromStore(friendId);
      return { ok: true };
    },
    [balances, friendsById, removeFriendFromStore]
  );

  return {
    friends,
    selectedId,
    selectedFriend,
    friendsById,
    balances,
    selectedBalance,
    createFriend,
    selectFriend,
    removeFriend,
  };
}
