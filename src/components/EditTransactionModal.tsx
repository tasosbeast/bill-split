import {
  useMemo,
  useState,
  type FormEvent,
  type ChangeEvent,
  type RefObject,
} from "react";
import Modal from "./Modal";
import { CATEGORIES } from "../lib/categories";
import { roundToCents } from "../lib/money";
import { buildSplitTransaction } from "../lib/transactions";
import type { StoredTransaction } from "../types/legacySnapshot";
import type { LegacyFriend } from "../types/legacySnapshot";

interface EditTransactionModalProps {
  tx: StoredTransaction;
  friend?: LegacyFriend | null;
  onClose: () => void;
  onSave: (transaction: StoredTransaction) => void;
}

function parseAmountInput(value: unknown): number | null {
  if (value === null || value === undefined || typeof value === "object")
    return null;
  const str =
    typeof value === "string" || typeof value === "number" ? String(value) : "";
  const trimmed = str.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return roundToCents(num);
}

export default function EditTransactionModal({
  tx,
  friend,
  onClose,
  onSave,
}: EditTransactionModalProps) {
  const isSplit = tx?.type === "split";
  const friendId = tx?.friendId || friend?.id || null;
  const hasMultipleFriends = useMemo(() => {
    if (Array.isArray(tx?.friendIds)) {
      return tx.friendIds.filter(Boolean).length > 1;
    }
    return false;
  }, [tx]);

  // Only one-on-one splits allow amount/payer editing; group splits lock amounts
  const simpleEditable = isSplit && friendId && !hasMultipleFriends;

  const initialTotal = isSplit && tx?.total ? String(tx.total) : "";
  const initialFriendShare = useMemo(() => {
    if (!simpleEditable) return "";
    // Try to extract share from effects array first
    const effect = Array.isArray(tx?.effects)
      ? tx.effects.find((e) => e.friendId === friendId)
      : null;
    const raw =
      typeof effect?.share === "number"
        ? effect.share
        : tx?.total
        ? tx.total / 2
        : 0;
    if (!raw) return "";
    return roundToCents(raw).toFixed(2);
  }, [simpleEditable, tx, friendId]);

  const [bill, setBill] = useState(initialTotal);
  const [friendShare, setFriendShare] = useState(initialFriendShare);
  const [payer, setPayer] = useState(() => {
    if (!simpleEditable) return "you";
    const raw = typeof tx?.payer === "string" ? tx.payer : "you";
    if (raw === "friend" && friendId) return friendId;
    if (raw === friendId || raw === "you") return raw;
    return "you";
  });
  const [category, setCategory] = useState(tx?.category || "Other");
  const [note, setNote] = useState(tx?.note || "");
  const [error, setError] = useState("");

  function validate(): {
    error: string;
    totalAmount?: number;
    friendAmount?: number;
    yourAmount?: number;
  } {
    // For group splits, we won't validate amounts (they're locked)
    if (!simpleEditable) return { error: "" };

    const totalAmount = parseAmountInput(bill);
    if (totalAmount === null || totalAmount <= 0) {
      return { error: "Enter a valid total amount." };
    }

    const friendAmount = parseAmountInput(friendShare);
    if (friendAmount === null) {
      return { error: "Enter your friend's share." };
    }

    if (friendAmount > totalAmount) {
      return { error: "Friend's share cannot exceed the total." };
    }

    const yourAmount = roundToCents(totalAmount - friendAmount);
    const sum = roundToCents(yourAmount + friendAmount);
    if (sum !== roundToCents(totalAmount)) {
      return { error: "Shares must add up exactly to the total." };
    }

    const allowedPayers = new Set(["you", friendId]);
    if (!allowedPayers.has(payer)) {
      return { error: "Invalid payer." };
    }

    return { error: "", totalAmount, friendAmount, yourAmount };
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const validation = validate();
    if (validation.error) {
      setError(validation.error);
      return;
    }

    setError("");

    if (!simpleEditable) {
      // Group split: only update metadata
      const updated: StoredTransaction = {
        ...tx,
        category,
        note: note.trim(),
        updatedAt: new Date().toISOString(),
      };
      onSave(updated);
      onClose();
      return;
    }

    const { totalAmount, friendAmount, yourAmount } = validation;
    if (
      totalAmount === undefined ||
      friendAmount === undefined ||
      yourAmount === undefined ||
      !friendId
    ) {
      setError("Invalid amounts or missing friend.");
      return;
    }

    const updated = buildSplitTransaction({
      id: tx.id,
      total: totalAmount,
      payer,
      participants: [
        { id: "you", amount: yourAmount },
        { id: friendId, amount: friendAmount },
      ],
      category,
      note: note.trim(),
      createdAt: tx.createdAt,
      updatedAt: new Date().toISOString(),
    });

    onSave(updated as StoredTransaction);
    onClose();
  }

  return (
    <Modal title="Edit transaction" onClose={onClose}>
      {({
        firstFieldRef,
      }: {
        firstFieldRef: RefObject<HTMLInputElement | null>;
      }) => (
        <form className="form-grid" onSubmit={handleSubmit}>
          {!isSplit && (
            <div className="error">Only split transactions can be edited.</div>
          )}
          {isSplit && !simpleEditable && (
            <div className="helper">
              Editing details only for group splits; amounts are locked.
            </div>
          )}

          <div>
            <label className="kicker" htmlFor="edit-total">
              Total bill amount (€)
            </label>
            <input
              id="edit-total"
              ref={firstFieldRef}
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={bill}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setBill(e.target.value)
              }
              disabled={!simpleEditable}
            />
          </div>

          <div>
            <label className="kicker" htmlFor="edit-share">
              {friend?.name ?? "Friend"}'s share (€)
            </label>
            <input
              id="edit-share"
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={friendShare}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setFriendShare(e.target.value)
              }
              disabled={!simpleEditable}
            />
            <div className="helper">
              Your share will adjust to match the total automatically.
            </div>
          </div>

          <div>
            <label className="kicker">Who paid?</label>
            <select
              className="select"
              value={payer}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setPayer(e.target.value)
              }
              disabled={!simpleEditable}
            >
              <option value="you">You</option>
              <option value={friendId ?? ""}>{friend?.name ?? "Friend"}</option>
            </select>
          </div>

          <div>
            <label className="kicker">Category</label>
            <select
              className="select"
              value={category}
              onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                setCategory(e.target.value)
              }
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="kicker" htmlFor="edit-note">
              Note
            </label>
            <input
              id="edit-note"
              className="input"
              value={note}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setNote(e.target.value)
              }
              placeholder="Describe the expense"
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="row justify-end gap-8">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={!isSplit}>
              Save
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
