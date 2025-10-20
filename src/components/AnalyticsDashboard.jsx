import { useCallback, useMemo, useState } from "react";
import { formatEUR } from "../lib/money";
import { CATEGORIES } from "../lib/categories";
import { selectMonthlyBudget } from "../lib/selectors";
import AnalyticsCard from "./AnalyticsCard";
import AnalyticsCategoryList from "./AnalyticsCategoryList";
import AnalyticsTrendChart from "./AnalyticsTrendChart";
import AnalyticsFriendBalances from "./AnalyticsFriendBalances";
import AnalyticsNetBalanceChart from "./AnalyticsNetBalanceChart";
import AnalyticsVolumeBars from "./AnalyticsVolumeBars";
import {
  CategoryFilter,
  DateRangeFilter,
  useTransactionFilters,
} from "./filters";
import {
  computeAnalyticsOverview,
  computeCategoryBreakdown,
  computeCategoryTotals,
  computeMonthlyTrend,
  computeBudgetStatus,
  computeFriendBalances,
  computeMonthlyVolume,
} from "../lib/analytics";
import AnalyticsBudgetSummary from "./AnalyticsBudgetSummary";
import BudgetManager from "./BudgetManager";
import { useTransactionsStoreState } from "../hooks/useTransactionsStore";
import {
  selectBudgetAggregates,
  selectBudgetTotals,
  selectBudgets,
} from "../state/transactionsStore";

function formatCurrency(value) {
  return formatEUR(value ?? 0);
}

