import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import Modal from "./Modal";
import { useToasts } from "../state/toastStore";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddFriendModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const { addToast } = useToasts();
  const errorId = useMemo(
    () => `add-friend-error-${Math.random().toString(36).slice(2)}`,
    []
  );
  const helperId = useMemo(
    () => `add-friend-helper-${Math.random().toString(36).slice(2)}`,
    []
  );

  function validate() {
    if (!name.trim()) return "Name is required.";
    if (!email.trim()) return "Email is required.";
    if (!EMAIL_REGEX.test(email)) return "Email address looks invalid.";
    return "";
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      addToast({ kind: "error", message: validationMessage });
      return;
    }

    const payload = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      tag: "friend",
      active: true,
      createdAt: Date.now(),
    };

    const result = onCreate(payload);
    if (!result?.ok) {
      const message =
        result?.reason === "duplicate-email"
          ? "That email is already in your friend list."
          : "Could not add friend. Please try again.";
      setError(message);
      addToast({ kind: "error", message });
      return;
    }

    addToast({ kind: "success", message: `${payload.name} added to your friends.` });
    onClose();
  }

  function handleNameChange(event) {
    setName(event.target.value);
    if (error) setError("");
  }

  function handleEmailChange(event) {
    setEmail(event.target.value);
    if (error) setError("");
  }

  const describedBy =
    [helperId, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <Modal title="Add Friend" onClose={onClose}>
      {({ firstFieldRef }) => (
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <div>
            <label className="kicker" htmlFor="friend-name">
              Name
            </label>
            <input
              id="friend-name"
              ref={firstFieldRef}
              className="input"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Valia"
              autoComplete="off"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={describedBy}
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
              onChange={handleEmailChange}
              placeholder="valia@example.com"
              autoComplete="off"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={describedBy}
            />
            <div className="helper" id={helperId}>
              We won’t send anything; it’s just a label.
            </div>
          </div>

          {error ? (
            <div className="error" id={errorId} role="alert">
              {error}
            </div>
          ) : null}

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
