import PropTypes from "prop-types";
import { useState } from "react";
import Modal from "./Modal";
import { CATEGORIES } from "../lib/categories";

export default function EditTransactionModal({ tx, friend, onClose, onSave }) {
  // Μόνο split επιτρέπεται να επεξεργαστεί
  const isSplit = tx?.type === "split";
  const [bill, setBill] = useState(isSplit ? String(tx.total ?? "") : "");
  const [payer, setPayer] = useState(isSplit ? tx.payer : "you");
  const [err, setErr] = useState("");
  const [category, setCategory] = useState(
    isSplit ? tx.category || "Other" : tx.category || "Other"
  );
  const [note, setNote] = useState(tx.note || "");

  function validate() {
    if (!isSplit) return "Only split transactions can be edited.";
    const num = parseFloat(bill);
    if (isNaN(num) || num <= 0) return "Enter a valid total amount.";
    if (payer !== "you" && payer !== "friend") return "Invalid payer.";
    return "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);

    const total = parseFloat(bill);
    const half = total / 2;
    const delta = payer === "you" ? half : -half;

    const updated = {
      ...tx,
      type: "split",
      total,
      half,
      payer,
      delta,
      category,
      note: note.trim() || "",
      updatedAt: new Date().toISOString(),
    };
    onSave(updated);
    onClose();
  }

  return (
    <Modal title="Edit transaction" onClose={onClose}>
      {({ firstFieldRef }) => (
        <form className="form-grid" onSubmit={handleSubmit}>
          {!isSplit && (
            <div className="error">
              Only split transactions can be edited. Settlements are immutable.
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
              onChange={(e) => setBill(e.target.value)}
              disabled={!isSplit}
            />
          </div>

          <div>
            <label className="kicker">Who paid?</label>
            <select
              className="select"
              value={payer}
              onChange={(e) => setPayer(e.target.value)}
              disabled={!isSplit}
            >
              <option value="you">You</option>
              <option value="friend">{friend?.name ?? "Friend"}</option>
            </select>
            <div className="helper">
              Editing recalculates the half and the signed balance impact.
            </div>
          </div>

          <div>
            <label className="kicker">Category</label>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={!isSplit}
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
              onChange={(e) => setNote(e.target.value)}
              placeholder="Describe the expense"
              disabled={!isSplit}
            />
          </div>

          {err && <div className="error">{err}</div>}

          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
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

EditTransactionModal.propTypes = {
  tx: PropTypes.object.isRequired,
  friend: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};
