import { FC, useMemo } from "react";
import AnalyticsCard from "../components/AnalyticsCard";
import AnalyticsTrendChart from "../components/AnalyticsTrendChart";
import AnalyticsCategoryList from "../components/AnalyticsCategoryList";
import styles from "./AnalyticsDashboard.module.css";
import { formatEUR } from "../lib/money";
import {
  selectFriends,
  selectTransactions,
  selectMonthlyBudget,
  selectBalances,
} from "../lib/selectors";
import {
  computeBudgetStatus,
  computeCategoryTotals,
  computeMonthlyTrend,
} from "../lib/analytics";

type Friend = {
  id: string;
  name: string;
  email?: string | null;
};

type Transaction = {
  id: string;
  type?: string;
  total?: number;
  payer?: string;
  participants?: Array<{ id: string; amount: number }>;
  category?: string;
  createdAt?: string;
  updatedAt?: string | null;
};

type Preferences = {
  monthlyBudget?: number;
};

type StoreSnapshot = {
  friends: Friend[];
  transactions: Transaction[];
  balances: Map<string, number>;
  preferences?: Preferences;
  monthlyBudget?: number;
};

type AnalyticsDashboardProps = {
  state: StoreSnapshot;
  onNavigateHome: () => void;
};

const formatStatus = (status: string) => {
  switch (status) {
    case "over":
      return "Over budget";
    case "warning":
      return "Close to limit";
    default:
      return "On track";
  }
};

const statusAccent = (status: string) => {
  switch (status) {
    case "over":
      return "danger" as const;
    case "warning":
      return "neutral" as const;
    default:
      return "brand" as const;
  }
};

const AnalyticsDashboard: FC<AnalyticsDashboardProps> = ({ state, onNavigateHome }) => {
  const friends = useMemo(() => selectFriends(state), [state]);
  const transactions = useMemo(() => selectTransactions(state), [state]);
  const balances = useMemo(() => selectBalances(state), [state]);
  const monthlyBudget = useMemo(() => selectMonthlyBudget(state), [state]);

  const categoryTotals = useMemo(
    () => computeCategoryTotals(transactions),
    [transactions]
  );

  const monthlyTrend = useMemo(
    () => computeMonthlyTrend(transactions, 6),
    [transactions]
  );

  const budgetStatus = useMemo(
    () => computeBudgetStatus(transactions, monthlyBudget),
    [transactions, monthlyBudget]
  );

  const friendMap = useMemo(() => new Map(friends.map((f) => [f.id, f])), [friends]);

  const topBalances = useMemo(() => {
    const entries = Array.from(balances.entries())
      .map(([friendId, amount]) => ({
        friendId,
        amount,
        name: friendMap.get(friendId)?.name ?? "Friend",
      }))
      .filter((entry) => Math.abs(entry.amount) > 0.01)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return entries.slice(0, 4);
  }, [balances, friendMap]);

  return (
    <div className={styles.dashboard}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>Analytics dashboard</h1>
          <p className={styles.subtitle}>
            Track your shared expenses, trends, and budget health in real time.
          </p>
        </div>
        <button type="button" className="button" onClick={onNavigateHome}>
          Back to splits
        </button>
      </div>

      <div className={styles.grid}>
        <AnalyticsCard
          title="Current month spend"
          value={formatEUR(budgetStatus.spent)}
          description={`Budget ${formatEUR(budgetStatus.budget)}`}
          accent={statusAccent(budgetStatus.status)}
          footer={`Status: ${formatStatus(budgetStatus.status)}`}
        />

        <AnalyticsCard
          title="Top category"
          value={categoryTotals[0] ? categoryTotals[0].category : "N/A"}
          description={
            categoryTotals[0]
              ? `${formatEUR(categoryTotals[0].amount)} tracked`
              : "Add more splits to see insights"
          }
          accent="neutral"
        />

        <AnalyticsCard
          title="Active friends"
          value={friends.length}
          description="Friends with whom you share expenses"
          accent="neutral"
          footer={
            topBalances[0]
              ? `${topBalances[0].name} has the largest balance`
              : "Balances are currently settled"
          }
        />
      </div>

      <div className={styles.grid}>
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Monthly trend</h2>
          <AnalyticsTrendChart data={monthlyTrend} />
        </div>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Category totals</h2>
          <AnalyticsCategoryList categories={categoryTotals.slice(0, 6)} />
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Balances snapshot</h2>
        {topBalances.length === 0 ? (
          <div className="kicker">All balances are settled right now.</div>
        ) : (
          <div className={styles.topList}>
            {topBalances.map((item) => {
              const amountClass =
                item.amount > 0
                  ? styles.friendAmountPositive
                  : item.amount < 0
                  ? styles.friendAmountNegative
                  : styles.friendAmountNeutral;

              const statusLabel = item.amount > 0 ? "owes you" : "you owe";

              return (
                <div key={item.friendId} className={styles.friendRow}>
                  <div>
                    <div className={styles.friendName}>{item.name}</div>
                    <div className="kicker">
                      {item.amount === 0 ? "Settled" : statusLabel}
                    </div>
                  </div>
                  <div className={amountClass}>{formatEUR(Math.abs(item.amount))}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
