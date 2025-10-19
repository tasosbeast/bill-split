import { roundToCents } from "./money";

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(key) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short" });
}

function getPersonalShare(transaction) {
  if (!transaction || typeof transaction !== "object") return 0;

  if (Array.isArray(transaction.participants)) {
    const you = transaction.participants.find((p) => p?.id === "you");
    const amount = Number(you?.amount);
    if (Number.isFinite(amount) && amount > 0) {
      return roundToCents(amount);
    }
  }

  const total = Number(transaction.total);
  if (transaction.payer === "you" && Number.isFinite(total) && total > 0) {
    return roundToCents(total);
  }

  return 0;
}

export function computeCategoryTotals(transactions) {
  const totals = new Map();

  for (const tx of transactions || []) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.type && tx.type !== "split") continue;

    const category = typeof tx.category === "string" && tx.category.trim()
      ? tx.category.trim()
      : "Uncategorized";

    const share = getPersonalShare(tx);
    if (share <= 0) continue;

    const current = totals.get(category) || 0;
    totals.set(category, roundToCents(current + share));
  }

  return Array.from(totals.entries())
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function computeMonthlyTrend(transactions, months = 6) {
  const buckets = new Map();

  for (const tx of transactions || []) {
    const createdAt = toDate(tx?.createdAt || tx?.updatedAt);
    if (!createdAt) continue;

    const share = getPersonalShare(tx);
    if (share <= 0) continue;

    const key = getMonthKey(createdAt);
    const current = buckets.get(key) || 0;
    buckets.set(key, roundToCents(current + share));
  }

  const orderedKeys = Array.from(buckets.keys()).sort();
  const recentKeys = orderedKeys.slice(-Math.max(months, 1));

  return recentKeys.map((key) => ({
    key,
    label: formatMonthLabel(key),
    amount: buckets.get(key) || 0,
  }));
}

export function computeBudgetStatus(transactions, monthlyBudget = 0, today = new Date()) {
  const budget = roundToCents(Number(monthlyBudget) || 0);

  const safeToday =
    today instanceof Date && !Number.isNaN(today.getTime()) ? today : new Date();

  const currentMonthKey = getMonthKey(safeToday);

  let spent = 0;
  for (const tx of transactions || []) {
    const createdAt = toDate(tx?.createdAt || tx?.updatedAt);
    if (!createdAt) continue;
    if (getMonthKey(createdAt) !== currentMonthKey) continue;

    const share = getPersonalShare(tx);
    if (share <= 0) continue;

    spent += share;
  }

  spent = roundToCents(spent);
  const remaining = roundToCents(Math.max(budget - spent, 0));
  const utilization = budget > 0 ? spent / budget : 0;

  let status = "on-track";
  if (budget > 0) {
    if (utilization >= 1) {
      status = "over";
    } else if (utilization >= 0.9) {
      status = "warning";
    }
  }

  return { budget, spent, remaining, utilization, status };
}
