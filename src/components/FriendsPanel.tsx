import { memo, Suspense, lazy } from "react";
import type { Friend } from "../types/legacySnapshot";
import type { FriendBalanceSummary } from "../hooks/useFriends";
import type {
  SettlementStatus,
  TransactionPaymentMetadata,
} from "../types/transaction";

const FriendList = lazy(() => import("./FriendList"));
const Balances = lazy(() => import("./Balances"));

interface FriendsPanelProps {
  friends: Friend[];
  friendSummaries?: FriendBalanceSummary[];
  selectedFriendId: string | null;
  balances: Map<string, number>;
  onAddFriend: () => void;
  onSelectFriend: (friendId: string | null) => void;
  onRemoveFriend: (friendId: string) => void;
  settlementSummaries?: Map<string, FriendSettlementSummary>;
  onConfirmSettlement?: (transactionId: string) => void;
}

interface FriendSettlementSummary {
  transactionId: string;
  status: SettlementStatus;
  balance: number;
  createdAt: string | null;
  payment: TransactionPaymentMetadata | null;
}

function FriendsPanel({
  friends,
  friendSummaries,
  selectedFriendId,
  balances,
  onAddFriend,
  onSelectFriend,
  onRemoveFriend,
  settlementSummaries,
  onConfirmSettlement,
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
          friendSummaries={friendSummaries}
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
          friendSummaries={friendSummaries}
          settlements={settlementSummaries}
          onJumpTo={onSelectFriend}
          onConfirmSettlement={onConfirmSettlement}
        />
      </Suspense>
    </section>
  );
}

export default memo(FriendsPanel);
