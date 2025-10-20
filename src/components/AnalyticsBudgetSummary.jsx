import PropTypes from "prop-types";
import { useMemo } from "react";
import { formatEUR } from "../lib/money";
import styles from "./AnalyticsBudgetSummary.module.css";

function clampPercentage(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(value, 1));
}

export default function AnalyticsBudgetSummary({ aggregates, onManageBudgets }) {
  const configuredBudgets = useMemo(() => {
    return aggregates
      .filter((entry) => entry.budget !== null)
      .sort((a, b) => {
        const aUtil = typeof a.utilization === "number" ? a.utilization : 0;
        const bUtil = typeof b.utilization === "number" ? b.utilization : 0;
        return bUtil - aUtil;
      });
  }, [aggregates]);

  const topEntries = configuredBudgets.slice(0, 4);

  if (configuredBudgets.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No category budgets yet. Set limits to track your monthly goals.</p>
        <button type="button" className="btn-ghost" onClick={onManageBudgets}>
          Create budgets
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ul className={styles.list}>
        {topEntries.map((entry) => {
          const utilization = typeof entry.utilization === "number" ? entry.utilization : 0;
          const percent = Math.round(utilization * 100);
          const progress = clampPercentage(utilization);
          const overBudgetAmount =
            entry.isOverBudget && typeof entry.budget === "number"
              ? Math.max(entry.spent - entry.budget, 0)
              : 0;
          const remainingLabel = entry.isOverBudget
            ? `Over by ${formatEUR(overBudgetAmount)}`
            : `${formatEUR(entry.remaining ?? 0)} left`;
          return (
            <li
              key={entry.category}
              className={`${styles.item} ${entry.isOverBudget ? styles.itemOver : ""}`.trim()}
            >
              <div className={styles.row}>
                <span>{entry.category}</span>
                <span>
                  {formatEUR(entry.spent)} / {formatEUR(entry.budget ?? 0)}
                </span>
              </div>
              <div className={styles.progress} aria-hidden="true">
                <div
                  className={`${styles.progressBar} ${
                    entry.isOverBudget ? styles.progressBarOver : ""
                  }`.trim()}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className={styles.meta}>
                <span>{remainingLabel}</span>
                <span>{percent}% used</span>
              </div>
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn-ghost" onClick={onManageBudgets}>
        Manage budgets
      </button>
    </div>
  );
}

AnalyticsBudgetSummary.propTypes = {
  aggregates: PropTypes.arrayOf(
    PropTypes.shape({
      category: PropTypes.string.isRequired,
      budget: PropTypes.number,
      spent: PropTypes.number.isRequired,
      remaining: PropTypes.number,
      isOverBudget: PropTypes.bool.isRequired,
      utilization: PropTypes.number,
    })
  ).isRequired,
  onManageBudgets: PropTypes.func.isRequired,
};
