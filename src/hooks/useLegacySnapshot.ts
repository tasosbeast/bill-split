import { useEffect, useMemo } from "react";
import { saveState } from "../lib/storage";
import type {
  LegacyFriend,
  StoredTransaction,
  UISnapshot,
  StoredSnapshotTemplate,
} from "../types/legacySnapshot";
import { useAppStore } from "../state/appStore";
export type SetStateAction<T> = T | ((prev: T) => T);

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

export function useLegacySnapshot(): UseLegacySnapshotResult {
  const friends = useAppStore((state) => state.friends);
  const selectedId = useAppStore((state) => state.selectedId);
  const transactions = useAppStore((state) => state.transactions);
  const templates = useAppStore((state) => state.templates);
  const settlements = useMemo(
    () => transactions.filter((transaction) => transaction?.type === "settlement"),
    [transactions]
  );

  const setFriends = useAppStore((state) => state.setFriends);
  const setSelectedId = useAppStore((state) => state.setSelectedId);
  const setTransactions = useAppStore((state) => state.setTransactions);
  const setTemplates = useAppStore((state) => state.setTemplates);
  const replaceSnapshot = useAppStore((state) => state.replaceSnapshot);
  const reset = useAppStore((state) => state.reset);

  const snapshot = useMemo<UISnapshot>(
    () => ({
      friends,
      selectedId,
      transactions,
      templates,
      settlements,
    }),
    [friends, selectedId, transactions, templates, settlements]
  );

  useEffect(() => {
    saveState(snapshot);
  }, [snapshot]);

  const updaters = useMemo<LegacySnapshotUpdaters>(
    () => ({
      setFriends: setFriends as LegacySnapshotUpdaters["setFriends"],
      setSelectedId: setSelectedId as LegacySnapshotUpdaters["setSelectedId"],
      setTransactions:
        setTransactions as LegacySnapshotUpdaters["setTransactions"],
      setTemplates: setTemplates as LegacySnapshotUpdaters["setTemplates"],
      replaceSnapshot,
      reset,
    }),
    [reset, replaceSnapshot, setFriends, setSelectedId, setTransactions, setTemplates]
  );

  return useMemo(
    () => ({
      snapshot,
      updaters,
    }),
    [snapshot, updaters]
  );
}

export { createDefaultSnapshot } from "../state/defaultSnapshot";
