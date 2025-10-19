import { Transaction, TransactionEffect } from "../types/transaction";
import { CATEGORIES } from "../lib/categories";

const UNCATEGORIZED = "Uncategorized";
const UNKNOWN_MONTH = "unknown";
const KNOWN_CATEGORIES = new Map(
  CATEGORIES.map((category) => [category.toLowerCase(), category]),
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
  options: TransactionAmountOptions = {},
): number {
  if (!transaction) return 0;
  const { allowParticipantFallback = true } = options;

  const total = safePositiveNumber(transaction.total);
  if (total > 0) {
    return total;
  }

  if (Array.isArray(transaction.effects) && transaction.effects.length > 0) {
    const amount = transaction.effects.reduce((sum, effect) => sum + effectAmount(effect), 0);
    if (amount > 0) {
      return roundToCents(amount);
    }
  }

  if (allowParticipantFallback) {
    if (Array.isArray(transaction.participants) && transaction.participants.length > 0) {
      const amount = transaction.participants.reduce(
        (sum, participant) => sum + safePositiveNumber(participant?.amount),
        0,
      );
      if (amount > 0) {
        return roundToCents(amount);
      }
    }
  }

  return 0;
}

export function totalSpendPerCategory(transactions: Transaction[] = []): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const transaction of transactions) {
    const amount = getTransactionAmount(transaction, { allowParticipantFallback: false });
    if (amount <= 0) continue;
    const category = normalizeCategory(transaction?.category ?? null);
    const current = totals[category] ?? 0;
    totals[category] = roundToCents(current + amount);
  }
  return totals;
}

export function monthlySpendPerCategory(
  transactions: Transaction[] = [],
): Record<string, Record<string, number>> {
  const totals: Record<string, Record<string, number>> = {};
  for (const transaction of transactions) {
    const amount = getTransactionAmount(transaction, { allowParticipantFallback: false });
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
  targets: Record<string, number> = {},
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

export { getTransactionAmount as __testOnlyGetTransactionAmount };
