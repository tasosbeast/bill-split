import {
  useCallback,
  useMemo,
  useState,
  Suspense,
  lazy,
  useEffect,
} from "react";
import { CATEGORIES } from "../../lib/categories";
import { useFriends } from "../../hooks/useFriends";
import {
  useTransactions,
  type FriendTransaction,
} from "../../hooks/useTransactions";
import { useSettleUp } from "../../hooks/useSettleUp";
import { FRIEND_SELECTION_MESSAGES } from "../../hooks/useFriendSelection";
import {
  useTransactionTemplates,
  type SplitAutomationRequest,
} from "../../hooks/useTransactionTemplates";
import { useAppStore } from "../../state/appStore";
import { useToasts } from "../../state/toastStore";
import FriendsPanel from "../../components/FriendsPanel";
import TransactionsPanel from "../../components/TransactionsPanel";
import AnalyticsPanel from "../../components/AnalyticsPanel";
import RestoreSnapshotModal from "../../components/RestoreSnapshotModal";
import SettlementAssistantModal, {
  type SettlementAssistantResult,
} from "../../components/SettlementAssistantModal";
import type {
  Friend,
  StoredTransaction,
  UISnapshot,
} from "../../types/legacySnapshot";
import { setTransactions as syncTransactionsStore } from "../../state/transactionsStore";
import type { SplitDraftPreset } from "../../types/transactionTemplate";

const AddFriendModal = lazy(() => import("../../components/AddFriendModal"));
const EditTransactionModal = lazy(
  () => import("../../components/EditTransactionModal")
);
const TemplateComposerModal = lazy(
  () => import("../../components/TemplateComposerModal")
);

type EditableTransaction = FriendTransaction;
type TemplateRequestIntent = {
  mode: "template" | "recurring";
  includeSplit: boolean;
};

