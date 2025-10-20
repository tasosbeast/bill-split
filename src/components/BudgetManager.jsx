import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Modal from "./Modal";
import styles from "./BudgetManager.module.css";
import { formatEUR, roundToCents } from "../lib/money";
import {
  clearAllBudgets,
  selectPreviousMonthCategorySpend,
  setCategoryBudget,
} from "../state/transactionsStore";
import { useTransactionsStoreState } from "../hooks/useTransactionsStore";

function formatBudgetValue(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  return String(value);
}

export default function BudgetManager({
  onClose,
  categories,
  aggregates,
  budgets,
}) {
  const storeSnapshot = useTransactionsStoreState();

  const categorySet = useMemo(() => {
    const set = new Set(categories);
    for (const aggregate of aggregates) {
      set.add(aggregate.category);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, aggregates]);

  const aggregateMap = useMemo(() => {
    const map = new Map();
    for (const aggregate of aggregates) {
      map.set(aggregate.category, aggregate);
    }
    return map;
  }, [aggregates]);

  const [drafts, setDrafts] = useState(() => {
    const initial = {};
    for (const category of categorySet) {
      const budget = budgets[category];
      initial[category] = formatBudgetValue(budget);
    }
    return initial;
  });

  useEffect(() => {
    setDrafts((previous) => {
      const next = { ...previous };
      let mutated = false;
      for (const category of categorySet) {
        const budget = budgets[category];
        const formatted = formatBudgetValue(budget);
        if (next[category] !== formatted) {
          next[category] = formatted;
          mutated = true;
        }
      }
      return mutated ? next : previous;
    });
  }, [budgets, categorySet]);

  const hasBudgets = Object.keys(budgets).length > 0;

  const hasPreviousMonthData = useMemo(() => {
    void storeSnapshot.transactions.length;
    const previous = selectPreviousMonthCategorySpend();
    return Object.keys(previous).length > 0;
  }, [storeSnapshot]);

  const rows = useMemo(() => {
    return categorySet.map((category) => {
      const aggregate = aggregateMap.get(category);
      const budgetValue =
        typeof budgets[category] === "number" ? budgets[category] : null;
      const budget =
        aggregate?.budget !== undefined && aggregate?.budget !== null
          ? aggregate.budget
          : budgetValue;
      const spent = aggregate?.spent ?? 0;
      const isOverBudget =
        aggregate?.isOverBudget ?? (typeof budget === "number" && spent > budget);
      const remaining =
        typeof budget === "number" ? roundToCents(budget - spent) : null;
      const utilization =
        typeof budget === "number" && budget > 0
          ? Math.round(((aggregate?.utilization ?? spent / budget) || 0) * 1000) /
            1000
          : null;
      return {
        category,
        budget: typeof budget === "number" ? roundToCents(budget) : null,
        spent: roundToCents(spent),
        remaining,
        utilization,
        isOverBudget,
      };
    });
  }, [aggregateMap, budgets, categorySet]);

  function commitBudget(category) {
    const rawValue = drafts[category];
    const normalized = typeof rawValue === "string" ? rawValue.trim() : "";
    const currentBudget =
      typeof budgets[category] === "number" ? budgets[category] : null;

    if (normalized.length === 0) {
      if (currentBudget !== null) {
        setCategoryBudget(category, null);
      }
      return;
    }

    const parsed = Number(normalized.replace(/,/g, "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setDrafts((previous) => ({
        ...previous,
        [category]: formatBudgetValue(currentBudget ?? null),
      }));
      return;
    }

    const rounded = roundToCents(parsed);
    if (currentBudget === rounded) {
      setDrafts((previous) => ({ ...previous, [category]: formatBudgetValue(rounded) }));
      return;
    }
    setCategoryBudget(category, rounded);
    setDrafts((previous) => ({ ...previous, [category]: formatBudgetValue(rounded) }));
  }

  function handleInputChange(category, value) {
    setDrafts((previous) => ({ ...previous, [category]: value }));
  }

  function handleKeyDown(event, category) {
    if (event.key === "Enter") {
      event.preventDefault();
      commitBudget(category);
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      const currentBudget =
        typeof budgets[category] === "number" ? budgets[category] : null;
      setDrafts((previous) => ({
        ...previous,
        [category]: formatBudgetValue(currentBudget ?? null),
      }));
      event.currentTarget.blur();
    }
  }

  function handleCopyPreviousMonth() {
    const previous = selectPreviousMonthCategorySpend();
    if (Object.keys(previous).length === 0) {
      return;
    }
    for (const [category, amount] of Object.entries(previous)) {
      setCategoryBudget(category, amount);
    }
  }

  function handleClearBudgets() {
    if (!hasBudgets) return;
    const confirmation = window.confirm(
      "Clear every category budget? This cannot be undone."
    );
    if (!confirmation) return;
    clearAllBudgets();
    setDrafts((previous) => {
      const next = { ...previous };
      for (const category of categorySet) {
        next[category] = "";
      }
      return next;
    });
  }

  return (
    <Modal title="Manage category budgets" onClose={onClose}>
      {({ firstFieldRef }) => (
        <div className={styles.manager}>
          <div className={styles.actions}>
            <div className={styles.actionButtons}>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleCopyPreviousMonth}
                disabled={!hasPreviousMonthData}
              >
                Copy last month’s spend
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={handleClearBudgets}
                disabled={!hasBudgets}
              >
                Clear all budgets
              </button>
            </div>
            <p className={styles.helperText}>
              Budgets apply to your share of each category. Leave a field blank for no
              limit.
            </p>
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col" className={styles.numeric}>
                    Monthly budget
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Spent this month
                  </th>
                  <th scope="col" className={styles.numeric}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const remainingLabel =
                    row.budget === null
                      ? "No limit"
                      : row.isOverBudget
                      ? `Over by ${formatEUR(Math.abs(row.remaining ?? 0))}`
                      : `${formatEUR(row.remaining ?? 0)} left`;
                  const progress =
                    typeof row.utilization === "number"
                      ? Math.max(0, Math.min(row.utilization, 1))
                      : 0;
                  return (
                    <tr
                      key={row.category}
                      className={row.isOverBudget ? styles.overBudget : undefined}
                    >
                      <th scope="row">{row.category}</th>
                      <td className={styles.numeric}>
                        <div className={styles.inputGroup}>
                          <span className={styles.currency} aria-hidden="true">€</span>
                          <input
                            ref={index === 0 ? firstFieldRef : undefined}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            className={styles.input}
                            value={drafts[row.category] ?? ""}
                            placeholder="No limit"
                            onChange={(event) =>
                              handleInputChange(row.category, event.target.value)
                            }
                            onBlur={() => commitBudget(row.category)}
                            onKeyDown={(event) => handleKeyDown(event, row.category)}
                          />
                        </div>
                      </td>
                      <td className={styles.numeric}>{formatEUR(row.spent)}</td>
                      <td className={styles.numeric}>
                        <div className={styles.status}>
                          <span>{remainingLabel}</span>
                          {row.budget !== null ? (
                            <div className={styles.progress} aria-hidden="true">
                              <div
                                className={`${styles.progressBar} ${
                                  row.isOverBudget ? styles.progressBarOver : ""
                                }`.trim()}
                                style={{ width: `${progress * 100}%` }}
                              />
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Modal>
  );
}

BudgetManager.propTypes = {
  onClose: PropTypes.func.isRequired,
  categories: PropTypes.arrayOf(PropTypes.string).isRequired,
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
  budgets: PropTypes.objectOf(PropTypes.number).isRequired,
};
