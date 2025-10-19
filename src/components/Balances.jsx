import PropTypes from "prop-types";
import { formatEUR } from "../lib/money";

export default function Balances({ friends, balances, onJumpTo }) {
  // balances: Map<friendId, number> (signed)
  return (
    <div className="list">
      {friends.length === 0 && (
        <div className="kicker">No friends yet. Add one to get started.</div>
      )}

      {friends.map((f) => {
        const bal = balances.get(f.id) || 0;
        const label =
          bal > 0
            ? `${f.name} owes you`
            : bal < 0
            ? `You owe ${f.name}`
            : "Settled";

        const cls =
          bal > 0
            ? "amount amount-pos"
            : bal < 0
            ? "amount amount-neg"
            : "amount amount-zero";

        const arrow = bal > 0 ? "↑" : bal < 0 ? "↓" : "—";
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
              <div style={{ fontWeight: 600 }}>{f.name}</div>
              <div className="kicker">{label}</div>
            </div>
            <div className={cls} aria-label={sr}>
              <span aria-hidden="true" style={{ marginRight: 6 }}>
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

Balances.propTypes = {
  friends: PropTypes.array.isRequired,
  balances: PropTypes.instanceOf(Map).isRequired,
  onJumpTo: PropTypes.func,
};