interface SettlementAssistantState {
  friend: Friend;
  balance: number;
}
export default function LegacyAppShell() {
  const {
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
  } = useFriends();
  const {
    transactions,
    filter: txFilter,
    transactionsForSelectedFriend,
    setFilter: setTxFilter,
    clearFilter,
    addTransaction,
    updateTransaction,
    removeTransaction,
  } = useTransactions();
  const {
    settlementSummaries,
    ensureSettle,
    addSettlement,
    confirmSettlement,
    cancelSettlement,
    reopenSettlement,
  } = useSettleUp();
  const templates = useAppStore((state) => state.templates);
  const setTemplates = useAppStore((state) => state.setTemplates);
  const replaceSnapshot = useAppStore((state) => state.replaceSnapshot);
  const resetStore = useAppStore((state) => state.reset);
  const showAddModal = useAppStore((state) => state.showAddModal);
  const openAddModal = useAppStore((state) => state.openAddModal);
  const closeAddModal = useAppStore((state) => state.closeAddModal);
  const view = useAppStore((state) => state.view);
  const setActiveView = useAppStore((state) => state.setView);
  const [editTx, setEditTx] = useState<EditableTransaction | null>(null);
  const restoreFeedback = useAppStore((state) => state.restoreFeedback);
  const setRestoreFeedback = useAppStore((state) => state.setRestoreFeedback);
  const showRestoreModal = useAppStore((state) => state.showRestoreModal);
  const openRestoreModal = useAppStore((state) => state.openRestoreModal);
  const closeRestoreModal = useAppStore((state) => state.closeRestoreModal);
  const draftPreset = useAppStore((state) => state.draftPreset);
  const setDraftPreset = useAppStore((state) => state.setDraftPreset);
  const [pendingTemplate, setPendingTemplate] = useState<{
    transaction: StoredTransaction;
    intent: TemplateRequestIntent;
  } | null>(null);
  const splitFormResetSignal = useAppStore(
    (state) => state.splitFormResetSignal
  );
  const bumpSplitFormResetSignal = useAppStore(
    (state) => state.bumpSplitFormResetSignal
  );
  const [settlementAssistant, setSettlementAssistant] =
    useState<SettlementAssistantState | null>(null);
  const toastApi = useToasts();
  const addToast = toastApi.addToast;

  // Wrapper to make setDraftPreset compatible with Dispatch<SetStateAction<T>>
  const setDraftPresetWrapper = useCallback(
    (
      action:
        | SplitDraftPreset
        | null
        | ((prev: SplitDraftPreset | null) => SplitDraftPreset | null)
    ) => {
      if (typeof action === "function") {
        setDraftPreset(action(draftPreset));
      } else {
        setDraftPreset(action);
      }
    },
    [setDraftPreset, draftPreset]
  );

  const {
    handleAutomation,
    handleApplyTemplate,
    handleDeleteTemplate,
    handleGenerateFromTemplate,
  } = useTransactionTemplates({
    setTemplates,
    addTransaction,
    setDraftPreset: setDraftPresetWrapper,
  });

  const storeSnapshot = useMemo<
    Pick<UISnapshot, "friends" | "selectedId" | "transactions"> & {
      balances: Map<string, number>;
    }
  >(
    () => ({
      friends,
      selectedId,
      balances,
      transactions,
    }),
    [friends, selectedId, balances, transactions]
  );

  const handleSplit = useCallback(
    (tx: StoredTransaction) => {
      addTransaction(tx);
      setDraftPreset(null);
      bumpSplitFormResetSignal();
    },
    [addTransaction, setDraftPreset, bumpSplitFormResetSignal]
  );

  const handleRequestTemplate = useCallback(
    (transaction: StoredTransaction, intent: TemplateRequestIntent) => {
      setPendingTemplate({ transaction, intent });
    },
    []
  );

  const closeTemplateModal = useCallback(() => setPendingTemplate(null), []);

  const handleTemplateModalSave = useCallback(
    (automation: SplitAutomationRequest) => {
      if (!pendingTemplate) return;
      handleAutomation(pendingTemplate.transaction, automation);
      if (pendingTemplate.intent.includeSplit) {
        handleSplit(pendingTemplate.transaction);
      }
      setPendingTemplate(null);
    },
    [pendingTemplate, handleAutomation, handleSplit]
  );

  const handleOpenSettlementAssistant = useCallback(() => {
    const guard = ensureSettle();
    if (!guard.allowed) {
      const message =
        guard.reason === "no-selection"
          ? FRIEND_SELECTION_MESSAGES.noSelection
          : FRIEND_SELECTION_MESSAGES.zeroBalance;
      addToast({ kind: "error", message });
      return;
    }
    const resolvedFriend =
      friendsById.get(guard.friendId) ??
      (selectedFriend && selectedFriend.id === guard.friendId
        ? selectedFriend
        : null);
    if (!resolvedFriend) return;
    setSettlementAssistant({ friend: resolvedFriend, balance: guard.balance });
  }, [addToast, ensureSettle, friendsById, selectedFriend]);

  const handleDismissSettlementAssistant = useCallback(() => {
    setSettlementAssistant(null);
  }, []);

  const handleRecordSettlement = useCallback(
    (result: SettlementAssistantResult) => {
      if (!settlementAssistant) return;
      const { friend } = settlementAssistant;
      addSettlement({
        friendId: friend.id,
        balance: result.amount,
        status: result.status,
        payment: result.payment ?? null,
      });
      setSettlementAssistant(null);
    },
    [settlementAssistant, addSettlement]
  );

  const handleDeleteTx = useCallback(
    (id: string) => {
      const ok = confirm("Delete this transaction permanently?");
      if (!ok) return;
      removeTransaction(id);
    },
    [removeTransaction]
  );

  const handleRemoveFriend = useCallback(
    (friendId: string) => {
      const friend = friendsById.get(friendId);
      if (!friend) return;
      const confirmation = confirm(
        `Remove ${friend.name}? Their saved transactions with you will also be deleted.`
      );
      if (!confirmation) return;
      const outcome = removeFriend(friendId);
      if (!outcome.ok) {
        const message =
          outcome.reason === "outstanding-balance"
            ? FRIEND_SELECTION_MESSAGES.outstandingBalance
            : "Friend could not be removed.";
        addToast({ kind: "error", message });
        return;
      }
      addToast({ kind: "success", message: `${friend.name} removed.` });
    },
    [addToast, friendsById, removeFriend]
  );

  const handleRequestEdit = useCallback((transaction: FriendTransaction) => {
    setEditTx(transaction);
  }, []);

  const handleSaveEditedTx = useCallback(
    (updated: StoredTransaction) => {
      updateTransaction(updated);
    },
    [updateTransaction]
  );

  const handleReset = useCallback(() => {
    const ok = confirm(
      "This will delete all your friends, transactions, and balances. Are you sure?"
    );
    if (!ok) return;
    resetStore();
    window.location.reload();
  }, [resetStore]);

  const handleBackup = useCallback(() => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      friends,
      selectedId,
      transactions,
      templates,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bill-split-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }, [friends, selectedId, transactions, templates]);

  useEffect(() => {
    syncTransactionsStore(transactions);
  }, [transactions]);

  const handleRestoreFile = useCallback(
    async (file: File) => {
      setRestoreFeedback(null);
      try {
        const raw = await file.text();
        const data = JSON.parse(raw) as unknown;
        const { restoreSnapshot } = await import("../../lib/restoreSnapshot");
        const {
          friends: safeFriends,
          transactions: restoredTransactions,
          selectedId: normalizedSelectedId,
          templates: restoredTemplates,
          skippedTransactions,
        } = restoreSnapshot(data);

        replaceSnapshot({
          friends: safeFriends,
          selectedId: normalizedSelectedId,
          transactions: restoredTransactions,
          templates: restoredTemplates,
        });

        setRestoreFeedback(
          skippedTransactions.length > 0
            ? {
                status: "warning",
                message: `${skippedTransactions.length} transaction(s) were skipped during restore. Check console for details.`,
              }
            : {
                status: "success",
                message: "Restore completed successfully!",
              }
        );
      } catch (error) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error("Restore failed: unexpected payload");
        console.warn("Restore failed:", normalizedError);
        setRestoreFeedback({
          status: "error",
          message: `Restore failed: ${normalizedError.message}`,
        });
        throw normalizedError;
      }
    },
    [replaceSnapshot, setRestoreFeedback]
  );

  return (
    <div className="app">
      {restoreFeedback ? (
        <div
          className={`restore-feedback restore-feedback-${restoreFeedback.status}`}
          role="status"
        >
          {restoreFeedback.message}
        </div>
      ) : null}
      <header className="header">
        <div className="brand">Bill Split</div>
        <div className="header-controls">
          <nav className="segmented-control" aria-label="Primary navigation">
            <button
              type="button"
              className={
                "segmented-control__btn" +
                (view === "home" ? " segmented-control__btn--active" : "")
              }
              aria-current={view === "home" ? "page" : undefined}
              onClick={() => setActiveView("home")}
            >
              Splits
            </button>
            <button
              type="button"
              className={
                "segmented-control__btn" +
                (view === "analytics" ? " segmented-control__btn--active" : "")
              }
              aria-current={view === "analytics" ? "page" : undefined}
              onClick={() => setActiveView("analytics")}
            >
              Analytics
            </button>
          </nav>

          <div className="action-group" role="group" aria-label="Data actions">
            <button
              className="button btn-ghost action-group__btn"
              onClick={handleBackup}
              title="Export all data to a JSON file"
            >
              Backup
            </button>

            <button
              className="button btn-ghost action-group__btn"
              onClick={openRestoreModal}
              title="Import data from a JSON file"
            >
              Restore
            </button>

            <button
              className="button btn-ghost action-group__btn"
              onClick={handleReset}
              title="Clear all data and restart"
            >
              Reset Data
            </button>
          </div>
        </div>
      </header>

      <main id="main-content">
        {view === "analytics" ? (
          <AnalyticsPanel state={storeSnapshot} />
        ) : (
          <div className="layout">
            <FriendsPanel
              friends={friends}
              friendSummaries={friendSummaries}
              selectedFriendId={selectedId}
              balances={balances}
              onAddFriend={openAddModal}
              onSelectFriend={selectFriend}
              onRemoveFriend={handleRemoveFriend}
              settlementSummaries={settlementSummaries}
              onConfirmSettlement={confirmSettlement}
            />

            <TransactionsPanel
              friends={friends}
              selectedFriend={selectedFriend}
              selectedBalance={selectedBalance}
              friendsById={friendsById}
              transactions={transactionsForSelectedFriend}
              txFilter={txFilter}
              categories={CATEGORIES}
              onSplit={handleSplit}
              onAutomation={handleAutomation}
              onOpenSettlement={handleOpenSettlementAssistant}
              onFilterChange={setTxFilter}
              onClearFilter={clearFilter}
              onRequestEdit={handleRequestEdit}
              onDeleteTransaction={handleDeleteTx}
              onConfirmSettlement={confirmSettlement}
              onCancelSettlement={cancelSettlement}
              onReopenSettlement={reopenSettlement}
              templates={templates}
              onUseTemplate={handleApplyTemplate}
              onGenerateRecurring={handleGenerateFromTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              draft={draftPreset}
              onRequestTemplate={handleRequestTemplate}
              splitFormResetSignal={splitFormResetSignal}
            />
          </div>
        )}
      </main>

      {showRestoreModal && (
        <Suspense fallback={null}>
          <RestoreSnapshotModal
            onClose={closeRestoreModal}
            onRestore={handleRestoreFile}
          />
        </Suspense>
      )}

      {settlementAssistant && (
        <SettlementAssistantModal
          friend={settlementAssistant.friend}
          balance={settlementAssistant.balance}
          onClose={handleDismissSettlementAssistant}
          onSubmit={handleRecordSettlement}
        />
      )}

      {showAddModal && (
        <Suspense fallback={null}>
          <AddFriendModal onClose={closeAddModal} onCreate={createFriend} />
        </Suspense>
      )}

      {editTx && (
        <Suspense fallback={null}>
          <EditTransactionModal
            tx={editTx}
            friend={
              friendsById.get(
                (editTx.effect?.friendId || editTx.friendId) ?? ""
              ) ?? null
            }
            onClose={() => setEditTx(null)}
            onSave={handleSaveEditedTx}
          />
        </Suspense>
      )}

      {pendingTemplate && (
        <Suspense fallback={null}>
          <TemplateComposerModal
            transaction={pendingTemplate.transaction}
            intent={pendingTemplate.intent}
            onClose={closeTemplateModal}
            onSave={handleTemplateModalSave}
          />
        </Suspense>
      )}
    </div>
  );
}
