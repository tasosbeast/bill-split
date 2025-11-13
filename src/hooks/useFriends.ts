import { useCallback, useMemo } from "react";
import { computeBalances } from "../lib/compute";
import { useAppStore } from "../state/appStore";
import type { Friend } from "../types/legacySnapshot";

export interface FriendBalanceSummary {
  friend: Friend;
  balance: number;
  canRemove: boolean;
}

type CreateFriendOutcome =
  | { ok: true }
  | { ok: false; reason: "duplicate-email" };

type RemoveFriendOutcome =
  | { ok: true }
  | { ok: false; reason: "not-found" | "outstanding-balance" };

function normalizeEmail(value: string | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export interface UseFriendsResult {
  friends: Friend[];
  selectedId: string | null;
  selectedFriend: Friend | null;
  friendsById: Map<string, Friend>;
  balances: Map<string, number>;
  selectedBalance: number;
  createFriend: (friend: Friend) => CreateFriendOutcome;
  selectFriend: (friendId: string | null) => void;
  removeFriend: (friendId: string) => RemoveFriendOutcome;
  friendSummaries: FriendBalanceSummary[];
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

  const selectedBalance =
    selectedId && balances.has(selectedId) ? balances.get(selectedId)! : 0;

  const createFriend = useCallback<UseFriendsResult["createFriend"]>(
    (friend) => {
      const normalizedEmail = normalizeEmail(friend.email);
      if (normalizedEmails.has(normalizedEmail)) {
        return { ok: false, reason: "duplicate-email" };
      }
      const now = Date.now();
      addFriend({
        ...friend,
        active: friend.active ?? true,
        createdAt: friend.createdAt ?? now,
        avatarUrl:
          typeof friend.avatarUrl === "string" &&
          friend.avatarUrl.trim().length > 0
            ? friend.avatarUrl.trim()
            : friend.avatarUrl,
      });
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
        return { ok: false, reason: "outstanding-balance" };
      }

      removeFriendFromStore(friendId);
      return { ok: true };
    },
    [balances, friendsById, removeFriendFromStore]
  );

  const friendSummaries = useMemo<FriendBalanceSummary[]>(() => {
    return friends.map((friend) => {
      const balance = balances.get(friend.id) ?? 0;
      const canRemove = Math.abs(balance) < 0.0001;
      return { friend, balance, canRemove };
    });
  }, [balances, friends]);

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
    friendSummaries,
  };
}
