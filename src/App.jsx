import { useMemo, useState, useCallback, Suspense, lazy } from "react";
import "./index.css";
import { CATEGORIES } from "./lib/categories";
import { getTransactionEffects, transactionIncludesFriend } from "./lib/transactions";
import { useFriendSelection } from "./hooks/useFriendSelection";
import FriendsPanel from "./components/legacy/FriendsPanel";
import TransactionsPanel from "./components/legacy/TransactionsPanel";
import AnalyticsPanel from "./components/legacy/AnalyticsPanel";
import RestoreSnapshotModal from "./components/legacy/RestoreSnapshotModal";

const AddFriendModal = lazy(() => import("./components/AddFriendModal"));
const EditTransactionModal = lazy(() => import("./components/EditTransactionModal"));

export default function App() {
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
    selectFriend,
    ensureSettle,
  } = useFriendSelection();
  const { transactions } = snapshot;
  const { setTransactions, replaceSnapshot, reset: resetSnapshot } = updaters;
  const [activeView, setActiveView] = useState("home");
  const [txFilter, setTxFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [restoreFeedback, setRestoreFeedback] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  const storeSnapshot = useMemo(
    () => ({
      friends,
      selectedId,
      balances,
      transactions,
    }),
    [friends, selectedId, balances, transactions]
  );

  const friendTx = useMemo(() => {
    if (!selectedId) return [];
    return transactions
      .map((t) => {
        if (!transactionIncludesFriend(t, selectedId)) return null;
        if (txFilter !== "All" && t.category !== txFilter) return null;
        const effects = getTransactionEffects(t);
        const effect = effects.find((e) => e.friendId === selectedId) || null;
        return effect ? { ...t, effect } : null;
      })
      .filter(Boolean);
  }, [transactions, selectedId, txFilter]);

  function handleSplit(tx) {
    setTransactions((prev) => [tx, ...prev]);
  }

  const openAdd = useCallback(() => setShowAdd(true), []);

  const closeAdd = useCallback(() => setShowAdd(false), []);

  const openAnalytics = useCallback(() => setActiveView("analytics"), []);

  const navigateHome = useCallback(() => setActiveView("home"), []);

  const openRestoreModal = useCallback(() => setShowRestoreModal(true), []);

  const closeRestoreModal = useCallback(() => setShowRestoreModal(false), []);

  const handleCreateFriend = useCallback(
    (friend) => {
      const outcome = createFriend(friend);
      if (!outcome.ok) return;
    },
    [createFriend]
  );

  function handleSettle() {
    const guard = ensureSettle();
    if (!guard.allowed) return;
    const { friendId, balance: bal } = guard;

    const tx = {
      id: crypto.randomUUID(),
      type: "settlement",
      friendId,
      total: null,
      payer: null,
      participants: [
        { id: "you", amount: Math.max(-bal, 0) },
        { id: friendId, amount: Math.max(bal, 0) },
      ],
      effects: [
        {
          friendId,
          delta: -bal,
          share: Math.abs(bal),
        },
      ],
      friendIds: [friendId],
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);
  }
  const handleDeleteTx = useCallback(
    (id) => {
      const ok = confirm("Delete this transaction permanently?");
      if (!ok) return;
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [setTransactions]
  );
  // NEW: open edit modal
  const handleRequestEdit = useCallback((tx) => {
    setEditTx(tx);
  }, []);

  // NEW: save edited transaction
  const handleSaveEditedTx = useCallback(
    (updated) => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === updated.id ? updated : t))
      );
    },
    [setTransactions]
  );

  // Reset data (dev helper already added previously)
  function handleReset() {
    const ok = confirm(
      "This will delete all your friends, transactions, and balances. Are you sure?"
    );
    if (!ok) return;
    resetSnapshot();
    window.location.reload();
  }

  function handleBackup() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      friends,
      selectedId,
      transactions,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bill-split-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const handleRestoreFile = useCallback(
    async (file) => {
      setRestoreFeedback(null);
      try {
        const raw = await file.text();
        const data = JSON.parse(raw);
        const { restoreSnapshot } = await import("./lib/restoreSnapshot");
        const {
          friends: safeFriends,
          transactions: restoredTransactions,
          selectedId: normalizedSelectedId,
          skippedTransactions,
        } = restoreSnapshot(data);

        replaceSnapshot({
          friends: safeFriends,
          selectedId: normalizedSelectedId,
          transactions: restoredTransactions,
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
      } catch (err) {
        const error =
          err instanceof Error
            ? err
            : new Error("Restore failed: unexpected payload");
        console.warn("Restore failed:", error);
        setRestoreFeedback({
          status: "error",
          message: `Restore failed: ${error.message}`,
        });
        throw error;
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
        <div className="row gap-8 flex-wrap">
          <nav className="row gap-8" aria-label="Primary navigation">
            <button
              type="button"
              className={activeView === "home" ? "button" : "btn-ghost"}
              onClick={() => setActiveView("home")}
            >
              Splits
            </button>
            <button
              type="button"
              className={activeView === "analytics" ? "button" : "btn-ghost"}
              onClick={() => setActiveView("analytics")}
            >
              Analytics
            </button>
          </nav>

          <span className="badge">React + Vite</span>

          {activeView === "home" && (
            <button
              className="button btn-ghost"
              onClick={openAnalytics}
              title="View analytics for all transactions"
            >
              Analytics
            </button>
          )}

          <button
            className="button btn-ghost"
            onClick={handleBackup}
            title="Export all data to a JSON file"
          >
            Backup
          </button>

          <button
            className="button btn-ghost"
            onClick={openRestoreModal}
            title="Import data from a JSON file"
          >
            Restore
          </button>

          <button
            className="button btn-ghost"
            onClick={handleReset}
            title="Clear all data and restart"
          >
            Reset Data
          </button>
        </div>
      </header>

      {activeView === "analytics" ? (
        <AnalyticsPanel state={storeSnapshot} onNavigateHome={navigateHome} />
      ) : (
        <div className="layout">
          <FriendsPanel
            friends={friends}
            selectedFriendId={selectedId}
            balances={balances}
            onAddFriend={openAdd}
            onSelectFriend={selectFriend}
          />
          <TransactionsPanel
            friends={friends}
            selectedFriend={selectedFriend}
            selectedBalance={selectedBalance}
            friendsById={friendsById}
            transactions={friendTx}
            txFilter={txFilter}
            categories={CATEGORIES}
            onSplit={handleSplit}
            onSettle={handleSettle}
            onFilterChange={setTxFilter}
            onClearFilter={() => setTxFilter("All")}
            onRequestEdit={handleRequestEdit}
            onDeleteTransaction={handleDeleteTx}
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

      {showAdd && (
        <Suspense fallback={null}>
          <AddFriendModal onClose={closeAdd} onCreate={handleCreateFriend} />
        </Suspense>
      )}

      {editTx && (
        <Suspense fallback={null}>
          <EditTransactionModal
            tx={editTx}
            friend={
              friendsById.get(editTx.effect?.friendId || editTx.friendId) || null
            }
            onClose={() => setEditTx(null)}
            onSave={handleSaveEditedTx}
          />
        </Suspense>
      )}
    </div>
  );
}
