import { useEffect, useMemo, useState } from "react";
import "./index.css";
import FriendList from "./components/FriendList";
import SplitForm from "./components/SplitForm";
import AddFriendModal from "./components/AddFriendModal";
import Balances from "./components/Balances";
import Transactions from "./components/Transactions";
import { loadState, saveState } from "./lib/storage";
import { clearState } from "./lib/storage";

const seededFriends = [
  { id: crypto.randomUUID(), name: "Valia", email: "valia@example.com" },
  { id: crypto.randomUUID(), name: "Nikos", email: "nikos@example.com" },
];

export default function App() {
  // Load once from localStorage
  const boot = loadState();

  const [friends, setFriends] = useState(boot?.friends ?? seededFriends);
  const [selectedId, setSelectedId] = useState(boot?.selectedId ?? null);
  const [transactions, setTransactions] = useState(boot?.transactions ?? []);
  const [showAdd, setShowAdd] = useState(false);

  // Save on changes (debounced by the event loop; fine for this scale)
  useEffect(() => {
    saveState({ friends, selectedId, transactions });
  }, [friends, selectedId, transactions]);

  const selectedFriend = useMemo(
    () => friends.find((f) => f.id === selectedId) || null,
    [friends, selectedId]
  );

  const balances = useMemo(() => {
    const m = new Map();
    for (const t of transactions) {
      m.set(t.friendId, (m.get(t.friendId) || 0) + t.delta);
    }
    return m;
  }, [transactions]);

  const friendTx = useMemo(
    () =>
      selectedId ? transactions.filter((t) => t.friendId === selectedId) : [],
    [transactions, selectedId]
  );

  function handleSplit(tx) {
    setTransactions((prev) => [tx, ...prev]);
  }

  function openAdd() {
    setShowAdd(true);
  }
  function closeAdd() {
    setShowAdd(false);
  }

  function handleCreateFriend(friend) {
    const exists = friends.some((f) => f.email.toLowerCase() === friend.email);
    if (exists) {
      alert("A friend with this email already exists.");
      return;
    }
    setFriends((prev) => [...prev, friend]);
    setSelectedId(friend.id);
  }

  function handleReset() {
    const ok = confirm(
      "This will delete all your friends, transactions, and balances. Are you sure?"
    );
    if (!ok) return;
    clearState();
    // Hard reload to get fresh initial state
    window.location.reload();
  }

  function handleSettle() {
    if (!selectedId) return;
    // Υπολογίζουμε το τρέχον υπόλοιπο για τον επιλεγμένο φίλο
    const balMap = new Map();
    for (const t of transactions) {
      balMap.set(t.friendId, (balMap.get(t.friendId) || 0) + t.delta);
    }
    const bal = balMap.get(selectedId) || 0;
    if (bal === 0) return;

    // Καταχωρούμε “settlement”: αντίθετο πρόσημο για να μηδενίσει
    const tx = {
      id: crypto.randomUUID(),
      type: "settlement",
      friendId: selectedId,
      total: null,
      payer: null,
      half: Math.abs(bal), // πληροφοριακά
      delta: -bal, // ακυρώνει το υπόλοιπο
      createdAt: new Date().toISOString(),
    };

    setTransactions((prev) => [tx, ...prev]);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">Bill Split</div>
        <div className="row" style={{ gap: 8 }}>
          <span className="badge">React + Vite</span>
          <button
            className="button"
            style={{
              background: "transparent",
              borderColor: "var(--border)",
              fontSize: 12,
              padding: "6px 10px",
            }}
            onClick={handleReset}
            title="Clear all data and restart"
          >
            Reset Data
          </button>
        </div>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>Friends</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="button" onClick={openAdd}>
              + Add friend
            </button>
          </div>
          <FriendList
            friends={friends}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <div style={{ height: 16 }} />
          <h2>Balances</h2>
          <p className="kicker" style={{ marginBottom: 8 }}>
            Positive = they owe you • Negative = you owe them
          </p>
          <Balances
            friends={friends}
            balances={balances}
            onJumpTo={(id) => setSelectedId(id)}
          />
        </section>

        <section className="panel">
          <h2>Split a bill</h2>

          {!selectedFriend && (
            <p className="kicker">Choose a friend to start.</p>
          )}

          {selectedFriend && (
            <>
              <div
                className="row"
                style={{
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div className="kicker">
                  Splitting with <strong>{selectedFriend.name}</strong>
                </div>
                <button
                  className="button"
                  style={{
                    background: "transparent",
                    borderColor: "var(--border)",
                    fontSize: 13,
                    padding: "6px 10px",
                  }}
                  onClick={handleSettle}
                  title="Zero out balance with this friend"
                >
                  Settle up
                </button>
              </div>

              <SplitForm friend={selectedFriend} onSplit={handleSplit} />

              <div style={{ height: 16 }} />
              <h2>Transactions</h2>
              <Transactions friend={selectedFriend} items={friendTx} />
            </>
          )}
        </section>
      </div>

      {showAdd && (
        <AddFriendModal onClose={closeAdd} onCreate={handleCreateFriend} />
      )}
    </div>
  );
}
