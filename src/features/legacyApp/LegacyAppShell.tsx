import {
  useCallback,
  useMemo,
  useState,
  Suspense,
  lazy,
  useEffect,
} from "react";
import type { ChangeEvent } from "react";
import { CATEGORIES } from "../../lib/categories";
import { formatEUR } from "../../lib/money.js";
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
import SettlementAssistantModal, {
  type SettlementAssistantResult,
} from "../../components/SettlementAssistantModal";
import type {
  LegacyFriend,
  StoredTransaction,
  UISnapshot,
} from "../../types/legacySnapshot";
import type { FriendTransaction } from "../../hooks/useLegacyTransactions";
import { setTransactions as syncTransactionsStore } from "../../state/transactionsStore";
import {
  clearReminderHistory,
  getRemindersState,
  setReminderPreferences,
  subscribeReminders,
  REMINDER_TRIGGER_PRESETS,
} from "../../state/remindersStore";
import type {
  ReminderChannel,
  ReminderState,
  ReminderTriggerLevel,
} from "../../state/remindersStore";
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

interface SettlementAssistantState {
  friend: LegacyFriend;
  balance: number;
}

const REMINDER_LEVEL_SEQUENCE: ReminderTriggerLevel[] = [
  "low",
  "medium",
  "high",
];

const REMINDER_LEVEL_LABELS: Record<ReminderTriggerLevel, string> = {
  low: "Relaxed",
  medium: "Balanced",
  high: "Strict",
};

const REMINDER_TRIGGER_OPTIONS = REMINDER_LEVEL_SEQUENCE.map((value) => ({
  value,
  label: `${REMINDER_LEVEL_LABELS[value]} · ${formatEUR(
    REMINDER_TRIGGER_PRESETS[value]
  )}`,
}));

const REMINDER_SNOOZE_OPTIONS = [
  { value: 24, label: "24 hours (next day)" },
  { value: 72, label: "3 days" },
  { value: 168, label: "1 week" },
];

