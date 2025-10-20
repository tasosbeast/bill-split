import {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  Suspense,
  lazy,
} from "react";
import "./index.css";
import { loadState, saveState, clearState } from "./lib/storage";
import { CATEGORIES } from "./lib/categories";
import { computeBalances } from "./lib/compute";
import {
  getTransactionEffects,
  transactionIncludesFriend,
  upgradeTransactions,
} from "./lib/transactions";

const FriendList = lazy(() => import("./components/FriendList"));
const Balances = lazy(() => import("./components/Balances"));
const AddFriendModal = lazy(() => import("./components/AddFriendModal"));
const SplitForm = lazy(() => import("./components/SplitForm"));
const Transactions = lazy(() => import("./components/Transactions"));
const AnalyticsDashboard = lazy(() => import("./components/AnalyticsDashboard"));
const EditTransactionModal = lazy(() => import("./components/EditTransactionModal"));

const seededFriends = [
  { id: crypto.randomUUID(), name: "Valia", email: "valia@example.com" },
  { id: crypto.randomUUID(), name: "Nikos", email: "nikos@example.com" },
];

export default function App() {
  const boot = useRef(loadState()).current;
  const [friends, setFriends] = useState(() => boot?.friends ?? seededFriends);
  const [selectedId, setSelectedId] = useState(() => boot?.selectedId ?? null);
  const [transactions, setTransactions] = useState(() =>
    upgradeTransactions(boot?.transactions ?? [])
  );
  const [activeView, setActiveView] = useState("home");
  const [txFilter, setTxFilter] = useState("All");
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [restoreFeedback, setRestoreFeedback] = useState(null);

  useEffect(() => {
    saveState({ friends, selectedId, transactions });
  }, [friends, selectedId, transactions]);

  const selectedFriend = useMemo(() => {
    const f = friends.find((fr) => fr.id === selectedId) || null;
    return f;
  }, [friends, selectedId]);

  // Ensure selectedId always points to an existing friend
  useEffect(() => {
    if (selectedId && !friends.some((f) => f.id === selectedId)) {
      setSelectedId(null);
    }
  }, [friends, selectedId]);

  const friendsById = useMemo(() => {
    const map = new Map();
    for (const f of friends) {
      map.set(f.id, f);
    }
    return map;
  }, [friends]);

  const balances = useMemo(() => computeBalances(transactions), [transactions]);

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

  // Current balance for selected friend (for pill & settle button visibility)
  const selectedBalance = balances.get(selectedId) ?? 0;

  // Hidden input ref για Restore
  const fileInputRef = useRef(null);

  function handleSplit(tx) {
    setTransactions((prev) => [tx, ...prev]);
  }

  const openAdd = useCallback(() => setShowAdd(true), []);

  const closeAdd = useCallback(() => setShowAdd(false), []);

  const openAnalytics = useCallback(() => setActiveView("analytics"), []);

  const navigateHome = useCallback(() => setActiveView("home"), []);

  const normalizedFriendEmails = useMemo(
    () => new Set(friends.map((f) => (f.email ?? "").trim().toLowerCase())),
    [friends]
  );

  const handleCreateFriend = useCallback(
    (friend) => {
      const normalizedEmail = (friend?.email ?? "").trim().toLowerCase();
      if (normalizedFriendEmails.has(normalizedEmail)) {
        alert("A friend with this email already exists.");
        return;
      }
      setFriends((prev) => [...prev, friend]);
      setSelectedId(friend.id);
    },
    [normalizedFriendEmails]
  );

  function handleSettle() {
    if (!selectedId) return;
    const bal = balances.get(selectedId) ?? 0;
    if (bal === 0) return;

    const tx = {
      id: crypto.randomUUID(),
      type: "settlement",
      friendId: selectedId,
      total: null,
      payer: null,
      participants: [
        { id: "you", amount: Math.max(-bal, 0) },
        { id: selectedId, amount: Math.max(bal, 0) },
      ],
      effects: [
        {
          friendId: selectedId,
          delta: -bal,
          share: Math.abs(bal),
        },
      ],
      friendIds: [selectedId],
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);
  }
  const handleDeleteTx = useCallback((id) => {
    const ok = confirm("Delete this transaction permanently?");
    if (!ok) return;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }, []);
  // NEW: open edit modal
  const handleRequestEdit = useCallback((tx) => {
    setEditTx(tx);
  }, []);

  // NEW: save edited transaction
  const handleSaveEditedTx = useCallback((updated) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  }, []);

  // Reset data (dev helper already added previously)
  function handleReset() {
    const ok = confirm(
      "This will delete all your friends, transactions, and balances. Are you sure?"
    );
    if (!ok) return;
    clearState();
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

  function handleRestore(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // επιτρέπει επανα-επιλογή ίδιου αρχείου αργότερα
    if (!file) return;

    setRestoreFeedback(null);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        if (typeof reader.result !== "string") {
          throw new Error("Unexpected restore payload format");
        }
        const data = JSON.parse(reader.result);
        const { restoreSnapshot } = await import("./lib/restoreSnapshot.js");
        const {
          friends: safeFriends,
          transactions: restoredTransactions,
          selectedId: normalizedSelectedId,
          skippedTransactions,
        } = restoreSnapshot(data);

        setFriends(safeFriends);
        setTransactions(restoredTransactions);
        setSelectedId(normalizedSelectedId);

        saveState({
          friends: safeFriends,
          transactions: restoredTransactions,
          selectedId: normalizedSelectedId,
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
        console.warn("Restore failed:", err);
        setRestoreFeedback({
          status: "error",
          message: `Restore failed: ${err.message}`,
        });
      }
    };
    reader.readAsText(file);
  }

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
            onClick={() => fileInputRef.current?.click()}
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

        {/* Hidden file input for Restore */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleRestore}
        />
      </header>

      {activeView === "analytics" ? (
        <Suspense
          fallback={
            <section className="panel" aria-busy="true" aria-live="polite">
              <h2>Analytics</h2>
              <p className="kicker">Loading analytics dashboard…</p>
            </section>
          }
        >
          <AnalyticsDashboard
            state={storeSnapshot}
            onNavigateHome={navigateHome}
          />
        </Suspense>
      ) : (
        <div className="layout">
          <section className="panel">
            <h2>Friends</h2>
            <div className="row stack-sm">
              <button className="button" onClick={openAdd}>
                + Add friend
              </button>
            </div>
            <Suspense
              fallback={
                <div className="kicker" aria-live="polite">
                  Loading friends…
                </div>
              }
            >
              <FriendList
                friends={friends}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </Suspense>

            <div className="spacer-md" aria-hidden="true" />
            <h2>Balances</h2>
            <p className="kicker stack-tight">
              Positive = they owe you | Negative = you owe them
            </p>
            <Suspense
              fallback={
                <div className="kicker" aria-live="polite">
                  Loading balances…
                </div>
              }
            >
              <Balances
                friends={friends}
                balances={balances}
                onJumpTo={(id) => setSelectedId(id)}
              />
            </Suspense>
          </section>

          <section className="panel">
            <h2>Split a bill</h2>

            {!selectedFriend && (
              <p className="kicker">Choose a friend to start.</p>
            )}

            {selectedFriend && (
              <>
                <div className="row justify-between stack-sm">
                  <div className="row">
                    <div className="kicker">
                      Splitting with <strong>{selectedFriend.name}</strong>
                    </div>
                    <span
                      className={
                        selectedBalance > 0
                          ? "pill pill-pos"
                          : selectedBalance < 0
                          ? "pill pill-neg"
                          : "pill pill-zero"
                      }
                      title={
                        selectedBalance > 0
                          ? `${selectedFriend.name} owes you`
                          : selectedBalance < 0
                          ? `You owe ${selectedFriend.name}`
                          : "Settled"
                      }
                    >
                      {selectedBalance > 0
                        ? "\u2191"
                        : selectedBalance < 0
                        ? "\u2193"
                        : "\u2014"}{" "}
                      {Math.abs(selectedBalance).toLocaleString(undefined, {
                        style: "currency",
                        currency: "EUR",
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {selectedBalance !== 0 && (
                    <button
                      className="button btn-ghost"
                      onClick={handleSettle}
                      title="Zero out balance with this friend"
                    >
                      Settle up
                    </button>
                  )}
                </div>

                <Suspense
                  fallback={
                    <div className="kicker" aria-live="polite">
                      Loading split form…
                    </div>
                  }
                >
                  <SplitForm
                    friends={friends}
                    defaultFriendId={selectedFriend?.id ?? null}
                    onSplit={handleSplit}
                  />
                </Suspense>

                <div className="spacer-md" aria-hidden="true" />
                <div className="row justify-between">
                  <h2>Transactions</h2>
                  <div className="row gap-8">
                    <select
                      className="select w-180"
                      value={txFilter}
                      onChange={(e) => setTxFilter(e.target.value)}
                      title="Filter by category"
                    >
                      <option value="All">All</option>
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    {txFilter !== "All" && (
                      <button
                        className="btn-ghost"
                        onClick={() => setTxFilter("All")}
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                </div>
                <Suspense
                  fallback={
                    <div className="kicker" aria-live="polite">
                      Loading transactions…
                    </div>
                  }
                >
                  <Transactions
                    friend={selectedFriend}
                    friendsById={friendsById}
                    items={friendTx}
                    onRequestEdit={handleRequestEdit}
                    onDelete={handleDeleteTx}
                  />
                </Suspense>
              </>
            )}
          </section>
        </div>
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
