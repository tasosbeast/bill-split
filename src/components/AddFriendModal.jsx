import PropTypes from "prop-types";
import { useState } from "react";
import Modal from "./Modal";

export default function AddFriendModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");

  function validate() {
    if (!name.trim()) return "Name is required.";
    if (!email.trim()) return "Email is required.";
    // Tiny email check (good enough for the UI)
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!ok) return "Email looks invalid.";
    return "";
  }

  function handleSubmit(e) {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);

    onCreate({
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      tag: "friend",
    });
    onClose();
  }

  return (
    <Modal title="Add Friend" onClose={onClose}>
      {({ firstFieldRef }) => (
        <form className="form-grid" onSubmit={handleSubmit}>
          <div>
            <label className="kicker" htmlFor="friend-name">
              Name
            </label>
            <input
              id="friend-name"
              ref={firstFieldRef}
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Valia"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="kicker" htmlFor="friend-email">
              Email
            </label>
            <input
              id="friend-email"
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="valia@example.com"
              autoComplete="off"
            />
            <div className="helper">
              We won’t send anything; it’s just a label.
            </div>
          </div>

          {err && <div className="error">{err}</div>}

          <div className="row justify-end gap-8">
            <button type="button" className="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button">
              Add friend
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

AddFriendModal.propTypes = {
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
};