const REMINDER_CHANNEL_OPTIONS: Array<{
  value: ReminderChannel;
  label: string;
  description: string;
}> = [
  {
    value: "email",
    label: "Email",
    description: "Send a friendly recap to each friend's saved email.",
  },
  {
    value: "sms",
    label: "SMS",
    description: "Text friends when a phone number is on file.",
  },
  {
    value: "push",
    label: "Push",
    description: "Show a notification on this device.",
  },
];
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
  const [settlementAssistant, setSettlementAssistant] =
    useState<SettlementAssistantState | null>(null);
  const [reminderSettings, setReminderSettings] = useState<ReminderState>(
    () => getRemindersState()
  );

  const { state: transactionsState, handlers: transactionHandlers } =
    useLegacyTransactions({
      transactions,
      selectedFriendId: selectedId,
      setTransactions,
    });
  const {
    filter: txFilter,
    transactionsForSelectedFriend,
    settlementSummaries,
  } = transactionsState;
  const {
    setFilter: setTxFilter,
    clearFilter,
    addTransaction,
    updateTransaction,
    removeTransaction,
    addSettlement,
    confirmSettlement,
    cancelSettlement,
    reopenSettlement,
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

  useEffect(() => subscribeReminders(setReminderSettings), []);

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

  const handleTriggerLevelChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as ReminderTriggerLevel;
      setReminderPreferences({ triggerLevel: value });
    },
    []
  );

  const handleSnoozeChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const hours = Number(event.target.value);
      if (!Number.isFinite(hours)) return;
      setReminderPreferences({ snoozeHours: hours });
    },
    []
  );

  const handleChannelToggle = useCallback(
    (channel: ReminderChannel, checked: boolean) => {
      const currentChannels = getRemindersState().channels;
      if (!checked && currentChannels.length <= 1) {
        return;
      }
      const nextChannels = checked
        ? currentChannels.includes(channel)
          ? currentChannels
          : [...currentChannels, channel]
        : currentChannels.filter((value) => value !== channel);
      setReminderPreferences({ channels: nextChannels });
    },
    []
  );

  const handleClearReminderHistory = useCallback(() => {
    clearReminderHistory();
  }, []);

  const reminderHistoryCount = useMemo(
    () => Object.keys(reminderSettings.lastSent).length,
    [reminderSettings.lastSent]
  );

  const hasPresetSnooze = useMemo(
    () =>
      REMINDER_SNOOZE_OPTIONS.some(
        (option) => option.value === reminderSettings.snoozeHours
      ),
    [reminderSettings.snoozeHours]
  );

  const reminderHistoryLabel = useMemo(() => {
    if (reminderHistoryCount === 0) {
      return "No reminders have been sent yet.";
    }
    const suffix = reminderHistoryCount === 1 ? "" : "s";
    return `Last reminder went to ${reminderHistoryCount} friend${suffix}.`;
  }, [reminderHistoryCount]);

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

  const openRestoreModal = useCallback(() => setShowRestoreModal(true), []);
  const closeRestoreModal = useCallback(() => setShowRestoreModal(false), []);

  const handleOpenSettlementAssistant = useCallback(() => {
    const guard = ensureSettle();
    if (!guard.allowed) return;
    const resolvedFriend =
      friendsById.get(guard.friendId) ??
      (selectedFriend && selectedFriend.id === guard.friendId
        ? selectedFriend
        : null);
    if (!resolvedFriend) return;
    setSettlementAssistant({ friend: resolvedFriend, balance: guard.balance });
  }, [ensureSettle, friendsById, selectedFriend]);

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

      <section
        className="panel reminder-settings"
        aria-labelledby="reminder-settings-heading"
      >
        <div className="reminder-settings__header">
          <h2 id="reminder-settings-heading">Reminders</h2>
          <p className="reminder-settings__subtitle">
            Choose when Bill Split nudges friends about outstanding balances.
          </p>
        </div>

        <div className="reminder-settings__field">
          <label
            className="reminder-settings__label"
            htmlFor="reminder-trigger-level"
          >
            Trigger level
          </label>
          <select
            id="reminder-trigger-level"
            className="select"
            value={reminderSettings.triggerLevel}
            onChange={handleTriggerLevelChange}
          >
            {REMINDER_TRIGGER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="reminder-settings__help">
            Reminders send once a friend owes at least{" "}
            <strong>{formatEUR(reminderSettings.threshold)}</strong>.
          </p>
        </div>

        <div className="reminder-settings__field">
          <label className="reminder-settings__label" htmlFor="reminder-snooze">
            Snooze window
          </label>
          <select
            id="reminder-snooze"
            className="select"
            value={String(reminderSettings.snoozeHours)}
            onChange={handleSnoozeChange}
          >
            {REMINDER_SNOOZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            {!hasPresetSnooze && (
              <option value={reminderSettings.snoozeHours}>
                Custom · {reminderSettings.snoozeHours} hour
                {reminderSettings.snoozeHours === 1 ? "" : "s"}
              </option>
            )}
          </select>
          <p className="reminder-settings__help">
            We'll wait at least {reminderSettings.snoozeHours} hour
            {reminderSettings.snoozeHours === 1 ? "" : "s"} between reminders
            to the same friend.
          </p>
        </div>

        <fieldset className="reminder-settings__field">
          <legend className="reminder-settings__label">Channels</legend>
          <div className="reminder-settings__channels">
            {REMINDER_CHANNEL_OPTIONS.map((option) => {
              const checked = reminderSettings.channels.includes(option.value);
              return (
                <label
                  key={option.value}
                  className="reminder-settings__checkbox"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      handleChannelToggle(option.value, event.target.checked)
                    }
                  />
                  <div>
                    <div className="reminder-settings__checkbox-label">
                      {option.label}
                    </div>
                    <div className="reminder-settings__checkbox-hint">
                      {option.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="reminder-settings__footer">
          <span>{reminderHistoryLabel}</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={handleClearReminderHistory}
            disabled={reminderHistoryCount === 0}
          >
            Clear history
          </button>
        </div>
      </section>

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
