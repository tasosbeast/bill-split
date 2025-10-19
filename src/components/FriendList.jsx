import PropTypes from "prop-types";
import { memo } from "react";

function FriendList({ friends, selectedId, onSelect }) {
  return (
    <div className="list">
      {friends.length === 0 && (
        <div className="kicker">No friends yet. Add one to get started.</div>
      )}

      {friends.map((f) => {
        const active = f.id === selectedId;
        return (
          <button
            key={f.id}
            type="button"
            className={`list-item ${active ? "active" : ""}`}
            onClick={() => onSelect(active ? null : f.id)}
            aria-pressed={active}
          >
            <div>
              <div className="fw-600">{f.name}</div>
              <div className="kicker">{f.email}</div>
            </div>
            <div className="kicker">{f.tag ?? "friend"}</div>
          </button>
        );
      })}
    </div>
  );
}

export default memo(FriendList);
FriendList.propTypes = {
  friends: PropTypes.array.isRequired,
  selectedId: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};