export default function AnalyticsDashboard({
  transactions,
  state,
}) {
  const sourceTransactions = useMemo(() => {
    if (Array.isArray(transactions)) {
      return transactions;
    }
    if (state && Array.isArray(state.transactions)) {
      return state.transactions;
    }
    if (Array.isArray(state)) {
      return state;
    }
    return [];
  }, [transactions, state]);

  const legacyBudget = useMemo(() => selectMonthlyBudget(state), [state]);
  const [showBudgetManager, setShowBudgetManager] = useState(false);

  const {
    filters,
    setCategory,
    setDateRange,
    resetFilters,
    hasActiveFilters,
    applyFilters,
  } = useTransactionFilters();

  const filteredTransactions = useMemo(
    () => applyFilters(sourceTransactions),
    [sourceTransactions, applyFilters]
  );

  const hasTransactions = filteredTransactions.length > 0;

  const overview = useMemo(
    () => computeAnalyticsOverview(filteredTransactions),
    [filteredTransactions]
  );
  const totalVolume = overview.totalVolume;

  const topCategories = useMemo(() => {
    const totals = computeCategoryTotals(filteredTransactions);
    return totals.slice(0, 6);
  }, [filteredTransactions]);

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(filteredTransactions),
    [filteredTransactions]
  );

  const trend = useMemo(
    () => computeMonthlyTrend(filteredTransactions, 6),
    [filteredTransactions]
  );

  const volumeBarsData = useMemo(
    () => {
      const volume = computeMonthlyVolume(filteredTransactions, 6);
      if (volume.length > 0) return volume;
      if (trend.length > 0) return trend;
      if (totalVolume > 0) {
        return [
          {
            key: "total-volume",
            label: "All time",
            amount: totalVolume,
          },
        ];
      }
      return [];
    },
    [filteredTransactions, trend, totalVolume]
  );

  const storeSnapshot = useTransactionsStoreState();
  const budgetAggregates = useMemo(() => {
    void storeSnapshot.transactions.length;
    void Object.keys(storeSnapshot.budgets).length;
    return selectBudgetAggregates();
  }, [storeSnapshot]);
  const budgetTotals = useMemo(() => {
    void storeSnapshot.transactions.length;
    void Object.keys(storeSnapshot.budgets).length;
    return selectBudgetTotals();
  }, [storeSnapshot]);
  const budgets = useMemo(() => {
    void Object.keys(storeSnapshot.budgets).length;
    return selectBudgets();
  }, [storeSnapshot]);

  const configuredBudgetCount = useMemo(
    () => budgetAggregates.filter((entry) => entry.budget !== null).length,
    [budgetAggregates]
  );
  const hasConfiguredBudgets = configuredBudgetCount > 0;

  const budgetStatus = useMemo(() => {
    if (hasConfiguredBudgets) {
      const {
        totalBudgeted,
        totalSpentAgainstBudget,
        totalRemaining,
        totalOverBudget,
      } = budgetTotals;
      const utilization =
        totalBudgeted > 0 ? totalSpentAgainstBudget / totalBudgeted : 0;
      let status = "on-track";
      if (totalBudgeted > 0) {
        if (totalSpentAgainstBudget >= totalBudgeted) {
          status = "over";
        } else if (utilization >= 0.9) {
          status = "warning";
        }
      }
      return {
        source: "category",
        budget: totalBudgeted,
        spent: totalSpentAgainstBudget,
        remaining: totalRemaining,
        utilization,
        status,
        totalOverBudget,
        configuredCount: configuredBudgetCount,
      };
    }
    const fallback = computeBudgetStatus(filteredTransactions, legacyBudget);
    return { ...fallback, source: "legacy" };
  }, [
    configuredBudgetCount,
    hasConfiguredBudgets,
    budgetTotals,
    filteredTransactions,
    legacyBudget,
  ]);

  const friendBalances = useMemo(
    () => computeFriendBalances(filteredTransactions),
    [filteredTransactions]
  );

  const friends = state?.friends;

  const friendBalanceEntries = useMemo(() => {
    if (!friendBalances.length) return [];
    const friendsList = Array.isArray(friends) ? friends : [];
    const entries = [];
    for (const entry of friendBalances) {
      const friend =
        friendsList.find((f) => f && f.id === entry.friendId) || null;
      const name =
        friend?.name?.trim() ||
        friend?.email?.trim() ||
        entry.friendId;
      entries.push({
        friendId: entry.friendId,
        balance: entry.balance,
        name,
      });
    }
    return entries;
  }, [friendBalances, friends]);

  const netAccent = overview.netBalance >= 0 ? "brand" : "danger";
  const budgetAccent =
    budgetStatus.status === "over"
      ? "danger"
      : budgetStatus.status === "warning"
      ? "danger"
      : "brand";
  const budgetStatusLabel =
    budgetStatus.status === "over"
      ? "Over budget"
      : budgetStatus.status === "warning"
      ? "Close to limit"
      : "On track";
  const budgetDescription =
    budgetStatus.source === "category"
      ? `${formatCurrency(budgetStatus.spent)} of ${formatCurrency(
          budgetStatus.budget
        )} allocated across ${budgetStatus.configuredCount} category${
          budgetStatus.configuredCount === 1 ? "" : "ies"
        }`
      : `${formatCurrency(budgetStatus.spent)} of ${formatCurrency(
          budgetStatus.budget
        )} spent this month`;
  const utilizationPercent = Math.round((budgetStatus.utilization ?? 0) * 100);
  const budgetFooter =
    budgetStatus.source === "category"
      ? budgetStatus.status === "over" && budgetStatus.totalOverBudget > 0
        ? `${budgetStatusLabel} | Over by ${formatCurrency(
            budgetStatus.totalOverBudget
          )} | ${budgetStatus.configuredCount} category${
            budgetStatus.configuredCount === 1 ? "" : "ies"
          }`
        : `${budgetStatusLabel} | ${utilizationPercent}% used | ${
            budgetStatus.configuredCount
          } category${budgetStatus.configuredCount === 1 ? "" : "ies"}`
      : `${budgetStatusLabel} | ${utilizationPercent}% of monthly budget`;

  const openBudgetManager = useCallback(() => setShowBudgetManager(true), []);
  const closeBudgetManager = useCallback(() => setShowBudgetManager(false), []);

  return (
    <section className="analytics-view" aria-label="Analytics dashboard">
      <header className="analytics-view__header">
        <div>
          <h2>Analytics</h2>
          <p className="analytics-view__subtitle">
            Track shared expenses and spot trends at a glance.
          </p>
        </div>
        {hasActiveFilters && (
          <div className="analytics-view__actions">
            {hasActiveFilters && (
              <button
                type="button"
                className="btn-ghost"
                onClick={resetFilters}
              >
                Reset filters
              </button>
            )}
          </div>
        )}
      </header>

      <div className="analytics-view__filters">
        <CategoryFilter
          categories={CATEGORIES}
          value={filters.category}
          onChange={setCategory}
        />
        <DateRangeFilter value={filters.dateRange} onChange={setDateRange} />
      </div>

      {!hasTransactions ? (
        <p className="kicker">
          No transactions match the selected filters yet.
        </p>
      ) : (
        <>
          <div className="analytics-view__stats">
            <AnalyticsCard
              title="Net balance"
              value={formatCurrency(overview.netBalance)}
              accent={netAccent}
              description="What remains after settling up with everyone."
              footer={`Owed to you: ${formatCurrency(
                overview.owedToYou
              )} | You owe: ${formatCurrency(overview.youOwe)}`}
            >
              <AnalyticsNetBalanceChart
                owedToYou={overview.owedToYou}
                youOwe={overview.youOwe}
              />
            </AnalyticsCard>
            <AnalyticsCard
              title="Total volume"
              value={formatCurrency(overview.totalVolume)}
              description={`Across ${overview.count} transaction${
                overview.count === 1 ? "" : "s"
              }`}
              footer={`Average per transaction: ${formatCurrency(
                overview.average
              )}`}
            >
              <AnalyticsVolumeBars data={volumeBarsData} />
            </AnalyticsCard>
            <AnalyticsCard
              title="Budget status"
              value={formatCurrency(budgetStatus.remaining)}
              accent={budgetAccent}
              description={budgetDescription}
              footer={budgetFooter}
            >
              <AnalyticsBudgetSummary
                aggregates={budgetAggregates}
                onManageBudgets={openBudgetManager}
              />
            </AnalyticsCard>
          </div>

          <div className="analytics-view__visuals">
            <AnalyticsCard
              title="Monthly trend"
              description="Six-month view of your share of spending."
              className="analytics-view__visual-card"
            >
              <AnalyticsTrendChart data={trend} />
            </AnalyticsCard>
            <AnalyticsCard
              title="Top categories"
              description="Where your biggest shared expenses land."
              className="analytics-view__visual-card"
            >
              <AnalyticsCategoryList categories={topCategories} />
            </AnalyticsCard>
            <AnalyticsCard
              title="Friend balances"
              description="Who currently owes whom the most."
              className="analytics-view__visual-card"
            >
              <AnalyticsFriendBalances entries={friendBalanceEntries} />
            </AnalyticsCard>
          </div>

          <AnalyticsCard
            title="Category breakdown"
            description="Dig into how often and how much you spend by category."
          >
            <div className="analytics-table-wrapper">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" className="numeric">
                      Transactions
                    </th>
                    <th scope="col" className="numeric">
                      Volume
                    </th>
                    <th scope="col" className="numeric">
                      Share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categoryBreakdown.map((row) => (
                    <tr key={row.category}>
                      <th scope="row">{row.category}</th>
                      <td className="numeric">{row.count}</td>
                      <td className="numeric">{formatCurrency(row.total)}</td>
                      <td className="numeric">{row.percentage}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnalyticsCard>
        </>
      )}
      {showBudgetManager ? (
        <BudgetManager
          onClose={closeBudgetManager}
          categories={CATEGORIES}
          aggregates={budgetAggregates}
          budgets={budgets}
        />
      ) : null}
    </section>
  );
}
