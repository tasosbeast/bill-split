import { useCallback, useMemo } from "react";
import { useFriendSelection } from "./useFriendSelection";
import { useAppStore } from "../state/appStore";
import type { Friend } from "../types/legacySnapshot"; // TODO Phase 5 rename

type FriendSelectionResult = ReturnType<typeof useFriendSelection>;

export interface FriendManagementResult extends FriendSelectionResult {
  showAddModal: boolean;
  openAddModal: () => void;
  closeAddModal: () => void;
  createFriend: (
    friend: Friend
  ) => ReturnType<FriendSelectionResult["createFriend"]>;
  removeFriend: FriendSelectionResult["removeFriend"];
}

export function useFriendManagement(): FriendManagementResult {
  const selection = useFriendSelection();
  const showAddModal = useAppStore((state) => state.showAddModal);
  const openAddModal = useAppStore((state) => state.openAddModal);
  const closeAddModal = useAppStore((state) => state.closeAddModal);

  const createFriend = useCallback<FriendManagementResult["createFriend"]>(
    (friend) => {
      const outcome = selection.createFriend(friend);
      if (outcome.ok) {
        closeAddModal();
      }
      return outcome;
    },
    [selection, closeAddModal]
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
