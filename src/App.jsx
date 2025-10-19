import { useMemo, useState } from "react";
import "./index.css";
import FriendList from "./components/FriendList";
import SplitForm from "./components/SplitForm";
import AddFriendModal from "./components/AddFriendModal";

const initialFriends = [
  { id: crypto.randomUUID(), name: "Valia", email: "valia@example.com" },
  { id: crypto.randomUUID(), name: "Nikos", email: "nikos@example.com" },
];

export default function App() {
  const [friends, setFriends] = useState(initialFriends);
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const selectedFriend = useMemo(
    () => friends.find((f) => f.id === selectedId) || null,
    [friends, selectedId]
  );

  function handleSplit(result) {
    setMessage(result);
  }

  function openAdd() {
    setShowAdd(true);
  }

  function closeAdd() {
    setShowAdd(false);
  }

  function handleCreateFriend(friend) {
    // Prevent duplicate by email (case-insensitive)
    const exists = friends.some((f) => f.email.toLowerCase() === friend.email);
    if (exists) {
      alert("A friend with this email already exists.");
      return;
    }
    setFriends((prev) => [...prev, friend]);
    setSelectedId(friend.id);
  }

  return (
    <div className="app">
      <header className="header">
        <div className="brand">Bill Split</div>
        <span className="badge">React + Vite</span>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>Friends</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <button className="button" onClick={openAdd}>
              + Add friend
            </button>
          </div>
          <FriendList
            friends={friends}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </section>

        <section className="panel">
          <h2>Split a bill</h2>

          {!selectedFriend && (
            <p className="kicker">Choose a friend to start.</p>
          )}

          {selectedFriend && (
            <>
              <div className="kicker" style={{ marginBottom: 10 }}>
                Splitting with <strong>{selectedFriend.name}</strong>
              </div>
              <SplitForm friend={selectedFriend} onSplit={handleSplit} />
            </>
          )}

          {message && (
            <div
              style={{
                marginTop: 16,
                padding: 12,
                borderRadius: 10,
                background: "#1a1c25",
                border: "1px solid var(--border)",
              }}
            >
              <strong>Result:</strong> {message}
            </div>
          )}
        </section>
      </div>

      {showAdd && (
        <AddFriendModal onClose={closeAdd} onCreate={handleCreateFriend} />
      )}
    </div>
  );
}
