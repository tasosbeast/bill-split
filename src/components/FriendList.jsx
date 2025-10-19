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
          <div
            key={f.id}
            className={`list-item ${active ? "active" : ""}`}
            onClick={() => onSelect(active ? null : f.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ")
                onSelect(active ? null : f.id);
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{f.name}</div>
              <div className="kicker">{f.email}</div>
            </div>
            <div className="kicker">{f.tag ?? "friend"}</div>
          </div>
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
