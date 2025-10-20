import { useCallback, useMemo, useState } from "react";
import { useFriendSelection } from "./useFriendSelection";
import type { LegacyFriend } from "../types/legacySnapshot";

type FriendSelectionResult = ReturnType<typeof useFriendSelection>;

export interface LegacyFriendManagementResult extends FriendSelectionResult {
  showAddModal: boolean;
  openAddModal: () => void;
  closeAddModal: () => void;
  createFriend: (friend: LegacyFriend) => ReturnType<FriendSelectionResult["createFriend"]>;
  removeFriend: FriendSelectionResult["removeFriend"];
}

export function useLegacyFriendManagement(): LegacyFriendManagementResult {
  const selection = useFriendSelection();
  const [showAddModal, setShowAddModal] = useState(false);

  const openAddModal = useCallback(() => setShowAddModal(true), []);
  const closeAddModal = useCallback(() => setShowAddModal(false), []);

  const createFriend = useCallback<LegacyFriendManagementResult["createFriend"]>(
    (friend) => {
      const outcome = selection.createFriend(friend);
      if (outcome.ok) {
        setShowAddModal(false);
      }
      return outcome;
    },
    [selection]
  );

  return useMemo(
    () => ({
      ...selection,
      showAddModal,
      openAddModal,
      closeAddModal,
      createFriend,
      removeFriend: selection.removeFriend,
    }),
    [selection, showAddModal, openAddModal, closeAddModal, createFriend]
  );
}
