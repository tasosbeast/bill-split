import React, { useEffect, useMemo, useState, type MutableRefObject } from "react";
import Modal from "./Modal";
import { formatEUR, roundToCents } from "../lib/money";
import type { Friend } from "../types/legacySnapshot";
import type {
  SettlementStatus,
  TransactionPaymentMetadata,
} from "../types/transaction";

interface SettlementAssistantModalProps {
  friend: Friend;
  balance: number;
  onClose: () => void;
  onSubmit: (result: SettlementAssistantResult) => void;
}

export interface SettlementAssistantResult {
  amount: number;
  status: SettlementStatus;
  payment: TransactionPaymentMetadata | null;
}

function normalizeAmountInput(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return roundToCents(Math.abs(numeric));
}

function formatIsoDate(value: string): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
}

export default function SettlementAssistantModal({
  friend,
  balance,
  onClose,
  onSubmit,
}: SettlementAssistantModalProps): React.JSX.Element {
  const [method, setMethod] = useState("");
  const [amount, setAmount] = useState(() =>
    Math.abs(balance) > 0 ? Math.abs(balance).toFixed(2) : ""
  );
  const [dueDate, setDueDate] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [markPaid, setMarkPaid] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount(Math.abs(balance) > 0 ? Math.abs(balance).toFixed(2) : "");
    setMarkPaid(false);
    setError("");
  }, [balance]);

  useEffect(() => {
    setMethod("");
    setDueDate("");
    setReference("");
    setNotes("");
    setMarkPaid(false);
  }, [friend.id]);

  const directionLabel = useMemo(() => {
    if (balance > 0) {
      return `${friend.name} owes you ${formatEUR(Math.abs(balance))}`;
    }
    if (balance < 0) {
      return `You owe ${friend.name} ${formatEUR(Math.abs(balance))}`;
    }
    return `Balance with ${friend.name} is already even`;
  }, [balance, friend.name]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const parsedAmount = normalizeAmountInput(amount);
    if (parsedAmount === null) {
      setError("Enter a positive amount to settle.");
      return;
    }

    const signedAmount = balance < 0 ? -parsedAmount : parsedAmount;
    const paymentMetadata: TransactionPaymentMetadata = {};

    if (method.trim()) {
      paymentMetadata.method = method.trim();
    }
    if (dueDate.trim()) {
      paymentMetadata.dueDate = dueDate.trim();
      paymentMetadata.dueDateLabel = formatIsoDate(dueDate.trim());
    }
    if (reference.trim()) {
      paymentMetadata.reference = reference.trim();
    }
    if (notes.trim()) {
      paymentMetadata.memo = notes.trim();
    }

    const cleanedPayment = Object.keys(paymentMetadata).length
      ? paymentMetadata
      : null;

    onSubmit({
      amount: signedAmount,
      status: markPaid ? "confirmed" : "initiated",
      payment: cleanedPayment,
    });
  }

  return (
    <Modal title={`Settle balance with ${friend.name}`} onClose={onClose}>
      {({
        firstFieldRef,
      }: {
        firstFieldRef: MutableRefObject<HTMLInputElement | null>;
      }) => (
        <form className="form-grid" onSubmit={handleSubmit}>
          <p className="kicker">{directionLabel}</p>

          {error && <div className="error" role="alert">{error}</div>}

          <div>
            <label className="kicker" htmlFor="settlement-method">
              Payment method
            </label>
            <input
              id="settlement-method"
              ref={firstFieldRef}
              className="input"
              placeholder="e.g. Bank transfer"
              value={method}
              onChange={(event) => setMethod(event.target.value)}
            />
          </div>

          <div>
            <label className="kicker" htmlFor="settlement-amount">
              Amount to record (€)
            </label>
            <input
              id="settlement-amount"
              className="input"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <div className="helper">
              Defaults to the current outstanding balance.
            </div>
          </div>

          <div>
            <label className="kicker" htmlFor="settlement-due">
              Due date
            </label>
            <input
              id="settlement-due"
              className="input"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </div>

          <div>
            <label className="kicker" htmlFor="settlement-reference">
              Payment reference
            </label>
            <input
              id="settlement-reference"
              className="input"
              placeholder="e.g. Invoice #123"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>

          <div>
            <label className="kicker" htmlFor="settlement-notes">
              Notes
            </label>
            <textarea
              id="settlement-notes"
              className="input"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add any extra context"
            />
          </div>

          <div className="row items-center gap-8">
            <label className="row items-center gap-4">
              <input
                type="checkbox"
                checked={markPaid}
                onChange={(event) => setMarkPaid(event.target.checked)}
              />
              <span>Mark as paid now</span>
            </label>
            <span className="helper">
              When checked, the settlement will be confirmed immediately.
            </span>
          </div>

          <div className="row gap-8">
            <button type="submit" className="button">
              Save settlement
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
