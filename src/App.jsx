import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import "./index.css";
import FriendList from "./components/FriendList";
import SplitForm from "./components/SplitForm";
import AddFriendModal from "./components/AddFriendModal";
import Balances from "./components/Balances";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import TransactionList from "./components/TransactionList";
import EditTransactionModal from "./components/EditTransactionModal";
import { loadState, saveState, clearState } from "./lib/storage";
import { CATEGORIES } from "./lib/categories";
import { computeBalances } from "./lib/compute";
import { roundToCents } from "./lib/money";
import {
  buildSplitTransaction,
  getTransactionEffects,
  transactionIncludesFriend,
  upgradeTransactions,
} from "./lib/transactions";

function parseV2SplitTransaction(transaction, base, helpers) {
  const { stableId, friendIdSet } = helpers;
  const sanitized = [];
  const seen = new Set();

  for (const part of transaction.participants) {
    if (!part || typeof part !== "object") continue;
    let pid = part.id;
    if (typeof pid === "string") pid = pid.trim();
    if (!pid) continue;
    if (pid !== "you") {
      pid = stableId(pid);
      if (!friendIdSet.has(pid)) {
        console.warn("Skipping participant with unknown friend id during restore");
        continue;
      }
    }
    if (seen.has(pid)) continue;
    const amount = roundToCents(part.amount ?? 0);
    sanitized.push({ id: pid === "you" ? "you" : pid, amount });
    seen.add(pid);
  }

  if (!sanitized.find((p) => p.id === "you")) {
    sanitized.unshift({ id: "you", amount: 0 });
  }

  const friendParts = sanitized.filter((p) => p.id !== "you");
  if (friendParts.length === 0) {
    throw new Error("Split is missing friend participants");
  }

  const rawTotal = Number(transaction.total);
  let total =
    Number.isFinite(rawTotal) && rawTotal > 0 ? roundToCents(rawTotal) : null;
  const friendsSum = roundToCents(
    friendParts.reduce((acc, p) => acc + p.amount, 0)
  );
  const youIndex = sanitized.findIndex((p) => p.id === "you");
  const yourShare = roundToCents(
    total !== null ? total - friendsSum : Math.max(-friendsSum, 0)
  );
  if (yourShare < 0) {
    throw new Error("Participant shares exceed total amount");
  }
  sanitized[youIndex].amount = yourShare;
  const computedTotal = roundToCents(friendsSum + yourShare);
  if (total === null) {
    total = computedTotal;
  }
  if (computedTotal !== total) {
    throw new Error("Participant shares do not match total");
  }

  const rawPayer =
    typeof transaction.payer === "string" ? transaction.payer.trim() : "you";
  let payer = "you";
  if (rawPayer === "you" || !rawPayer) {
    payer = "you";
  } else if (rawPayer === "friend" && friendParts.length === 1) {
    payer = friendParts[0].id;
  } else {
    const mapped = stableId(rawPayer);
    if (friendParts.some((p) => p.id === mapped)) {
      payer = mapped;
    }
  }
  if (friendParts.length > 1 && payer !== "you") {
    payer = "you";
  }

  return buildSplitTransaction({
    ...base,
    total,
    payer,
    participants: sanitized,
  });
}

function parseV1SplitTransaction(transaction, base, helpers) {
  const { stableId, friendIdSet } = helpers;
  const friendId =
    typeof transaction.friendId === "string"
      ? stableId(transaction.friendId)
      : null;
  if (!friendId || !friendIdSet.has(friendId)) {
    throw new Error("Split references an unknown friend");
  }

  const rawTotal = Number(transaction.total);
  const total =
    Number.isFinite(rawTotal) && rawTotal > 0 ? roundToCents(rawTotal) : 0;
  if (total <= 0) throw new Error("Split total must be positive");

  const rawHalf = Number(transaction.half);
  const friendShare =
    Number.isFinite(rawHalf) && rawHalf >= 0
      ? roundToCents(rawHalf)
      : roundToCents(total / 2);
  const yourShare = roundToCents(Math.max(total - friendShare, 0));

  const rawPayer =
    typeof transaction.payer === "string" ? transaction.payer.trim() : "you";
  const payer = rawPayer === "friend" ? friendId : "you";

  return buildSplitTransaction({
    ...base,
    total,
    payer,
    participants: [
      { id: "you", amount: yourShare },
      { id: friendId, amount: friendShare },
    ],
  });
}

