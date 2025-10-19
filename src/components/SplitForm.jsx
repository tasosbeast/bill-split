import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { CATEGORIES } from "../lib/categories";
import { formatEUR, roundToCents } from "../lib/money";
import { buildSplitTransaction } from "../lib/transactions";

const YOU_ID = "you";

function parseAmount(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return roundToCents(num);
}

export default function SplitForm({ friends, defaultFriendId, onSplit }) {
  const [bill, setBill] = useState("");
  const [payer, setPayer] = useState(YOU_ID);
  const [category, setCategory] = useState("Other");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [participants, setParticipants] = useState(() => {
    const initial = [{ id: YOU_ID, amount: "" }];
    if (defaultFriendId) {
      initial.push({ id: defaultFriendId, amount: "" });
    }
    return initial;
  });
  const [addFriendId, setAddFriendId] = useState("");

  const friendsById = useMemo(() => {
    const map = new Map();
    for (const f of friends) {
      map.set(f.id, f);
    }
    return map;
  }, [friends]);

  const participantIds = useMemo(
    () => new Set(participants.map((p) => p.id)),
    [participants]
  );

  useEffect(() => {
    setParticipants(() => {
      const next = [{ id: YOU_ID, amount: "" }];
      if (defaultFriendId) {
        next.push({ id: defaultFriendId, amount: "" });
      }
      return next;
    });
    setPayer(YOU_ID);
    setError("");
    setAddFriendId("");
  }, [defaultFriendId]);

  const selectableFriends = useMemo(
    () => friends.filter((f) => !participantIds.has(f.id)),
    [friends, participantIds]
  );

  const totalNumber = useMemo(() => {
    const parsed = Number(bill);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return roundToCents(parsed);
  }, [bill]);

  const totalParticipants = participants.length;

  const sumOfInputs = useMemo(() => {
    let sum = 0;
    for (const p of participants) {
      const parsed = parseAmount(p.amount);
      if (parsed !== null) sum += parsed;
    }
    return roundToCents(sum);
  }, [participants]);

  const canSplitEvenly = totalNumber !== null && totalParticipants > 0;

  function updateParticipant(id, value) {
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, amount: value } : p))
    );
  }

  function removeParticipant(id) {
    if (id === YOU_ID) return;
    setParticipants((prev) => prev.filter((p) => p.id !== id));
    setPayer((prev) => (prev === id ? YOU_ID : prev));
  }

  function addParticipant(id) {
    if (!id || participantIds.has(id)) return;
    setParticipants((prev) => [...prev, { id, amount: "" }]);
    setAddFriendId("");
  }

  function handleAddFriend(e) {
    const id = e.target.value;
    if (!id) return;
    addParticipant(id);
  }

  function splitEvenly() {
    if (!canSplitEvenly) return;
    const perPerson = roundToCents(totalNumber / totalParticipants);
    let remainder = roundToCents(totalNumber - perPerson * totalParticipants);
    setParticipants((prev) =>
      prev.map((p, index) => {
        const extra = index === 0 ? remainder : 0;
        const amount = perPerson + extra;
        return { ...p, amount: amount.toFixed(2) };
      })
    );
  }

  function normalizeParticipants(total) {
    const rawYou = participants.find((p) => p.id === YOU_ID);
    const youAmountInput = parseAmount(rawYou?.amount ?? "");
    const friendEntries = participants.filter((p) => p.id !== YOU_ID);

    if (friendEntries.length === 0) {
      setError("Add at least one friend to split the bill.");
      return null;
    }

    const friendParts = friendEntries.map((p) => ({
      id: p.id,
      amount: parseAmount(p.amount) ?? 0,
    }));

    const friendTotal = roundToCents(
      friendParts.reduce((acc, p) => acc + (p.amount || 0), 0)
    );

    let yourShare;
    if (youAmountInput !== null) {
      yourShare = youAmountInput;
    } else {
      yourShare = roundToCents(total - friendTotal);
    }

    if (yourShare < 0) {
      setError("Friend shares exceed the total amount.");
      return null;
    }

    const sum = roundToCents(friendTotal + yourShare);
    if (Math.abs(sum - total) > 0.01) {
      setError("Shares must add up to the total bill.");
      return null;
    }

    return [
      { id: YOU_ID, amount: yourShare },
      ...friendParts,
    ];
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const rawTotal = parseAmount(bill);
    if (rawTotal === null || rawTotal <= 0) {
      setError("Enter a valid total amount.");
      return;
    }

    const normalizedParticipants = normalizeParticipants(rawTotal);
    if (!normalizedParticipants) return;

    const friendIds = normalizedParticipants
      .map((p) => p.id)
      .filter((id) => id !== YOU_ID);

    if (friendIds.length === 0) {
      setError("Add at least one friend to split the bill.");
      return;
    }

    const allowedPayers = new Set([YOU_ID, ...friendIds]);
    let nextPayer = payer;
    if (!allowedPayers.has(nextPayer)) {
      nextPayer = YOU_ID;
    }

    if (friendIds.length > 1 && nextPayer !== YOU_ID) {
      setError("Group splits must be paid by you.");
      return;
    }

    const transaction = buildSplitTransaction({
      total: rawTotal,
      payer: nextPayer,
      participants: normalizedParticipants,
      category,
      note: note.trim(),
    });

    onSplit(transaction);

    setBill("");
    setNote("");
    setCategory("Other");
    setPayer(YOU_ID);
    setParticipants(() => {
      const next = [{ id: YOU_ID, amount: "" }];
      if (defaultFriendId) {
        next.push({ id: defaultFriendId, amount: "" });
      }
      return next;
    });
    setAddFriendId("");
    setError("");
  }

  return (
    <form onSubmit={handleSubmit} className="list list-gap-md">
      <div>
        <label className="kicker" htmlFor="bill">
          Total bill amount (€)
        </label>
        <input
          id="bill"
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={bill}
          onChange={(e) => setBill(e.target.value)}
          placeholder="e.g. 120.50"
          required
        />
        {totalNumber !== null && (
          <div className="helper">
            Total: {formatEUR(totalNumber)}
          </div>
        )}
      </div>

      <div>
        <div className="row justify-between">
          <label className="kicker">Participants</label>
          <button
            type="button"
            className="btn-ghost"
            onClick={splitEvenly}
            disabled={!canSplitEvenly}
          >
            Split evenly
          </button>
        </div>

        <div className="list list-gap-sm">
          {participants.map((p) => {
            const friend = friendsById.get(p.id);
            const label =
              p.id === YOU_ID ? "You" : friend ? friend.name : "Unknown";
            const subtitle =
              p.id === YOU_ID
                ? "Leave blank to cover whatever remains"
                : friend?.email;
            return (
              <div
                key={p.id}
                className="list-item"
                style={{ cursor: "default" }}
              >
                <div>
                  <div className="fw-600">{label}</div>
                  {subtitle && <div className="kicker">{subtitle}</div>}
                </div>
                <div className="row gap-8">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.amount}
                    onChange={(e) => updateParticipant(p.id, e.target.value)}
                    placeholder={p.id === YOU_ID ? "auto" : "0.00"}
                  />
                  {p.id !== YOU_ID && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeParticipant(p.id)}
                      title="Remove from this split"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {selectableFriends.length > 0 && (
          <select
            className="select"
            value={addFriendId}
            onChange={handleAddFriend}
          >
            <option value="">Add friend…</option>
            {selectableFriends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}

        {totalNumber !== null && (
          <div className="helper">
            Enter each share so they add up to {formatEUR(totalNumber)}.
            Current sum: {formatEUR(sumOfInputs)}
          </div>
        )}
      </div>

      <div>
        <label className="kicker">Who paid the bill?</label>
        <select
          className="select"
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
        >
          <option value={YOU_ID}>You</option>
          {participants
            .filter((p) => p.id !== YOU_ID)
            .map((p) => {
              const friend = friendsById.get(p.id);
              return (
                <option key={p.id} value={p.id}>
                  {friend ? friend.name : "Friend"}
                </option>
              );
            })}
        </select>
        {participants.filter((p) => p.id !== YOU_ID).length > 1 && (
          <div className="helper">
            Group splits can currently only be paid by you.
          </div>
        )}
      </div>

      <div>
        <label className="kicker">Category</label>
        <select
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="kicker" htmlFor="note">
          Note (optional)
        </label>
        <input
          id="note"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Groceries, rent, museum tickets…"
        />
      </div>

      {error && <div className="error">{error}</div>}

      <button className="button" type="submit">
        Save split
      </button>
    </form>
  );
}

SplitForm.propTypes = {
  friends: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string,
    })
  ).isRequired,
  defaultFriendId: PropTypes.string,
  onSplit: PropTypes.func.isRequired,
};
