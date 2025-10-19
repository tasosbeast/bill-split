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
    const result =
      payer === "you"
        ? `${friend.name} owes you €${half.toFixed(2)}`
        : `You owe ${friend.name} €${half.toFixed(2)}`;

    onSplit(result);
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
