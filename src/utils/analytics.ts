import { Transaction, TransactionEffect } from "../types/transaction";
import { CATEGORIES } from "../lib/categories";

const UNCATEGORIZED = "Uncategorized";
const UNKNOWN_MONTH = "unknown";
const KNOWN_CATEGORIES = new Map(
  CATEGORIES.map((category) => [category.toLowerCase(), category])
);

function roundToCents(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

function safePositiveNumber(value: unknown): number {
  const num = typeof value === "string" ? Number(value) : (value as number);
  if (typeof num !== "number" || !Number.isFinite(num) || num <= 0) {
    return 0;
  }
  return roundToCents(num);
}

function normalizeCategory(category: string | null | undefined): string {
  if (typeof category !== "string") return UNCATEGORIZED;
  const trimmed = category.trim();
  if (!trimmed) return UNCATEGORIZED;
  const lower = trimmed.toLowerCase();
  if (KNOWN_CATEGORIES.has(lower)) {
    return KNOWN_CATEGORIES.get(lower)!;
  }
  if (lower === UNCATEGORIZED.toLowerCase()) {
    return UNCATEGORIZED;
  }
  return trimmed
    .split(/\s+/u)
    .map((word) => {
      if (!word) return word;
      const [first, ...rest] = word.split("");
      return first.toUpperCase() + rest.join("").toLowerCase();
    })
    .join(" ");
}

function getMonthKey(createdAt: string | null | undefined): string {
  if (!createdAt) return UNKNOWN_MONTH;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return UNKNOWN_MONTH;
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function isConfirmedSettlement(
  transaction: Transaction | null | undefined
): boolean {
  if (!transaction) return true;
  if (transaction.type !== "settlement") return true;
  const status =
    typeof transaction.settlementStatus === "string"
      ? transaction.settlementStatus.trim().toLowerCase()
      : null;
  if (!status) return true;
  return status === "confirmed";
}

function effectAmount(effect: TransactionEffect | null | undefined): number {
  if (!effect) return 0;
  const delta = typeof effect.delta === "number" ? effect.delta : 0;
  if (delta < 0) {
    return safePositiveNumber(Math.abs(delta));
  }
  if (delta === 0) {
    const share = safePositiveNumber(effect.share);
    if (share > 0) {
      return share;
    }
  }
  return 0;
}

type TransactionAmountOptions = {
  allowParticipantFallback?: boolean;
};

function getTransactionAmount(
  transaction: Transaction | null | undefined,
  options: TransactionAmountOptions = {}
): number {
  if (!transaction) return 0;
  const { allowParticipantFallback = true } = options;

  if (
    transaction.type === "settlement" &&
    !isConfirmedSettlement(transaction)
  ) {
    return 0;
  }

  const total = safePositiveNumber(transaction.total);
  if (total > 0) {
    return total;
  }

  if (Array.isArray(transaction.effects) && transaction.effects.length > 0) {
    const amount = transaction.effects.reduce(
      (sum, effect) => sum + effectAmount(effect),
      0
    );
    if (amount > 0) {
      return roundToCents(amount);
    }
  }

  if (allowParticipantFallback) {
    if (
      Array.isArray(transaction.participants) &&
      transaction.participants.length > 0
    ) {
      const amount = transaction.participants.reduce(
        (sum, participant) => sum + safePositiveNumber(participant?.amount),
        0
      );
      if (amount > 0) {
        return roundToCents(amount);
      }
    }
  }

  return 0;
}

export function totalSpendPerCategory(
  transactions: Transaction[] = []
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const transaction of transactions) {
    const amount = getTransactionAmount(transaction, {
      allowParticipantFallback: false,
    });
    if (amount <= 0) continue;
    const category = normalizeCategory(transaction?.category ?? null);
    const current = totals[category] ?? 0;
    totals[category] = roundToCents(current + amount);
  }
  return totals;
}

export function monthlySpendPerCategory(
  transactions: Transaction[] = []
): Record<string, Record<string, number>> {
  const totals: Record<string, Record<string, number>> = {};
  for (const transaction of transactions) {
    const amount = getTransactionAmount(transaction, {
      allowParticipantFallback: false,
    });
    if (amount <= 0) continue;
    const monthKey = getMonthKey(transaction?.createdAt ?? null);
    if (!totals[monthKey]) {
      totals[monthKey] = {};
    }
    const category = normalizeCategory(transaction?.category ?? null);
    const current = totals[monthKey][category] ?? 0;
    totals[monthKey][category] = roundToCents(current + amount);
  }
  return totals;
}

export interface BudgetComparisonEntry {
  actual: number;
  target: number;
  remaining: number;
}

export function compareBudgetByCategory(
  actuals: Record<string, number> = {},
  targets: Record<string, number> = {}
): Record<string, BudgetComparisonEntry> {
  const categories = new Set<string>([
    ...Object.keys(actuals ?? {}),
    ...Object.keys(targets ?? {}),
  ]);

  const result: Record<string, BudgetComparisonEntry> = {};
  for (const category of categories) {
    const actual = safePositiveNumber(actuals?.[category] ?? 0);
    const target = safePositiveNumber(targets?.[category] ?? 0);
    const remaining = roundToCents(target - actual);
    result[category] = {
      actual,
      target,
      remaining,
    };
  }

  return result;
}

// ============================================================================
// Legacy Analytics Port - Phase 1
// ============================================================================

export interface AnalyticsOverview {
  count: number;
  totalVolume: number;
  owedToYou: number;
  youOwe: number;
  netBalance: number;
  average: number;
}

export interface CategoryBreakdown {
  category: string;
  count: number;
  total: number;
  percentage: number;
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

export interface MonthlyDataPoint {
  key: string;
  label: string;
  amount: number;
}

export interface FriendBalance {
  friendId: string;
  balance: number;
}

export interface BudgetStatus {
  budget: number;
  spent: number;
  remaining: number;
  utilization: number;
  status: "on-track" | "warning" | "over";
}

// Helper functions

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMonthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

// Legacy transaction formats (for backward compatibility)
interface LegacyTransaction {
  delta?: number;
  half?: number;
}

function getTransactionEffects(
  tx: Transaction | null | undefined
): TransactionEffect[] {
  if (!tx || typeof tx !== "object") return [];
  if (Array.isArray(tx.effects)) {
    return tx.effects
      .map((e) => {
        if (!e || typeof e.friendId !== "string") return null;
        const delta = typeof e.delta === "number" ? e.delta : 0;
        const share = typeof e.share === "number" ? e.share : 0;
        return {
          friendId: e.friendId,
          delta: Number.isFinite(delta) ? delta : 0,
          share: Number.isFinite(share) ? share : 0,
        };
      })
      .filter((e): e is TransactionEffect => e !== null);
  }

  if (tx.type === "settlement") {
    if (typeof tx.friendId !== "string") return [];
    const legacyTx = tx as Transaction & LegacyTransaction;
    const delta = typeof legacyTx.delta === "number" ? legacyTx.delta : 0;
    return [
      {
        friendId: tx.friendId,
        delta,
        share: Math.abs(delta),
      },
    ];
  }

  if (tx.type === "split" && typeof tx.friendId === "string") {
    const legacyTx = tx as Transaction & LegacyTransaction;
    const share = typeof legacyTx.half === "number" ? legacyTx.half : null;
    const normalizedShare = share !== null && share >= 0 ? share : null;
    const delta = typeof legacyTx.delta === "number" ? legacyTx.delta : 0;
    return [
      {
        friendId: tx.friendId,
        delta,
        share: normalizedShare ?? Math.abs(delta),
      },
    ];
  }

  return [];
}

function getPersonalShare(transaction: Transaction | null | undefined): number {
  if (!transaction || typeof transaction !== "object") return 0;

  if (Array.isArray(transaction.participants)) {
    const you = transaction.participants.find((p) => p?.id === "you");
    const amount = typeof you?.amount === "number" ? you.amount : 0;
    if (Number.isFinite(amount) && amount > 0) {
      return roundToCents(amount);
    }
  }

  const total = typeof transaction.total === "number" ? transaction.total : 0;
  if (transaction.payer === "you" && Number.isFinite(total) && total > 0) {
    return roundToCents(total);
  }

  return 0;
}

function getTransactionVolume(
  transaction: Transaction | null | undefined
): number {
  if (!transaction || typeof transaction !== "object") return 0;

  const rawTotal =
    typeof transaction.total === "number" ? transaction.total : 0;
  if (Number.isFinite(rawTotal) && rawTotal !== 0) {
    return Math.abs(rawTotal);
  }

  const effects = getTransactionEffects(transaction);
  if (!Array.isArray(effects) || effects.length === 0) {
    return 0;
  }

  let amount = 0;
  for (const effect of effects) {
    const share = typeof effect?.share === "number" ? effect.share : 0;
    if (Number.isFinite(share) && share > 0) {
      amount += share;
      continue;
    }
    const delta = typeof effect?.delta === "number" ? effect.delta : 0;
    if (Number.isFinite(delta) && delta !== 0) {
      amount += Math.abs(delta);
    }
  }

  return amount;
}

// Main analytics functions

export function computeAnalyticsOverview(
  transactions: Transaction[]
): AnalyticsOverview {
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
      const delta = typeof effect?.delta === "number" ? effect.delta : 0;
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

export function computeCategoryBreakdown(
  transactions: Transaction[]
): CategoryBreakdown[] {
  const categories = new Map<string, { count: number; total: number }>();
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

export function computeCategoryTotals(
  transactions: Transaction[]
): CategoryTotal[] {
  const totals = new Map<string, number>();

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

export function computeMonthlyTrend(
  transactions: Transaction[],
  months = 6
): MonthlyDataPoint[] {
  const buckets = new Map<string, number>();

  for (const tx of transactions || []) {
    const createdAt = toDate(tx?.createdAt || tx?.updatedAt);
    if (!createdAt) continue;

    const share = getPersonalShare(tx);
    if (share <= 0) continue;

    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;

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

export function computeFriendBalances(
  transactions: Transaction[]
): FriendBalance[] {
  const totals = new Map<string, number>();

  for (const tx of transactions || []) {
    if (!tx || typeof tx !== "object") continue;
    if (tx.type === "settlement" && !isConfirmedSettlement(tx)) continue;
    const effects = getTransactionEffects(tx);
    for (const effect of effects) {
      const friendId =
        typeof effect?.friendId === "string" ? effect.friendId : null;
      if (!friendId) continue;
      const delta = typeof effect?.delta === "number" ? effect.delta : 0;
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

export function computeMonthlyVolume(
  transactions: Transaction[],
  months = 6
): MonthlyDataPoint[] {
  const buckets = new Map<string, number>();
  let latestDate: Date | null = null;

  for (const tx of transactions || []) {
    const createdAt = toDate(tx?.createdAt || tx?.updatedAt);
    if (!createdAt) continue;

    const volume = getTransactionVolume(tx);
    if (!(Number.isFinite(volume) && volume > 0)) continue;

    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;

    const current = buckets.get(key) || 0;
    buckets.set(key, current + volume);
    if (!latestDate || createdAt > latestDate) {
      latestDate = createdAt;
    }
  }

  if (!latestDate || buckets.size === 0) {
    return [];
  }

  const safeMonths = Math.max(
    1,
    Number.isFinite(months) ? Math.floor(months) : 1
  );
  const result: MonthlyDataPoint[] = [];
  let hasData = false;

  for (let offset = safeMonths - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      latestDate.getFullYear(),
      latestDate.getMonth() - offset,
      1
    );
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;

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
  transactions: Transaction[],
  monthlyBudget = 0,
  today: Date = new Date()
): BudgetStatus {
  const budget = roundToCents(
    Math.max(0, typeof monthlyBudget === "number" ? monthlyBudget || 0 : 0)
  );

  const safeToday =
    today instanceof Date && !Number.isNaN(today.getTime())
      ? today
      : new Date();

  const currentYear = safeToday.getFullYear();
  const currentMonth = String(safeToday.getMonth() + 1).padStart(2, "0");
  const currentMonthKey = `${currentYear}-${currentMonth}`;

  let spent = 0;
  for (const tx of transactions || []) {
    const createdAt = toDate(tx?.createdAt || tx?.updatedAt);
    if (!createdAt) continue;

    const year = createdAt.getFullYear();
    const month = String(createdAt.getMonth() + 1).padStart(2, "0");
    const key = `${year}-${month}`;

    if (key !== currentMonthKey) continue;

    const share = getPersonalShare(tx);
    if (share <= 0) continue;

    spent += share;
  }

  spent = roundToCents(spent);
  const remaining = roundToCents(Math.max(budget - spent, 0));
  const utilization = budget > 0 ? spent / budget : 0;

  let status: "on-track" | "warning" | "over" = "on-track";
  if (budget > 0) {
    if (utilization >= 1) {
      status = "over";
    } else if (utilization >= 0.9) {
      status = "warning";
    }
  }

  return { budget, spent, remaining, utilization, status };
}

export { getTransactionAmount as __testOnlyGetTransactionAmount };
