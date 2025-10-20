import { memo, Suspense, lazy } from "react";
import type {
  LegacyFriend,
  StoredTransaction,
} from "../../types/legacySnapshot";

const AnalyticsDashboard = lazy(() => import("../AnalyticsDashboard"));

interface AnalyticsPanelState {
  friends: LegacyFriend[];
  selectedId: string | null;
  balances: Map<string, number>;
  transactions: StoredTransaction[];
}

interface AnalyticsPanelProps {
  state: AnalyticsPanelState;
}

function AnalyticsPanel({ state }: AnalyticsPanelProps) {
  return (
    <Suspense
      fallback={
        <section className="panel" aria-busy="true" aria-live="polite">
          <h2>Analytics</h2>
          <p className="kicker">Loading analytics dashboard…</p>
        </section>
      }
    >
      <AnalyticsDashboard state={state} />
    </Suspense>
  );
}

export default memo(AnalyticsPanel);
