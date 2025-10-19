import PropTypes from "prop-types";
import { formatEUR } from "../lib/money";

function when(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

export default function Transactions({
  friend,
  items,
  onRequestEdit,
  onDelete,
}) {
  if (!friend) return null;

  if (!items || items.length === 0) {
    return (
      <div className="kicker">No transactions yet with {friend.name}.</div>
    );
  }

  return (
    <div className="list">
      {items.map((t) => {
        const isSettlement = t.type === "settlement";

        const whoPaid =
          t.payer === "you"
            ? "You paid"
            : t.payer === "friend"
            ? `${friend.name} paid`
            : "Settlement";

        const summary = isSettlement
          ? `Balance settled — ${formatEUR(Math.abs(t.delta))}`
          : t.payer === "you"
          ? `${friend.name} owes you ${formatEUR(t.half)}`
          : `You owe ${friend.name} ${formatEUR(t.half)}`;

        const cls = isSettlement
          ? "amount amount-zero"
          : t.delta > 0
          ? "amount amount-pos"
          : t.delta < 0
          ? "amount amount-neg"
          : "amount amount-zero";

        const arrow = isSettlement
          ? "—"
          : t.delta > 0
          ? "↑"
          : t.delta < 0
          ? "↓"
          : "—";

        const sr = isSettlement
          ? "settlement (balance cleared)"
          : t.delta > 0
          ? "credit (they owe you)"
          : t.delta < 0
          ? "debt (you owe them)"
          : "settled";

        return (
          <div key={t.id} className="list-item">
            <div className="tx">
              {/* Title row */}
              <div className="tx-title">{whoPaid}</div>

              {/* Meta line */}
              <div className="tx-meta">
                {summary} | {when(t.createdAt)}
                {t.updatedAt ? " | edited" : ""}
              </div>

              {/* Badges */}
              <div className="tx-badges">
                {t.category && (
                  <span className="badge-chip">
                    <strong>Category</strong> {t.category}
                  </span>
                )}
                {t.note && (
                  <span className="badge-chip" title={t.note}>
                    <strong>Note</strong> {t.note}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="tx-actions actions">
                {!isSettlement && (
                  <button
                    className="button-ghost"
                    onClick={() => onRequestEdit?.(t)}
                    title="Edit this split"
                  >
                    Edit
                  </button>
                )}
                <button
                  className="button-danger"
                  onClick={() => onDelete?.(t.id)}
                  title="Delete this transaction"
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Amount column stays right-aligned */}
            <div className={cls} aria-label={sr}>
              <span aria-hidden="true" style={{ marginRight: 6 }}>
                {arrow}
              </span>
              {formatEUR(Math.abs(t.delta))}
              <span className="sr-only"> {sr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

Transactions.propTypes = {
  friend: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string,
  }),
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      type: PropTypes.oneOf(["split", "settlement"]).isRequired,
      friendId: PropTypes.string.isRequired,
      total: PropTypes.number,
      payer: PropTypes.oneOf(["you", "friend", null]),
      half: PropTypes.number,
      delta: PropTypes.number.isRequired,
      category: PropTypes.string,
      note: PropTypes.string,
      createdAt: PropTypes.string.isRequired,
      updatedAt: PropTypes.string,
    })
  ).isRequired,
  onRequestEdit: PropTypes.func,
  onDelete: PropTypes.func,
};
