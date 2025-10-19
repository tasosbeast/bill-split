import PropTypes from "prop-types";
import { useState } from "react";

export default function SplitForm({ friend, onSplit }) {
  const [bill, setBill] = useState("");
  const [payer, setPayer] = useState("you");

  function handleSubmit(e) {
    e.preventDefault();
    const total = parseFloat(bill);
    if (isNaN(total) || total <= 0) return;

    const half = total / 2;

    // delta > 0  => friend owes YOU
    // delta < 0  => YOU owe friend
    const delta = payer === "you" ? half : -half;

    onSplit({
      id: crypto.randomUUID(),
      type: "split",
      friendId: friend.id,
      total,
      payer, // 'you' | 'friend'
      half,
      delta, // signed amount (receivable/payable)
      createdAt: new Date().toISOString(),
    });

    setBill("");
    setPayer("you");
  }

  return (
    <form onSubmit={handleSubmit} className="list" style={{ gap: "12px" }}>
      <div>
        <label className="kicker" htmlFor="bill">
          Total bill amount (€)
        </label>
        <input
          id="bill"
          className="input"
          type="number"
          min="0"
          step="0.01"
          value={bill}
          onChange={(e) => setBill(e.target.value)}
          placeholder="e.g. 42.50"
          required
        />
      </div>

      <div>
        <label className="kicker">Who paid the bill?</label>
        <select
          className="select"
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
        >
          <option value="you">You</option>
          <option value="friend">{friend.name}</option>
        </select>
      </div>

      <button className="button" type="submit">
        Split it
      </button>
    </form>
  );
}

SplitForm.propTypes = {
  friend: PropTypes.object.isRequired,
  onSplit: PropTypes.func.isRequired,
};
