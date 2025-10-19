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
  const [restoreFeedback, setRestoreFeedback] = useState(null);

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

  const openAdd = useCallback(() => setShowAdd(true), []);

  const closeAdd = useCallback(() => setShowAdd(false), []);

  const normalizedFriendEmails = useMemo(
    () =>
      new Set(
        friends.map((f) => (f.email ?? "").trim().toLowerCase())
      ),
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
      half: Math.abs(bal),
      delta: -bal,
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
        // Build a normalized, case-insensitive category index
        const categoryIndex = new Map(
          CATEGORIES.map((c) => {
            const label =
              typeof c === "string" ? c : c.value ?? c.name ?? String(c);
            return [label.trim().toLowerCase(), label];
          })
        );
        const allowedPayers = new Set(["you", "friend"]);

        const emailIndex = new Map();
        const safeFriends = [];
        for (const f of data.friends) {
          const id = stableId(f.id);
          const name = String(f.name ?? "").trim() || "Friend";
          const email = String(f.email ?? "").trim().toLowerCase();
          const tag = f.tag ?? "friend";

          if (email && emailIndex.has(email)) {
            const existing = emailIndex.get(email);
            console.warn(
              "Merging duplicate friend by email during restore:",
              { kept: existing, dropped: { id, name, email, tag } },
            );
            // Skip adding duplicate friend; stableId mapping already ensures consistent ids for references
            continue;
          }

          const friend = { id, name, email, tag };
          safeFriends.push(friend);
          if (email) emailIndex.set(email, friend);
        }

        const safeTransactions = [];
        const skippedTransactions = [];

        for (const t of data.transactions.filter(Boolean)) {
          try {
            const normalizedType =
              t.type === "settlement" ? "settlement" : "split";
            const isSplit = normalizedType === "split";

            const rawCategory =
              typeof t.category === "string" ? t.category.trim() : "";
            let category = "Other";
            if (rawCategory) {
              const normalizedCategory = rawCategory.toLowerCase();
              const canonicalCategory = categoryIndex.get(normalizedCategory);
              if (!canonicalCategory) {
                console.warn(
                  "Unknown category during restore, defaulting to 'Other':",
                  rawCategory,
                  t,
                );
              } else {
                category = canonicalCategory;
              }
            }

            let payer = null;
            if (isSplit) {
              const rawPayer = typeof t.payer === "string" ? t.payer : "";
              const normPayer = rawPayer.trim().toLowerCase();
              payer = normPayer || "you";
              if (!allowedPayers.has(payer)) {
                console.warn(
                  `Unknown payer "${rawPayer}", defaulting to "you"`,
                  t,
                );
                payer = "you";
              }
            }

            const parsedTotal = isSplit ? Number(t.total) : null;
            const safeTotal = isSplit
              ? Number.isFinite(parsedTotal) && parsedTotal > 0
                ? parsedTotal
                : 0
              : null;
            const parsedHalf = Number(t.half);
            const half = isSplit
              ? Number.isFinite(parsedHalf) && parsedHalf >= 0
                ? parsedHalf
                : safeTotal / 2
              : Math.abs(Number.isFinite(parsedHalf) ? parsedHalf : 0);
            const parsedDelta = Number(t.delta);
            const delta = Number.isFinite(parsedDelta) ? parsedDelta : 0;

            safeTransactions.push({
              id: stableId(t.id),
              type: normalizedType,
              friendId: stableId(t.friendId),
              total: isSplit ? safeTotal : null,
              payer,
              half,
              delta,
              category,
              note: String(t.note ?? ""),
              createdAt: t.createdAt ?? new Date().toISOString(),
              updatedAt: t.updatedAt ?? null,
            });
          } catch (transactionError) {
            console.warn(
              "Skipping transaction during restore:",
              transactionError,
              t,
            );
            skippedTransactions.push({
              transaction: t,
              reason:
                transactionError instanceof Error
                  ? transactionError.message
                  : String(transactionError),
            });
          }
        }

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

        setRestoreFeedback(
          skippedTransactions.length > 0
            ? {
                status: "warning",
                message: `${skippedTransactions.length} transaction(s) were skipped during restore. Check console for details.`,
              }
            : {
                status: "success",
                message: "Restore completed successfully!",
              },
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
        <div className="row gap-8">
          <span className="badge">React + Vite</span>

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

      <div className="layout">
        <section className="panel">
          <h2>Friends</h2>
          <div className="row stack-sm">
            <button className="button" onClick={openAdd}>
              + Add friend
            </button>
          </div>
          <FriendList
            friends={friends}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <div className="spacer-md" aria-hidden="true" />
          <h2>Balances</h2>
          <p className="kicker stack-tight">
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

              <SplitForm friend={selectedFriend} onSplit={handleSplit} />

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
