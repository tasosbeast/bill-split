import { useMemo } from "react";
import { formatEUR, roundToCents } from "../lib/money";
import { CATEGORIES } from "../lib/categories";
import {
  CategoryFilter,
  DateRangeFilter,
  useTransactionFilters,
} from "./filters";
import {
  computeAnalyticsOverview,
  computeCategoryBreakdown,
} from "../lib/analytics";

export type AnalyticsDashboardProps = {
  transactions: any[];
};

function formatCurrency(value: number) {
  return formatEUR(roundToCents(value));
}

export default function AnalyticsDashboard({
  transactions,
}: AnalyticsDashboardProps) {
  const {
    filters,
    setCategory,
    setDateRange,
    resetFilters,
    hasActiveFilters,
    applyFilters,
  } = useTransactionFilters();

  const filteredTransactions = useMemo(
    () => applyFilters(transactions ?? []),
    [transactions, applyFilters],
  );

  const overview = useMemo(
    () => computeAnalyticsOverview(filteredTransactions),
    [filteredTransactions],
  );

  const categoryBreakdown = useMemo(
    () => computeCategoryBreakdown(filteredTransactions),
    [filteredTransactions],
  );

  const hasTransactions = filteredTransactions.length > 0;

  return (
    <section className="card analytics-card" aria-label="Analytics dashboard">
      <div className="analytics-card__header">
        <h2>Analytics</h2>
        {hasActiveFilters && (
          <button type="button" className="btn-ghost" onClick={resetFilters}>
            Reset filters
          </button>
        )}
      </div>
      <div className="analytics-card__filters">
        <CategoryFilter
          categories={CATEGORIES}
          value={filters.category}
          onChange={setCategory}
        />
        <DateRangeFilter value={filters.dateRange} onChange={setDateRange} />
      </div>

      {!hasTransactions ? (
        <p className="kicker">No transactions match the selected filters yet.</p>
      ) : (
        <>
          <div className="analytics-stats">
            <div className="analytics-stat">
              <span className="analytics-stat__label">Transactions</span>
              <span className="analytics-stat__value">{overview.count}</span>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__label">Total volume</span>
              <span className="analytics-stat__value">
                {formatCurrency(overview.totalVolume)}
              </span>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__label">Owed to you</span>
              <span className="analytics-stat__value analytics-stat__value--positive">
                {formatCurrency(overview.owedToYou)}
              </span>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__label">You owe</span>
              <span className="analytics-stat__value analytics-stat__value--negative">
                {formatCurrency(overview.youOwe)}
              </span>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__label">Net balance</span>
              <span
                className={`analytics-stat__value ${
                  overview.netBalance >= 0
                    ? "analytics-stat__value--positive"
                    : "analytics-stat__value--negative"
                }`}
              >
                {formatCurrency(overview.netBalance)}
              </span>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat__label">Average volume</span>
              <span className="analytics-stat__value">
                {formatCurrency(overview.average)}
              </span>
            </div>
          </div>

          <div className="analytics-breakdown">
            <h3>Category breakdown</h3>
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
          </div>
        </>
      )}
    </section>
  );
}
