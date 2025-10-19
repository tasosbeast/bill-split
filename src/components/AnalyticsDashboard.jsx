import { useMemo } from "react";
import { formatEUR } from "../lib/money";
import { CATEGORIES } from "../lib/categories";
import { DEFAULT_MONTHLY_BUDGET } from "../lib/selectors";
import AnalyticsCard from "./AnalyticsCard";
import AnalyticsCategoryList from "./AnalyticsCategoryList";
import AnalyticsTrendChart from "./AnalyticsTrendChart";
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
} from "../lib/analytics";

function formatCurrency(value) {
  return formatEUR(value ?? 0);
}

function selectMonthlyBudget(state) {
  const preferencesBudget = Number(state?.preferences?.monthlyBudget);
  if (Number.isFinite(preferencesBudget) && preferencesBudget > 0) {
    return preferencesBudget;
  }

  const directBudget = Number(state?.monthlyBudget);
  if (Number.isFinite(directBudget) && directBudget > 0) {
    return directBudget;
  }

  return DEFAULT_MONTHLY_BUDGET;
}

export default function AnalyticsDashboard({
  transactions,
  state,
  onNavigateHome,
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

  const budget = useMemo(() => selectMonthlyBudget(state), [state]);

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

  const topCategories = useMemo(
    () => computeCategoryTotals(filteredTransactions),
    [filteredTransactions]
  );

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(filteredTransactions),
    [filteredTransactions]
  );

  const trend = useMemo(
    () => computeMonthlyTrend(filteredTransactions, 6),
    [filteredTransactions]
  );

  const budgetStatus = useMemo(
    () => computeBudgetStatus(filteredTransactions, budget),
    [filteredTransactions, budget]
  );

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

  return (
    <section className="analytics-view" aria-label="Analytics dashboard">
      <header className="analytics-view__header">
        <div>
          <h2>Analytics</h2>
          <p className="analytics-view__subtitle">
            Track shared expenses and spot trends at a glance.
          </p>
        </div>
        {(onNavigateHome || hasActiveFilters) && (
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
            {onNavigateHome && (
              <button
                type="button"
                className="btn-ghost"
                onClick={onNavigateHome}
              >
                Back to app
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
            />
            <AnalyticsCard
              title="Total volume"
              value={formatCurrency(overview.totalVolume)}
              description={`Across ${overview.count} transaction${
                overview.count === 1 ? "" : "s"
              }`}
              footer={`Average per transaction: ${formatCurrency(
                overview.average
              )}`}
            />
            <AnalyticsCard
              title="Budget status"
              value={formatCurrency(budgetStatus.remaining)}
              accent={budgetAccent}
              description={`${formatCurrency(
                budgetStatus.spent
              )} of ${formatCurrency(budgetStatus.budget)} spent`}
              footer={`${budgetStatusLabel} | ${Math.round(
                budgetStatus.utilization * 100
              )}% of monthly budget`}
            />
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
    </section>
  );
}
