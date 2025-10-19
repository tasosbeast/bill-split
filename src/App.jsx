import { useState } from "react";
import "./index.css";
import FriendList from "./components/FriendList";

const initialFriends = [
  { id: crypto.randomUUID(), name: "Valia", email: "valia@example.com" },
  { id: crypto.randomUUID(), name: "Nikos", email: "nikos@example.com" },
];

export default function App() {
  const [friends, setFriends] = useState(initialFriends);
  const [selectedId, setSelectedId] = useState(null);

  const selectedFriend = friends.find((f) => f.id === selectedId) || null;

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
            {/* Placeholder Add Friend button – modal comes in a later commit */}
            <button
              className="button"
              onClick={() => alert("Add Friend modal (next commit)")}
            >
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
          {!selectedFriend ? (
            <p className="kicker">Choose a friend to unlock the split form.</p>
          ) : (
            <div>
              <div className="kicker" style={{ marginBottom: 10 }}>
                Splitting with <strong>{selectedFriend.name}</strong>
              </div>
              <p className="kicker">
                Next commit: the actual form (amount, payer, result: who owes
                whom).
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
