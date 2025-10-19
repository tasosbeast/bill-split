import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import "./index.css";
import FriendList from "./components/FriendList";
import SplitForm from "./components/SplitForm";
import AddFriendModal from "./components/AddFriendModal";
import Balances from "./components/Balances";
import Transactions from "./components/Transactions";
import EditTransactionModal from "./components/EditTransactionModal";
import { loadState, saveState, clearState } from "./lib/storage";
import { CATEGORIES } from "./lib/categories";
import { computeBalances } from "./lib/compute";

const seededFriends = [
  { id: crypto.randomUUID(), name: "Valia", email: "valia@example.com" },
  { id: crypto.randomUUID(), name: "Nikos", email: "nikos@example.com" },
];

export default function App() {
  const boot = useRef(loadState()).current;
  const [friends, setFriends] = useState(() => boot?.friends ?? seededFriends);
  const [selectedId, setSelectedId] = useState(() => boot?.selectedId ?? null);
  const [transactions, setTransactions] = useState(
    () => boot?.transactions ?? []
  );
  const [showAdd, setShowAdd] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [txFilter, setTxFilter] = useState("All");

  useEffect(() => {
    saveState({ friends, selectedId, transactions });
  }, [friends, selectedId, transactions]);

  const selectedFriend = useMemo(
    () => friends.find((f) => f.id === selectedId) || null,
    [friends, selectedId]
  );

  const balances = useMemo(() => computeBalances(transactions), [transactions]);

  const friendTx = useMemo(() => {
    const base = selectedId
      ? transactions.filter((t) => t.friendId === selectedId)
      : [];
    if (txFilter === "All") return base;
    return base.filter((t) => (t.category ?? "Other") === txFilter);
  }, [transactions, selectedId, txFilter]);

  // Current balance for selected friend (for pill & settle button visibility)
  const selectedBalance = balances.get(selectedId) ?? 0;

  // Hidden input ref για Restore
  const fileInputRef = useRef(null);

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
      half: Math.abs(bal),
      delta: -bal,
      createdAt: new Date().toISOString(),
    };
    setTransactions((prev) => [tx, ...prev]);
  }

  // NEW: delete a transaction
  function handleDeleteTx(id) {
    const ok = confirm("Delete this transaction permanently?");
    if (!ok) return;
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  // NEW: open edit modal
  function handleRequestEdit(tx) {
    setEditTx(tx);
  }

  // NEW: save edited transaction
  function handleSaveEditedTx(updated) {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  }

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

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        // Σούπερ απλό validation: περιμένουμε arrays & σωστούς τύπους
        if (!data || typeof data !== "object")
          throw new Error("Invalid JSON root");
        if (!Array.isArray(data.friends)) throw new Error("Missing friends[]");
        if (!Array.isArray(data.transactions))
          throw new Error("Missing transactions[]");
        if (data.selectedId !== null && typeof data.selectedId !== "string") {
          throw new Error("selectedId must be null or string");
        }

        // Optional: καθάρισε ids που λείπουν ή λάθος types
        const idMap = new Map();
        function stableId(id) {
          if (typeof id === "string") return id;
          if (idMap.has(id)) return idMap.get(id);
          const newId = crypto.randomUUID();
          idMap.set(id, newId);
          return newId;
        }
        const safeFriends = data.friends.map((f) => ({
          id: stableId(f.id),
          name: String(f.name ?? "").trim() || "Friend",
          email: String(f.email ?? "").trim() || "",
          tag: f.tag ?? "friend",
        }));

        const safeTransactions = data.transactions.filter(Boolean).map((t) => ({
          id: stableId(t.id),
          type: t.type === "settlement" ? "settlement" : "split",
          friendId: stableId(t.friendId),
          total: t.type === "split" ? Number(t.total ?? 0) : null,
          payer:
            t.type === "split"
              ? t.payer === "friend"
                ? "friend"
                : "you"
              : null,
          half:
            t.type === "split"
              ? Number(t.half ?? Number(t.total ?? 0) / 2)
              : Math.abs(Number(t.half ?? 0)),
          delta: Number(t.delta ?? 0),
          category: t.category ?? "Other",
          note: String(t.note ?? ""),
          createdAt: t.createdAt ?? new Date().toISOString(),
          updatedAt: t.updatedAt ?? null,
        }));

        // Εφάρμοσε στο state
        setFriends(safeFriends);
        setTransactions(safeTransactions);
        setSelectedId(data.selectedId ?? null);

        // Αποθήκευση & ενημέρωση UI
        saveState({
          friends: safeFriends,
          transactions: safeTransactions,
          selectedId: data.selectedId ?? null,
        });

        alert("Restore completed successfully!");
      } catch (err) {
        console.warn("Restore failed:", err);
        alert("Restore failed: " + err.message);
      }
    };
    reader.readAsText(file);
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
            onClick={handleBackup}
            title="Export all data to a JSON file"
          >
            Backup
          </button>

          <button
            className="button"
            style={{
              background: "transparent",
              borderColor: "var(--border)",
              fontSize: 12,
              padding: "6px 10px",
            }}
            onClick={() => fileInputRef.current?.click()}
            title="Import data from a JSON file"
          >
            Restore
          </button>

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

        {/* Hidden file input for Restore */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleRestore}
        />
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
            Positive = they owe you | Negative = you owe them
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
                <div className="row" style={{ alignItems: "center", gap: 10 }}>
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
                )}
              </div>

              <SplitForm friend={selectedFriend} onSplit={handleSplit} />

              <div style={{ height: 16 }} />
              <div
                className="row"
                style={{
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <h2>Transactions</h2>
                <div className="row" style={{ gap: 8 }}>
                  <select
                    className="select"
                    value={txFilter}
                    onChange={(e) => setTxFilter(e.target.value)}
                    style={{ width: 180 }}
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
                      className="button-ghost"
                      onClick={() => setTxFilter("All")}
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              </div>
              <Transactions
                friend={selectedFriend}
                items={friendTx}
                onRequestEdit={handleRequestEdit}
                onDelete={handleDeleteTx}
              />
            </>
          )}
        </section>
      </div>

      {showAdd && (
        <AddFriendModal onClose={closeAdd} onCreate={handleCreateFriend} />
      )}

      {editTx && (
        <EditTransactionModal
          tx={editTx}
          friend={friends.find((f) => f.id === editTx.friendId)}
          onClose={() => setEditTx(null)}
          onSave={handleSaveEditedTx}
        />
      )}
    </div>
  );
}
