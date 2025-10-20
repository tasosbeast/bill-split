import { useCallback, useEffect, useMemo, useState } from "react";
import { loadState, saveState, clearState } from "../lib/storage";
import { upgradeTransactions } from "../lib/transactions";
import type {
  LegacyFriend,
  StoredTransaction,
  UISnapshot,
  StoredSnapshotTemplate,
} from "../types/legacySnapshot";

type SetStateAction<T> = T | ((prev: T) => T);

export interface LegacySnapshotUpdaters {
  setFriends: (action: SetStateAction<LegacyFriend[]>) => void;
  setSelectedId: (action: SetStateAction<string | null>) => void;
  setTransactions: (action: SetStateAction<StoredTransaction[]>) => void;
  setTemplates: (action: SetStateAction<StoredSnapshotTemplate[]>) => void;
  replaceSnapshot: (snapshot: UISnapshot) => void;
  reset: () => void;
}

export interface UseLegacySnapshotResult {
  snapshot: UISnapshot;
  updaters: LegacySnapshotUpdaters;
}

const SAMPLE_FRIENDS: LegacyFriend[] = [
  { id: crypto.randomUUID(), name: "Valia", email: "valia@example.com" },
  { id: crypto.randomUUID(), name: "Nikos", email: "nikos@example.com" },
];

function resolveAction<T>(action: SetStateAction<T>, prev: T): T {
  return typeof action === "function"
    ? (action as (value: T) => T)(prev)
    : action;
}

function ensureValidSelectedId(
  friends: LegacyFriend[],
  selectedId: string | null
): string | null {
  if (!selectedId) return null;
  return friends.some((friend) => friend.id === selectedId) ? selectedId : null;
}

function normalizeTransactions(
  input: StoredTransaction[] | undefined
): StoredTransaction[] {
  const source = Array.isArray(input) ? input : [];
  return upgradeTransactions(source) as StoredTransaction[];
}

function createDefaultSnapshot(): UISnapshot {
  return {
    friends: SAMPLE_FRIENDS.map((friend) => ({ ...friend })),
    selectedId: null,
    transactions: [],
    templates: [],
  };
}

function prepareSnapshot(candidate: Partial<UISnapshot> | null): UISnapshot {
  const defaults = createDefaultSnapshot();
  const friends =
    candidate && Array.isArray(candidate.friends)
      ? candidate.friends
      : defaults.friends;
  const transactions =
    candidate && Array.isArray(candidate.transactions)
      ? normalizeTransactions(candidate.transactions)
      : defaults.transactions;
  const templates =
    candidate && Array.isArray(candidate.templates)
      ? candidate.templates
      : defaults.templates;
  const selectedCandidate =
    candidate && typeof candidate.selectedId === "string"
      ? candidate.selectedId
      : null;
  const selectedId = ensureValidSelectedId(friends, selectedCandidate);
  return {
    friends,
    selectedId,
    transactions,
    templates,
  };
}

export function useLegacySnapshot(): UseLegacySnapshotResult {
  const [snapshot, setSnapshot] = useState<UISnapshot>(() => {
    const stored = loadState();
    if (!stored) {
      return createDefaultSnapshot();
    }
    const transactions = normalizeTransactions(stored.transactions);
    const friends = Array.isArray(stored.friends)
      ? stored.friends
      : createDefaultSnapshot().friends;
    const selectedId = ensureValidSelectedId(
      friends,
      typeof stored.selectedId === "string" ? stored.selectedId : null
    );
    return {
      friends,
      selectedId,
      transactions,
      templates: Array.isArray(stored.templates) ? stored.templates : [],
    };
  });

  useEffect(() => {
    saveState(snapshot);
  }, [snapshot]);

  const setFriends = useCallback<LegacySnapshotUpdaters["setFriends"]>(
    (action) => {
      setSnapshot((prev) => {
        const nextFriends = resolveAction(action, prev.friends);
        const friendsArray = Array.isArray(nextFriends)
          ? nextFriends
          : prev.friends;
        if (friendsArray === prev.friends) return prev;
        const selectedId = ensureValidSelectedId(
          friendsArray,
          prev.selectedId
        );
        if (selectedId === prev.selectedId) {
          return {
            ...prev,
            friends: friendsArray,
          };
        }
        return {
          ...prev,
          friends: friendsArray,
          selectedId,
        };
      });
    },
    []
  );

  const setSelectedId = useCallback<LegacySnapshotUpdaters["setSelectedId"]>(
    (action) => {
      setSnapshot((prev) => {
        const nextId = ensureValidSelectedId(
          prev.friends,
          resolveAction(action, prev.selectedId)
        );
        if (nextId === prev.selectedId) return prev;
        return {
          ...prev,
          selectedId: nextId,
        };
      });
    },
    []
  );

  const setTransactions =
    useCallback<LegacySnapshotUpdaters["setTransactions"]>((action) => {
      setSnapshot((prev) => {
        const resolved = resolveAction(action, prev.transactions);
        const upgraded = normalizeTransactions(resolved);
        if (
          upgraded.length === prev.transactions.length &&
          upgraded.every((tx, index) => tx === prev.transactions[index])
        ) {
          return prev;
        }
        return {
          ...prev,
          transactions: upgraded,
        };
      });
    }, []);

  const setTemplates = useCallback<LegacySnapshotUpdaters["setTemplates"]>(
    (action) => {
      setSnapshot((prev) => {
        const resolved = resolveAction(action, prev.templates);
        const nextTemplates = Array.isArray(resolved)
          ? resolved
          : prev.templates;
        if (nextTemplates === prev.templates) {
          return prev;
        }
        return {
          ...prev,
          templates: nextTemplates,
        };
      });
    },
    []
  );

  const replaceSnapshot = useCallback<
    LegacySnapshotUpdaters["replaceSnapshot"]
  >((next) => {
    setSnapshot(() => prepareSnapshot(next));
  }, []);

  const reset = useCallback(() => {
    clearState();
    setSnapshot(createDefaultSnapshot());
  }, []);

  const updaters = useMemo<LegacySnapshotUpdaters>(
    () => ({
      setFriends,
      setSelectedId,
      setTransactions,
      setTemplates,
      replaceSnapshot,
      reset,
    }),
    [
      reset,
      replaceSnapshot,
      setFriends,
      setSelectedId,
      setTransactions,
      setTemplates,
    ]
  );

  return useMemo(
    () => ({
      snapshot,
      updaters,
    }),
    [snapshot, updaters]
  );
}

export { createDefaultSnapshot };
