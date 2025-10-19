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
          ? `Balance settled • ${formatEUR(Math.abs(t.delta))}`
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
          ? "✓"
          : t.delta > 0
          ? "▲"
          : t.delta < 0
          ? "▼"
          : "•";

        const sr = isSettlement
          ? "settlement (balance cleared)"
          : t.delta > 0
          ? "credit (they owe you)"
          : t.delta < 0
          ? "debt (you owe them)"
          : "settled";

        return (
          <div key={t.id} className="list-item">
            <div>
              <div style={{ fontWeight: 600 }}>{whoPaid}</div>

              <div className="kicker">
                {summary} • {when(t.createdAt)}
                {t.updatedAt ? " • edited" : ""}
              </div>

              {/* Badges row */}
              <div className="badges" style={{ marginTop: 6 }}>
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

              {/* Action buttons */}
              <div className="actions" style={{ marginTop: 8 }}>
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
  friend: PropTypes.object,
  items: PropTypes.array.isRequired,
  onRequestEdit: PropTypes.func,
  onDelete: PropTypes.func,
};
