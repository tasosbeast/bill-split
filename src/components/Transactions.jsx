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

function Transactions({
  friend,
  friendsById,
  items,
  onRequestEdit,
  onDelete,
  onConfirmSettlement,
  onCancelSettlement,
  onReopenSettlement,
}) {
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
        const delta =
          t.effect?.delta ?? (typeof t.delta === "number" ? t.delta : 0);
        const share =
          t.effect?.share ??
          (typeof t.half === "number" ? t.half : Math.abs(delta));
        const yourShare = Array.isArray(t.participants)
          ? t.participants.find((p) => p.id === "you")?.amount ?? null
          : null;
        const payerName = (() => {
          if (t.payer === "you") return "You";
          if (typeof t.payer === "string") {
            const payerFriend = map.get(t.payer);
            if (payerFriend) return payerFriend.name;
          }
          return null;
        })();

        const settlementStatus = isSettlement
          ? (() => {
              if (typeof t.settlementStatus !== "string") return "confirmed";
              const normalized = t.settlementStatus.trim().toLowerCase();
              if (normalized === "canceled") return "cancelled";
              switch (normalized) {
                case "initiated":
                case "pending":
                case "confirmed":
                case "cancelled":
                  return normalized;
                default:
                  return "confirmed";
              }
            })()
          : null;

        const settlementStatusLabel = (() => {
          switch (settlementStatus) {
            case "initiated":
              return "Awaiting confirmation";
            case "pending":
              return "Pending";
            case "cancelled":
              return "Cancelled";
            case "confirmed":
            default:
              return "Confirmed";
          }
        })();

        const whoPaid = isSettlement
          ? "Settlement"
          : payerName
          ? `${payerName} paid`
          : "Shared expense";

        let summary;
        if (isSettlement) {
          if (settlementStatus === "cancelled") {
            summary = "Settlement cancelled";
          } else if (settlementStatus === "confirmed") {
            summary = `Balance settled \u2014 ${formatEUR(Math.abs(delta))}`;
          } else {
            summary = `Settlement in progress \u2014 ${formatEUR(
              Math.abs(delta)
            )}`;
          }
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
            // Omit the currently selected friend from the "With" badge to avoid redundancy
            if (f && f.id === friend.id) return null;
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
                {t.templateName && (
                  <span className="badge-chip">
                    <strong>Template</strong> {t.templateName}
                  </span>
                )}
                {isSettlement && settlementStatus && (
                  <span
                    className={`badge-chip badge-settlement badge-settlement-${settlementStatus}`}
                  >
                    <strong>Status</strong> {settlementStatusLabel}
                  </span>
                )}
                {t.total ? (
                  <span className="badge-chip">
                    <strong>Total</strong> {formatEUR(t.total)}
                  </span>
                ) : null}
                {yourShare !== null && yourShare > 0 ? (
                  <span className="badge-chip">
                    <strong>Your share</strong> {formatEUR(yourShare)}
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
                {isSettlement && t.settlementConfirmedAt && (
                  <span className="badge-chip">
                    <strong>Confirmed</strong> {when(t.settlementConfirmedAt)}
                  </span>
                )}
                {isSettlement && t.settlementCancelledAt && (
                  <span className="badge-chip">
                    <strong>Cancelled</strong> {when(t.settlementCancelledAt)}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="tx-actions row gap-8 flex-wrap">
                {!isSettlement && (
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onRequestEdit?.(t)}
                    title={
                      isGroupSplit
                        ? "Edit details (amounts locked)"
                        : "Edit this split"
                    }
                    
                  >
                    Edit
                  </button>
                )}
                {isSettlement && settlementStatus && (
                  <>
                    {settlementStatus !== "confirmed" &&
                      settlementStatus !== "cancelled" && (
                        <button
                          type="button"
                          className="button"
                          onClick={() => onConfirmSettlement?.(t.id)}
                          title="Mark this settlement as confirmed"
                        >
                          Mark confirmed
                        </button>
                      )}
                    {settlementStatus === "confirmed" || settlementStatus === "cancelled" ? (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => onReopenSettlement?.(t.id)}
                        title="Reopen this settlement"
                      >
                        Reopen
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => onCancelSettlement?.(t.id)}
                        title="Cancel this settlement"
                      >
                        Cancel
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
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
      settlementStatus: PropTypes.oneOf([
        "initiated",
        "pending",
        "confirmed",
        "cancelled",
      ]),
      settlementConfirmedAt: PropTypes.string,
      settlementCancelledAt: PropTypes.string,
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
  onConfirmSettlement: PropTypes.func,
  onCancelSettlement: PropTypes.func,
  onReopenSettlement: PropTypes.func,
};



