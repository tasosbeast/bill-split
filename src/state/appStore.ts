import { create } from "zustand";
import { loadState, clearState } from "../lib/storage";
import { upgradeTransactions } from "../lib/transactions";
import type {
  LegacyFriend,
  StoredSnapshotTemplate,
  StoredTransaction,
  UISnapshot,
} from "../types/legacySnapshot";
import type { SplitDraftPreset } from "../types/transactionTemplate";
import { createDefaultSnapshot } from "./defaultSnapshot";

export type ViewMode = "home" | "analytics";

type StateUpdater<T> = T | ((prev: T) => T);

function resolveStateUpdater<T>(updater: StateUpdater<T>, prev: T): T {
  return typeof updater === "function"
    ? (updater as (value: T) => T)(prev)
    : updater;
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

function prepareSnapshot(candidate: Partial<UISnapshot> | null | undefined): UISnapshot {
  if (!candidate) {
    return createDefaultSnapshot();
  }
  const defaults = createDefaultSnapshot();
  const friends = Array.isArray(candidate.friends)
    ? candidate.friends
    : defaults.friends;
  const transactions = normalizeTransactions(
    Array.isArray(candidate.transactions)
      ? candidate.transactions
      : defaults.transactions
  );
  const templates = Array.isArray(candidate.templates)
    ? candidate.templates
    : defaults.templates;
  const selectedCandidate =
    typeof candidate.selectedId === "string" ? candidate.selectedId : null;
  const selectedId = ensureValidSelectedId(friends, selectedCandidate);
  return {
    friends,
    selectedId,
    transactions,
    templates,
  };
}

const persisted = loadState();
const initialSnapshot = persisted
  ? prepareSnapshot(persisted)
  : createDefaultSnapshot();

interface FriendsSlice {
  friends: LegacyFriend[];
  selectedId: string | null;
  setFriends: (
    updater: StateUpdater<LegacyFriend[]>
  ) => void;
  setSelectedId: (updater: StateUpdater<string | null>) => void;
  addFriend: (friend: LegacyFriend) => void;
  removeFriend: (friendId: string) => void;
}

interface TransactionsSlice {
  transactions: StoredTransaction[];
  templates: StoredSnapshotTemplate[];
  filter: string;
  draftPreset: SplitDraftPreset | null;
  splitFormResetSignal: number;
  setTransactions: (
    updater: StateUpdater<StoredTransaction[]>
  ) => void;
  setTemplates: (
    updater: StateUpdater<StoredSnapshotTemplate[]>
  ) => void;
  setFilter: (next: string) => void;
  clearFilter: () => void;
  setDraftPreset: (preset: SplitDraftPreset | null) => void;
  bumpSplitFormResetSignal: () => void;
}

interface UiSlice {
  view: ViewMode;
  showAddModal: boolean;
  showRestoreModal: boolean;
  restoreFeedback: RestoreFeedback;
  openAddModal: () => void;
  closeAddModal: () => void;
  openRestoreModal: () => void;
  closeRestoreModal: () => void;
  setView: (view: ViewMode) => void;
  setRestoreFeedback: (feedback: RestoreFeedback) => void;
}

interface SnapshotSlice {
  replaceSnapshot: (snapshot: UISnapshot) => void;
  reset: () => void;
}

export type RestoreFeedback =
  | { status: "success"; message: string }
  | { status: "warning"; message: string }
  | { status: "error"; message: string }
  | null;

export type AppStore = FriendsSlice & TransactionsSlice & UiSlice & SnapshotSlice;

export const useAppStore = create<AppStore>()((set, get) => ({
  friends: initialSnapshot.friends,
  selectedId: initialSnapshot.selectedId,
  transactions: initialSnapshot.transactions,
  templates: initialSnapshot.templates,
  filter: "All",
  draftPreset: null,
  splitFormResetSignal: 0,
  view: "home",
  showAddModal: false,
  showRestoreModal: false,
  restoreFeedback: null,
  setFriends: (updater) => {
    set((state) => {
      const nextFriends = resolveStateUpdater(updater, state.friends);
      const selectedId = ensureValidSelectedId(nextFriends, state.selectedId);
      return {
        friends: nextFriends,
        selectedId,
      };
    });
  },
  setSelectedId: (updater) => {
    set((state) => {
      const resolved = resolveStateUpdater(updater, state.selectedId);
      const nextSelected = ensureValidSelectedId(state.friends, resolved);
      return { selectedId: nextSelected };
    });
  },
  addFriend: (friend) => {
    set((state) => ({
      friends: [...state.friends, friend],
      selectedId: friend.id,
    }));
  },
  removeFriend: (friendId) => {
    if (!friendId) return;
    set((state) => {
      const friends = state.friends.filter((friend) => friend.id !== friendId);
      const transactions = state.transactions.filter((transaction) => {
        const participants = Array.isArray(transaction.friendIds)
          ? (transaction.friendIds as string[])
          : [];
        return !participants.includes(friendId);
      });
      return {
        friends,
        transactions,
        selectedId:
          state.selectedId === friendId ? null : ensureValidSelectedId(friends, state.selectedId),
      };
    });
  },
  setTransactions: (updater) => {
    set((state) => {
      const resolved = resolveStateUpdater(updater, state.transactions);
      const upgraded = normalizeTransactions(resolved);
      return { transactions: upgraded };
    });
  },
  setTemplates: (updater) => {
    set((state) => {
      const resolved = resolveStateUpdater(updater, state.templates);
      return { templates: Array.isArray(resolved) ? [...resolved] : state.templates };
    });
  },
  setFilter: (next) => set(() => ({ filter: next })),
  clearFilter: () => set(() => ({ filter: "All" })),
  setDraftPreset: (preset) => set(() => ({ draftPreset: preset })),
  bumpSplitFormResetSignal: () =>
    set((state) => ({ splitFormResetSignal: state.splitFormResetSignal + 1 })),
  setView: (view) => set(() => ({ view })),
  openAddModal: () => set(() => ({ showAddModal: true })),
  closeAddModal: () => set(() => ({ showAddModal: false })),
  openRestoreModal: () => set(() => ({ showRestoreModal: true })),
  closeRestoreModal: () => set(() => ({ showRestoreModal: false })),
  setRestoreFeedback: (feedback) => set(() => ({ restoreFeedback: feedback })),
  replaceSnapshot: (snapshot) => {
    const prepared = prepareSnapshot(snapshot);
    set(() => ({
      friends: prepared.friends,
      selectedId: prepared.selectedId,
      transactions: prepared.transactions,
      templates: prepared.templates,
      filter: "All",
    }));
  },
  reset: () => {
    clearState();
    const defaults = createDefaultSnapshot();
    set(() => ({
      friends: defaults.friends,
      selectedId: defaults.selectedId,
      transactions: defaults.transactions,
      templates: defaults.templates,
      filter: "All",
      draftPreset: null,
      splitFormResetSignal: 0,
      showAddModal: false,
      showRestoreModal: false,
      restoreFeedback: null,
      view: "home",
    }));
  },
}));

export { prepareSnapshot };
