import PropTypes from "prop-types";
import { memo } from "react";

function FriendList({ friends, selectedId, balances, onSelect, onRemove }) {
  return (
    <div className="list">
      {friends.length === 0 && (
        <div className="kicker">No friends yet. Add one to get started.</div>
      )}

      {friends.map((friend) => {
        const active = friend.id === selectedId;
        const balance = balances?.get?.(friend.id) ?? 0;
        const canRemove = Math.abs(balance) < 0.01;
        const deleteTitle = canRemove
          ? `Remove ${friend.name}`
          : "Settle the balance before removing this friend.";

        return (
          <div
            key={friend.id}
            className={`list-item friend-list__item${active ? " active" : ""}`}
          >
            <button
              type="button"
              className="friend-list__primary"
              onClick={() => onSelect(active ? null : friend.id)}
              aria-pressed={active}
            >
              <div>
                <div className="fw-600">{friend.name}</div>
                <div className="kicker">{friend.email}</div>
              </div>
              <div className="kicker">{friend.tag ?? "friend"}</div>
            </button>
            <button
              type="button"
              className="button-danger friend-list__delete"
              onClick={() => canRemove && onRemove(friend.id)}
              disabled={!canRemove}
              title={deleteTitle}
              aria-label={deleteTitle}
            >
              Remove
            </button>
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
  balances: PropTypes.instanceOf(Map),
  onSelect: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
};
