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
            <div className="amount">{formatEUR(Math.abs(bal))}</div>
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
