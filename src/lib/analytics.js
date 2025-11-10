/**
 * @deprecated This file is deprecated and will be removed in a future version.
 * Please use src/utils/analytics.ts instead.
 * 
 * Migration completed in PR #33. This file remains temporarily for any
 * external references but should not be used in new code.
 */

import { roundToCents } from "./money";
import { getTransactionEffects } from "./transactions";

function isConfirmedSettlement(transaction) {
  if (!transaction || typeof transaction !== "object") return true;
  if (transaction.type !== "settlement") return true;
  const status = typeof transaction.settlementStatus === "string"
    ? transaction.settlementStatus.trim().toLowerCase()
    : null;
  if (!status) return true;
  if (status === "confirmed") return true;
  return false;
}

function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}`;
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

function getTransactionVolume(transaction) {
  if (!transaction || typeof transaction !== "object") return 0;

  const rawTotal = Number(transaction.total);
  if (Number.isFinite(rawTotal) && rawTotal !== 0) {
    return Math.abs(rawTotal);
  }

  const effects = getTransactionEffects(transaction);
  if (!Array.isArray(effects) || effects.length === 0) {
    return 0;
  }

  let amount = 0;
  for (const effect of effects) {
    const share = Number(effect?.share);
    if (Number.isFinite(share) && share > 0) {
      amount += share;
      continue;
    }
    const delta = Number(effect?.delta);
    if (Number.isFinite(delta) && delta !== 0) {
      amount += Math.abs(delta);
    }
  }

  return amount;
}

export function computeCategoryTotals(transactions) {
  const totals = new Map();

  for (const tx of transactions || []) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.type && tx.type !== "split") continue;

    const category =
      typeof tx.category === "string" && tx.category.trim()
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

export function computeAnalyticsOverview(transactions) {
  let count = 0;
  let totalVolume = 0;
  let owedToYou = 0;
  let youOwe = 0;

  for (const tx of transactions || []) {
    if (!tx || typeof tx !== "object") continue;
    const includeSettlement = isConfirmedSettlement(tx);
    count += 1;

    const effects = getTransactionEffects(tx);

    totalVolume += getTransactionVolume(tx);

    for (const effect of effects) {
      if (tx.type === "settlement" && !includeSettlement) {
        continue;
      }
      const delta = Number(effect?.delta);
      if (!Number.isFinite(delta) || delta === 0) continue;
      if (delta > 0) {
        owedToYou += delta;
      } else {
        youOwe += Math.abs(delta);
      }
    }
  }

  const roundedTotalVolume = roundToCents(totalVolume);
  const roundedOwedToYou = roundToCents(owedToYou);
  const roundedYouOwe = roundToCents(youOwe);
  const netBalance = roundToCents(owedToYou - youOwe);
  const average = count > 0 ? roundToCents(totalVolume / count) : 0;

  return {
    count,
    totalVolume: roundedTotalVolume,
    owedToYou: roundedOwedToYou,
    youOwe: roundedYouOwe,
    netBalance,
    average,
  };
}

export function computeCategoryBreakdown(transactions) {
  const categories = new Map();
  let overall = 0;

  for (const tx of transactions || []) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.type && tx.type !== "split") continue;

    const category =
      typeof tx.category === "string" && tx.category.trim()
        ? tx.category.trim()
        : "Uncategorized";

    const share = getPersonalShare(tx);
    if (share <= 0) continue;

    overall += share;
    const current = categories.get(category) || { count: 0, total: 0 };
    current.count += 1;
    current.total = roundToCents(current.total + share);
    categories.set(category, current);
  }

  const grandTotal = roundToCents(overall);

  return Array.from(categories.entries())
    .map(([category, info]) => {
      const { count, total } = info;
      const percentage =
        grandTotal > 0 ? Math.round((total / grandTotal) * 1000) / 10 : 0;
      return {
        category,
        count,
        total,
        percentage,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function computeFriendBalances(transactions) {
  const totals = new Map();

  for (const tx of transactions || []) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.type === "settlement" && !isConfirmedSettlement(tx)) continue;
    const effects = getTransactionEffects(tx);
    for (const effect of effects) {
      const friendId = typeof effect?.friendId === "string" ? effect.friendId : null;
      if (!friendId) continue;
      const delta = Number(effect?.delta);
      if (!Number.isFinite(delta) || delta === 0) continue;
      const current = totals.get(friendId) || 0;
      totals.set(friendId, roundToCents(current + delta));
    }
  }

  return Array.from(totals.entries())
    .map(([friendId, balance]) => ({ friendId, balance }))
    .filter((entry) => entry.balance !== 0)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
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

export function computeMonthlyVolume(transactions, months = 6) {
  const buckets = new Map();
  let latestDate = null;

  for (const tx of transactions || []) {
    const createdAt = toDate(tx?.createdAt || tx?.updatedAt);
    if (!createdAt) continue;

    const volume = getTransactionVolume(tx);
    if (!(Number.isFinite(volume) && volume > 0)) continue;

    const key = getMonthKey(createdAt);
    const current = buckets.get(key) || 0;
    buckets.set(key, current + volume);
    if (!latestDate || createdAt > latestDate) {
      latestDate = createdAt;
    }
  }

  if (!latestDate || buckets.size === 0) {
    return [];
  }

  const safeMonths = Math.max(1, Number.isFinite(months) ? Math.floor(months) : 1);
  const result = [];
  let hasData = false;

  for (let offset = safeMonths - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      latestDate.getFullYear(),
      latestDate.getMonth() - offset,
      1
    );
    const key = getMonthKey(date);
    const amount = roundToCents(buckets.get(key) || 0);
    if (amount > 0) {
      hasData = true;
    }
    result.push({
      key,
      label: formatMonthLabel(key),
      amount,
    });
  }

  return hasData ? result : [];
}

export function computeBudgetStatus(
  transactions,
  monthlyBudget = 0,
  today = new Date()
) {
  const budget = roundToCents(Number(monthlyBudget) || 0);

  const safeToday =
    today instanceof Date && !Number.isNaN(today.getTime())
      ? today
      : new Date();

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
