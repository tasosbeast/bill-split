import { memo } from "react";
import type { Friend } from "../types/legacySnapshot";

interface FriendSummary {
  friend: Friend;
  balance: number;
  canRemove: boolean;
}

interface FriendListProps {
  friends: Friend[];
  selectedId?: string | null;
  balances?: Map<string, number>;
  friendSummaries?: FriendSummary[];
  onSelect: (friendId: string | null) => void;
  onRemove: (friendId: string) => void;
}

function FriendList({
  friends,
  selectedId,
  balances,
  friendSummaries,
  onSelect,
  onRemove,
}: FriendListProps) {
  const entries: FriendSummary[] =
    friendSummaries ??
    friends.map((friend) => {
      const balance = balances?.get?.(friend.id) ?? 0;
      return {
        friend,
        balance,
        canRemove: Math.abs(balance) < 0.01,
      };
    });

  return (
    <div className="list">
      {entries.length === 0 && (
        <div className="kicker">No friends yet. Add one to get started.</div>
      )}

      {entries.map((entry) => {
        const { friend, canRemove } = entry;
        const active = friend.id === selectedId;
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
