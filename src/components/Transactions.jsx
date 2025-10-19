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

export default function Transactions({ friend, items }) {
  if (!friend) return null;

  if (!items || items.length === 0) {
    return (
      <div className="kicker">No transactions yet with {friend.name}.</div>
    );
  }

  return (
    <div className="list">
      {items.map((t) => {
        const sign = t.delta > 0 ? "+" : t.delta < 0 ? "−" : "";
        const whoPaid = t.payer === "you" ? "You paid" : `${friend.name} paid`;
        const summary =
          t.payer === "you"
            ? `${friend.name} owes you ${formatEUR(t.half)}`
            : `You owe ${friend.name} ${formatEUR(t.half)}`;

        return (
          <div key={t.id} className="list-item">
            <div>
              <div style={{ fontWeight: 600 }}>{whoPaid}</div>
              <div className="kicker">
                {summary} • {when(t.createdAt)}
              </div>
            </div>
            <div className="amount" aria-label="balance delta">
              {sign}
              {formatEUR(Math.abs(t.delta))}
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
};