function parseSettlementTransaction(transaction, base, helpers) {
  const { stableId, friendIdSet } = helpers;
  const friendId =
    typeof transaction.friendId === "string"
      ? stableId(transaction.friendId)
      : null;
  if (!friendId || !friendIdSet.has(friendId)) {
    throw new Error("Settlement references an unknown friend");
  }

  const rawDelta = Number(transaction.delta);
  const delta = Number.isFinite(rawDelta) ? roundToCents(rawDelta) : 0;

  return {
    id: base.id,
    type: "settlement",
    friendId,
    total: null,
    payer: null,
    participants: [
      { id: "you", amount: delta < 0 ? Math.abs(delta) : 0 },
      { id: friendId, amount: delta > 0 ? delta : 0 },
    ],
    effects: [{ friendId, delta, share: Math.abs(delta) }],
    friendIds: [friendId],
    category: base.category,
    note: base.note,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
  };
}

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
        const effects = getTransactionEffects(t);
        const effect = effects.find((e) => e.friendId === selectedId) || null;
        return effect ? { ...t, effect } : null;
      })
      .filter(Boolean);
  }, [transactions, selectedId]);

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
        const friendIdSet = new Set(safeFriends.map((f) => f.id));

        for (const t of data.transactions.filter(Boolean)) {
          const debugContext = {};
          try {
            const normalizedType =
              t.type === "settlement" ? "settlement" : "split";
            debugContext.type = normalizedType;
            debugContext.format =
              normalizedType === "split"
                ? Array.isArray(t.participants)
                  ? "v2"
                  : "v1"
                : "settlement";

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
                );
              } else {
                category = canonicalCategory;
              }
            }

            const baseId = stableId(t.id);
            debugContext.id = baseId;
            const createdAt = t.createdAt ?? new Date().toISOString();
            const updatedAt = t.updatedAt ?? null;
            const note = String(t.note ?? "");

            const base = { id: baseId, category, note, createdAt, updatedAt };
            const helpers = { stableId, friendIdSet };

            let parsedTx;
            if (normalizedType === "split") {
              parsedTx = Array.isArray(t.participants)
                ? parseV2SplitTransaction(t, base, helpers)
                : parseV1SplitTransaction(t, base, helpers);
            } else {
              parsedTx = parseSettlementTransaction(t, base, helpers);
            }

            safeTransactions.push(parsedTx);
          } catch (transactionError) {
            console.warn("Skipping transaction during restore:", {
              error:
                transactionError instanceof Error
                  ? transactionError.message
                  : String(transactionError),
              context: debugContext,
            });
            skippedTransactions.push({
              transaction: t,
              reason:
                transactionError instanceof Error
                  ? transactionError.message
                  : String(transactionError),
            });
          }
        }

        const upgradedTransactions = upgradeTransactions(safeTransactions);

        // Εφάρμοσε στο state
        const normalizedSelectedId = data.selectedId
          ? stableId(data.selectedId)
          : null;

        setFriends(safeFriends);
        setTransactions(upgradedTransactions);
        setSelectedId(normalizedSelectedId);

        // Αποθήκευση & ενημέρωση UI
        saveState({
          friends: safeFriends,
          transactions: upgradedTransactions,
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
        <AnalyticsDashboard
          state={storeSnapshot}
          transactions={transactions}
          onNavigateHome={navigateHome}
        />
      ) : (
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

                <SplitForm
                  friends={friends}
                  defaultFriendId={selectedFriend?.id ?? null}
                  onSplit={handleSplit}
                />

                <div className="spacer-md" aria-hidden="true" />
                <TransactionList
                  friend={selectedFriend}
                  friendsById={friendsById}
                  transactions={friendTx}
                  onRequestEdit={handleRequestEdit}
                  onDelete={handleDeleteTx}
                />
              </>
            )}
          </section>
        </div>
      )}

      {showAdd && (
        <AddFriendModal onClose={closeAdd} onCreate={handleCreateFriend} />
      )}

      {editTx && (
        <EditTransactionModal
          tx={editTx}
          friend={
            friendsById.get(editTx.effect?.friendId || editTx.friendId) || null
          }
          onClose={() => setEditTx(null)}
          onSave={handleSaveEditedTx}
        />
      )}
    </div>
  );
}
