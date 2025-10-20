import { useCallback, useMemo } from "react";
import { computeBalances } from "../lib/compute";
import { transactionIncludesFriend } from "../lib/transactions";
import {
  useLegacySnapshot,
  type UseLegacySnapshotResult,
} from "./useLegacySnapshot";
import type { LegacyFriend, UISnapshot } from "../types/legacySnapshot";

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
  friends: LegacyFriend[];
  selectedId: string | null;
  selectedFriend: LegacyFriend | null;
  friendsById: Map<string, LegacyFriend>;
  balances: Map<string, number>;
  selectedBalance: number;
  createFriend: (friend: LegacyFriend) => CreateFriendOutcome;
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

  const createFriend = useCallback<UseFriendSelectionResult["createFriend"]>(
    (friend) => {
      const normalizedEmail = normalizeEmail(friend.email);
      if (normalizedEmails.has(normalizedEmail)) {
        alert(DUPLICATE_EMAIL_MESSAGE);
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

  const ensureSettle = useCallback<UseFriendSelectionResult["ensureSettle"]>(
    () => {
      if (!selectedId) {
        alert(NO_SELECTION_MESSAGE);
        return { allowed: false, reason: "no-selection" };
      }
      const balance = balances.get(selectedId) ?? 0;
      if (balance === 0) {
        alert(ZERO_BALANCE_MESSAGE);
        return { allowed: false, reason: "no-balance" };
      }
      return {
        allowed: true,
        friendId: selectedId,
        balance,
      };
    },
    [balances, selectedId]
  );

  const removeFriend = useCallback<UseFriendSelectionResult["removeFriend"]>(
    (friendId) => {
      if (!friendId || !friendsById.has(friendId)) {
        return { ok: false, reason: "not-found" };
      }
      const balance = balances.get(friendId) ?? 0;
      if (Math.abs(balance) > 0.0001) {
        alert(OUTSTANDING_BALANCE_MESSAGE);
        return { ok: false, reason: "outstanding-balance" };
      }

      setFriends((prev) => prev.filter((friend) => friend.id !== friendId));
      setTransactions((prev) =>
        prev.filter((transaction) => !transactionIncludesFriend(transaction, friendId))
      );
      if (selectedId === friendId) {
        setSelectedId(null);
      }

      return { ok: true };
    },
    [balances, friendsById, selectedId, setFriends, setSelectedId, setTransactions]
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
