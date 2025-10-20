import {
  useCallback,
  useMemo,
  useState,
  Suspense,
  lazy,
  useEffect,
} from "react";
import { CATEGORIES } from "../../lib/categories";
import { useLegacyFriendManagement } from "../../hooks/useLegacyFriendManagement";
import { useLegacyTransactions } from "../../hooks/useLegacyTransactions";
import {
  useTransactionTemplates,
  type SplitAutomationRequest,
} from "../../hooks/useTransactionTemplates";
import FriendsPanel from "../../components/legacy/FriendsPanel";
import TransactionsPanel from "../../components/legacy/TransactionsPanel";
import AnalyticsPanel from "../../components/legacy/AnalyticsPanel";
import RestoreSnapshotModal from "../../components/legacy/RestoreSnapshotModal";
import type { StoredTransaction, UISnapshot } from "../../types/legacySnapshot";
import type { FriendTransaction } from "../../hooks/useLegacyTransactions";
import { setTransactions as syncTransactionsStore } from "../../state/transactionsStore";
import type { SplitDraftPreset } from "../../types/transactionTemplate";

const AddFriendModal = lazy(() => import("../../components/AddFriendModal"));
const EditTransactionModal = lazy(
  () => import("../../components/EditTransactionModal")
);
const TemplateComposerModal = lazy(
  () => import("../../components/TemplateComposerModal")
);

type RestoreFeedback =
  | { status: "success"; message: string }
  | { status: "warning"; message: string }
  | { status: "error"; message: string }
  | null;

type EditableTransaction = FriendTransaction;
type TemplateRequestIntent = {
  mode: "template" | "recurring";
  includeSplit: boolean;
};
export default function LegacyAppShell(): JSX.Element {
  const {
    snapshot,
    updaters,
    friends,
    selectedId,
    selectedFriend,
    friendsById,
    balances,
    selectedBalance,
    createFriend,
    removeFriend,
    selectFriend,
    ensureSettle,
    showAddModal,
    openAddModal,
    closeAddModal,
  } = useLegacyFriendManagement();
  const { transactions, templates } = snapshot;
  const { setTransactions, setTemplates, replaceSnapshot, reset: resetSnapshot } =
    updaters;
  const [activeView, setActiveView] = useState<"home" | "analytics">("home");
  const [editTx, setEditTx] = useState<EditableTransaction | null>(null);
  const [restoreFeedback, setRestoreFeedback] = useState<RestoreFeedback>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [draftPreset, setDraftPreset] = useState<SplitDraftPreset | null>(null);
  const [pendingTemplate, setPendingTemplate] = useState<
    { transaction: StoredTransaction; intent: TemplateRequestIntent } | null
  >(null);
  const [splitFormResetSignal, setSplitFormResetSignal] = useState(0);

  const { state: transactionsState, handlers: transactionHandlers } =
    useLegacyTransactions({
      transactions,
      selectedFriendId: selectedId,
      setTransactions,
    });
  const {
    filter: txFilter,
    transactionsForSelectedFriend,
  } = transactionsState;
  const {
    setFilter: setTxFilter,
    clearFilter,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addSettlement,
  } = transactionHandlers;

  const {
    handleAutomation,
    handleApplyTemplate,
    handleDeleteTemplate,
    handleGenerateFromTemplate,
  } = useTransactionTemplates({
    setTemplates,
    addTransaction,
    setDraftPreset,
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
      setSplitFormResetSignal((prev) => prev + 1);
    },
    [addTransaction, setDraftPreset, setSplitFormResetSignal]
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

  const handleAutomation = useCallback(
    (transaction: StoredTransaction, automation: SplitAutomationRequest | null) => {
      if (!automation || !automation.template) return;
      const templateRequest = automation.template;
      const existing = templateRequest?.templateId
        ? templates.find((entry) => entry.id === templateRequest.templateId) ?? null
        : null;
      const record = templateFromTransaction(transaction, templateRequest, existing ?? undefined);
      setTemplates((prev) => {
        const next = [...prev];
        const index = next.findIndex((entry) => entry.id === record.id);
        if (index >= 0) {
          next[index] = record;
        } else {
          next.unshift(record);
        }
        return next;
      });
    },
    [setTemplates, templates]
  );

  const handleApplyTemplate = useCallback((template: TransactionTemplate) => {
    setDraftPreset(buildDraftFromTemplate(template));
  }, []);

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      setTemplates((prev) => prev.filter((entry) => entry.id !== templateId));
      setDraftPreset((prev) => (prev?.templateId === templateId ? null : prev));
    },
    [setTemplates]
  );

  const handleGenerateFromTemplate = useCallback(
    (template: TransactionTemplate) => {
      const transaction = buildSplitTransaction({
        total: template.total,
        payer: template.payer,
        participants: template.participants,
        category: template.category,
        note: template.note ?? template.name,
        templateId: template.id,
        templateName: template.name,
      }) as StoredTransaction;
      addTransaction(transaction);
      if (template.recurrence) {
        const nextRecurrence = advanceNextOccurrence(template.recurrence);
        setTemplates((prev) =>
          prev.map((entry) =>
            entry.id === template.id ? { ...entry, recurrence: nextRecurrence } : entry
          )
        );
      }
    },
    [addTransaction, setTemplates]
  );

  const openRestoreModal = useCallback(() => setShowRestoreModal(true), []);
  const closeRestoreModal = useCallback(() => setShowRestoreModal(false), []);

  const handleSettle = useCallback(() => {
    const guard = ensureSettle();
    if (!guard.allowed) return;
    const { friendId, balance: bal } = guard;
    addSettlement(friendId, bal);
  }, [addSettlement, ensureSettle]);

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
      removeFriend(friendId);
    },
    [friendsById, removeFriend]
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
    resetSnapshot();
    window.location.reload();
  }, [resetSnapshot]);

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
    [replaceSnapshot]
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
                (activeView === "home" ? " segmented-control__btn--active" : "")
              }
              aria-current={activeView === "home" ? "page" : undefined}
              onClick={() => setActiveView("home")}
            >
              Splits
            </button>
            <button
              type="button"
              className={
                "segmented-control__btn" +
                (activeView === "analytics"
                  ? " segmented-control__btn--active"
                  : "")
              }
              aria-current={activeView === "analytics" ? "page" : undefined}
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

      {activeView === "analytics" ? (
        <AnalyticsPanel state={storeSnapshot} />
      ) : (
        <div className="layout">
          <FriendsPanel
            friends={friends}
            selectedFriendId={selectedId}
            balances={balances}
            onAddFriend={openAddModal}
            onSelectFriend={selectFriend}
            onRemoveFriend={handleRemoveFriend}
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
            onSettle={handleSettle}
            onFilterChange={setTxFilter}
            onClearFilter={clearFilter}
            onRequestEdit={handleRequestEdit}
            onDeleteTransaction={handleDeleteTx}
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

      {showRestoreModal && (
        <Suspense fallback={null}>
          <RestoreSnapshotModal
            onClose={closeRestoreModal}
            onRestore={handleRestoreFile}
          />
        </Suspense>
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
              friendsById.get(editTx.effect?.friendId || editTx.friendId) ?? null
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
