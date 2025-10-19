import PropTypes from "prop-types";
import { formatEUR } from "../lib/money";
import { memo } from "react";

function when(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString();
  } catch {
    return ts;
  }
}

function Transactions({ friend, friendsById, items, onRequestEdit, onDelete }) {
  if (!friend) return null;

  const map = friendsById instanceof Map ? friendsById : new Map();

  if (!items || items.length === 0) {
    return (
      <div className="kicker">No transactions yet with {friend.name}.</div>
    );
  }

  return (
    <div className="list">
      {items.map((t) => {
        const isSettlement = t.type === "settlement";
        const isGroupSplit = Array.isArray(t.friendIds)
          ? t.friendIds.filter(Boolean).length > 1
          : false;
        const delta = t.effect?.delta ?? 0;
        const share = t.effect?.share ?? Math.abs(delta);
        const payerName = (() => {
          if (t.payer === "you") return "You";
          if (typeof t.payer === "string") {
            const payerFriend = map.get(t.payer);
            if (payerFriend) return payerFriend.name;
          }
          return null;
        })();

        const whoPaid = isSettlement
          ? "Settlement"
          : payerName
          ? `${payerName} paid`
          : "Shared expense";

        let summary;
        if (isSettlement) {
          summary = `Balance settled \u2014 ${formatEUR(Math.abs(delta))}`;
        } else if (delta > 0) {
          summary = `${friend.name} owes you ${formatEUR(delta)}`;
          if (share && Math.abs(share - delta) > 0.01) {
            summary += ` (share ${formatEUR(share)})`;
          }
        } else if (delta < 0) {
          summary = `You owe ${friend.name} ${formatEUR(Math.abs(delta))}`;
          if (share && Math.abs(share - Math.abs(delta)) > 0.01) {
            summary += ` (share ${formatEUR(share)})`;
          }
        } else if (share > 0) {
          summary = `No balance change — share ${formatEUR(share)}`;
        } else {
          summary = "Settled";
        }

        const cls =
          delta > 0
            ? "amount amount-pos"
            : delta < 0
            ? "amount amount-neg"
            : "amount amount-zero";

        const arrow = delta > 0 ? "\u2191" : delta < 0 ? "\u2193" : "\u2014";

        const sr =
          delta > 0
            ? "credit (they owe you)"
            : delta < 0
            ? "debt (you owe them)"
            : "settled";

        const participantNames = (t.participants || [])
          .map((p) => {
            if (p.id === "you") return "You";
            const f = map.get(p.id);
            return f ? f.name : null;
          })
          .filter(Boolean)
          .join(", ");

        return (
          <div key={t.id} className="list-item">
            <div className="tx">
              {/* Title row */}
              <div className="tx-title">{whoPaid}</div>

              {/* Meta line */}
              <div className="tx-meta">
                {summary} | {when(t.createdAt)}
                {t.updatedAt && (
                  <>
                    {" | "}
                    <span
                      className="tx-meta-updated"
                      title={`Edited ${when(t.updatedAt)}`}
                    >
                      edited {when(t.updatedAt)}
                    </span>
                  </>
                )}
              </div>

              {/* Badges */}
              <div className="tx-badges">
                {t.category && (
                  <span className="badge-chip">
                    <strong>Category</strong> {t.category}
                  </span>
                )}
                {t.total ? (
                  <span className="badge-chip">
                    <strong>Total</strong> {formatEUR(t.total)}
                  </span>
                ) : null}
                {participantNames && (
                  <span className="badge-chip">
                    <strong>With</strong> {participantNames}
                  </span>
                )}
                {t.note && (
                  <span className="badge-chip" title={t.note}>
                    <strong>Note</strong> {t.note}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="tx-actions row gap-8 flex-wrap">
                {!isSettlement && (
                  <button
                    className="btn-ghost"
                    onClick={() => onRequestEdit?.(t)}
                    title={
                      isGroupSplit
                        ? "Editing multi-friend splits isn't supported yet"
                        : "Edit this split"
                    }
                    disabled={isGroupSplit}
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
              <span aria-hidden="true" className="mr-6">
                {arrow}
              </span>
              {formatEUR(Math.abs(delta))}
              <span className="sr-only"> {sr}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(Transactions);
Transactions.propTypes = {
  friend: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    email: PropTypes.string,
  }),
  friendsById: PropTypes.instanceOf(Map),
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      type: PropTypes.oneOf(["split", "settlement"]).isRequired,
      total: PropTypes.number,
      payer: PropTypes.string,
      friendIds: PropTypes.arrayOf(PropTypes.string),
      effect: PropTypes.shape({
        friendId: PropTypes.string.isRequired,
        share: PropTypes.number,
        delta: PropTypes.number.isRequired,
      }).isRequired,
      category: PropTypes.string,
      note: PropTypes.string,
      createdAt: PropTypes.string.isRequired,
      updatedAt: PropTypes.string,
    })
  ).isRequired,
  onRequestEdit: PropTypes.func,
  onDelete: PropTypes.func,
};
