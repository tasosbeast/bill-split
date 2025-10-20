import { memo, Suspense, lazy } from "react";
import type { LegacyFriend } from "../../types/legacySnapshot";

const FriendList = lazy(() => import("../FriendList"));
const Balances = lazy(() => import("../Balances"));

interface FriendsPanelProps {
  friends: LegacyFriend[];
  selectedFriendId: string | null;
  balances: Map<string, number>;
  onAddFriend: () => void;
  onSelectFriend: (friendId: string | null) => void;
  onRemoveFriend: (friendId: string) => void;
}

function FriendsPanel({
  friends,
  selectedFriendId,
  balances,
  onAddFriend,
  onSelectFriend,
  onRemoveFriend,
}: FriendsPanelProps) {
  return (
    <section className="panel">
      <h2>Friends</h2>
      <div className="row stack-sm">
        <button className="button" onClick={onAddFriend}>
          + Add friend
        </button>
      </div>
      <Suspense
        fallback={
          <div className="kicker" aria-live="polite">
            Loading friends…
          </div>
        }
      >
        <FriendList
          friends={friends}
          selectedId={selectedFriendId}
          balances={balances}
          onSelect={onSelectFriend}
          onRemove={onRemoveFriend}
        />
      </Suspense>

      <div className="spacer-md" aria-hidden="true" />
      <h2>Balances</h2>
      <p className="kicker stack-tight">
        Positive = they owe you | Negative = you owe them
      </p>
      <Suspense
        fallback={
          <div className="kicker" aria-live="polite">
            Loading balances…
          </div>
        }
      >
        <Balances
          friends={friends}
          balances={balances}
          onJumpTo={onSelectFriend}
        />
      </Suspense>
    </section>
  );
}

export default memo(FriendsPanel);
