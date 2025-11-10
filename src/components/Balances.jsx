import PropTypes from "prop-types";
import { memo, useMemo } from "react";
import { formatEUR } from "../lib/money";

const STATUS_LABELS = {
  initiated: "Awaiting payment",
  pending: "Pending",
  confirmed: "Paid",
  cancelled: "Cancelled",
};

function resolveDueLabel(payment) {
  if (!payment) return null;
  const labeled =
    typeof payment.dueDateLabel === "string" && payment.dueDateLabel.trim()
      ? payment.dueDateLabel.trim()
      : null;
  if (labeled) return labeled;
  const raw =
    typeof payment.dueDate === "string" && payment.dueDate.trim()
      ? payment.dueDate.trim()
      : null;
  if (!raw) return null;
  try {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString();
    }
  } catch {
    // Fallback to raw value
  }
  return raw;
}

function Balances({
  friends,
  balances,
  friendSummaries,
  settlements,
  onJumpTo,
  onConfirmSettlement,
}) {
  const entries = useMemo(() => {
    if (Array.isArray(friendSummaries) && friendSummaries.length > 0) {
      return friendSummaries;
    }
    return friends.map((friend) => {
      const balance = balances.get(friend.id) || 0;
      return {
        friend,
        balance,
        canRemove: Math.abs(balance) < 0.01,
      };
    });
  }, [friendSummaries, friends, balances]);

  return (
    <div className="list">
      {entries.length === 0 && (
        <div className="kicker">No friends yet. Add one to get started.</div>
      )}

      {entries.map(({ friend: f, balance: bal }) => {
        const settlement = settlements?.get(f.id) || null;
        const label =
          bal > 0
            ? `${f.name} owes you`
            : bal < 0
            ? `You owe ${f.name}`
            : "Settled";

        const settlementAmount =
          settlement && typeof settlement.balance === "number"
            ? formatEUR(Math.abs(settlement.balance))
            : null;
        const settlementStatusLabel = settlement
          ? STATUS_LABELS[settlement.status] || "Pending"
          : null;
        const payment = settlement?.payment ?? null;
        const method =
          payment && typeof payment.method === "string" && payment.method.trim()
            ? payment.method.trim()
            : null;
        const dueLabel = resolveDueLabel(payment);
        const memoNote =
          payment && typeof payment.memo === "string" && payment.memo.trim()
            ? payment.memo.trim()
            : null;
        const reference =
          payment && typeof payment.reference === "string" && payment.reference.trim()
            ? payment.reference.trim()
            : null;
        const canMarkPaid =
          !!(
            settlement &&
            settlement.transactionId &&
            settlement.status !== "confirmed" &&
            settlement.status !== "cancelled" &&
            typeof onConfirmSettlement === "function"
          );

        const cls =
          bal > 0
            ? "amount amount-pos"
            : bal < 0
            ? "amount amount-neg"
            : "amount amount-zero";

        const arrow = bal > 0 ? "\u2191" : bal < 0 ? "\u2193" : "\u2014";
        const sr =
          bal > 0
            ? "credit (they owe you)"
            : bal < 0
            ? "debt (you owe them)"
            : "settled";

        return (
          <div
            key={f.id}
            className="list-item"
            role="button"
            tabIndex={0}
            onClick={() => onJumpTo?.(f.id)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && onJumpTo?.(f.id)
            }
          >
            <div>
              <div className="fw-600">{f.name}</div>
              <div className="kicker">{label}</div>
              {settlement && (
                <div className="tx-badges" aria-label="Settlement details">
                  <span
                    className={`badge-chip badge-settlement badge-settlement-${settlement.status}`}
                  >
                    <strong>Status</strong> {settlementStatusLabel}
                  </span>
                  {settlementAmount && (
                    <span className="badge-chip">
                      <strong>Amount</strong> {settlementAmount}
                    </span>
                  )}
                  {method && (
                    <span className="badge-chip">
                      <strong>Method</strong> {method}
                    </span>
                  )}
                  {dueLabel && (
                    <span className="badge-chip">
                      <strong>Due</strong> {dueLabel}
                    </span>
                  )}
                  {reference && (
                    <span className="badge-chip">
                      <strong>Reference</strong> {reference}
                    </span>
                  )}
                  {memoNote && (
                    <span className="badge-chip" title={memoNote}>
                      <strong>Notes</strong> {memoNote}
                    </span>
                  )}
                </div>
              )}
              {canMarkPaid && (
                <div className="row gap-8" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onConfirmSettlement?.(settlement.transactionId);
                    }}
                  >
                    Mark paid
                  </button>
                </div>
              )}
            </div>
            <div className={cls} aria-label={sr}>
              <span aria-hidden="true" className="mr-6">
                {arrow}
              </span>
              {formatEUR(Math.abs(bal))}
              <span className="sr-only"> {sr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(Balances);

Balances.propTypes = {
  friends: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      email: PropTypes.string,
    })
  ).isRequired,
  balances: PropTypes.instanceOf(Map).isRequired,
  friendSummaries: PropTypes.array,
  settlements: PropTypes.instanceOf(Map),
  onJumpTo: PropTypes.func,
  onConfirmSettlement: PropTypes.func,
};
