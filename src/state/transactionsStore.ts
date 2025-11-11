import { CATEGORIES } from "../lib/categories.js";
import { roundToCents } from "../lib/money";
import {
  clearTransactionsStatePersistence,
  loadTransactionsState,
  persistTransactionsState,
  createMemoryStorage,
  setTransactionsPersistenceStorage,
  type PersistedTransaction,
  type PersistedTransactionsState,
} from "./persistence";

export interface TransactionParticipant {
  id: string;
  amount: number;
}

export interface TransactionRecord {
  id: string;
  type: string;
  category: string;
  participants: TransactionParticipant[];
  total: number | null;
  [key: string]: unknown;
}

export interface TransactionsState {
  transactions: TransactionRecord[];
  budgets: Record<string, number>;
}

export interface BudgetAggregate {
  category: string;
  budget: number | null;
  spent: number;
  remaining: number | null;
  isOverBudget: boolean;
  utilization: number | null;
}

export interface BudgetTotals {
  totalBudgeted: number;
  totalSpentAgainstBudget: number;
  totalRemaining: number;
  totalOverBudget: number;
}

export type TransactionsListener = (state: TransactionsState) => void;

const DEFAULT_CATEGORY = "Uncategorized";
const KNOWN_CATEGORIES = new Map(
  [DEFAULT_CATEGORY, ...CATEGORIES].map((category) => [
    category.toLowerCase(),
    category,
  ])
);

function createDefaultState(): TransactionsState {
  return { transactions: [], budgets: {} };
}

function normalizeCategoryName(category?: string | null): string {
  if (typeof category !== "string") return DEFAULT_CATEGORY;
  const trimmed = category.trim();
  if (trimmed.length === 0) return DEFAULT_CATEGORY;
  const lookupKey = trimmed.toLowerCase();
  if (KNOWN_CATEGORIES.has(lookupKey)) {
    return KNOWN_CATEGORIES.get(lookupKey)!;
  }
  return trimmed;
}

function sanitizeParticipant(
  participant: unknown
): TransactionParticipant | null {
  if (!participant || typeof participant !== "object") return null;
  const raw = participant as Record<string, unknown>;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : null;
  if (!id) return null;
  const amount = Number(raw.amount);
  const normalized = Number.isFinite(amount) ? roundToCents(amount) : 0;
  return { id, amount: normalized };
}

function sanitizeTransaction(input: unknown): TransactionRecord | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as PersistedTransaction | TransactionRecord;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : null;
  if (!id) return null;
  const type = typeof raw.type === "string" ? raw.type : "split";
  const category = normalizeCategoryName(
    typeof raw.category === "string" ? raw.category : DEFAULT_CATEGORY
  );
  const participantsSource = Array.isArray(raw.participants)
    ? raw.participants
    : [];
  const participants = participantsSource
    .map((participant) => sanitizeParticipant(participant))
    .filter(Boolean) as TransactionParticipant[];
  if (!participants.some((p) => p.id === "you")) {
    participants.push({ id: "you", amount: 0 });
  }
  const totalValue = Number((raw as Record<string, unknown>).total);
  const total = Number.isFinite(totalValue) ? roundToCents(totalValue) : null;

  const sanitized: TransactionRecord = {
    ...(raw as Record<string, unknown>),
    id,
    type,
    category,
    participants,
    total,
  };

  return sanitized;
}

function sanitizeTransactions(
  transactions: readonly unknown[]
): TransactionRecord[] {
  return transactions
    .map((entry) => sanitizeTransaction(entry))
    .filter(Boolean) as TransactionRecord[];
}

<<<<<<< HEAD
function sanitizeBudgets(
  input: Record<string, number> | undefined
): Record<string, number> {
=======
function sanitizeBudgets(input: Record<string, unknown> | undefined): Record<string, number> {
>>>>>>> 4cc034352a1b8d51aa411e0c5200c5f996da2328
  if (!input) return {};
  const result: Record<string, number> = {};
  for (const [rawCategory, rawValue] of Object.entries(input)) {
    const category = normalizeCategoryName(rawCategory);
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) continue;
    result[category] = roundToCents(value);
  }
  return result;
}

function buildStateFromPersisted(
  persisted: PersistedTransactionsState | null
): TransactionsState {
  if (!persisted) return createDefaultState();
  return {
    transactions: sanitizeTransactions(persisted.transactions ?? []),
    budgets: sanitizeBudgets(persisted.budgets),
  };
}

let state: TransactionsState = buildStateFromPersisted(loadTransactionsState());
const listeners = new Set<TransactionsListener>();

function emit(): void {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch (err) {
      // Guard against subscriber errors so one bad listener doesn't break the store
      // (log and continue)
      console.warn("Transactions listener error", err);
    }
  }
}

function serializeState(
  current: TransactionsState
): PersistedTransactionsState {
  return {
    transactions: current.transactions.map((transaction) => ({
      ...transaction,
      participants: transaction.participants.map((participant) => ({
        id: participant.id,
        amount: roundToCents(participant.amount),
      })),
    })),
    budgets: { ...current.budgets },
  };
}

/**
 * Apply a new state to the store. This function will attempt to persist the
 * sanitized state to the configured persistence. If persistence fails it will:
 *  - log the failure,
 *  - install an in-memory fallback storage and retry persistence,
 *  - if fallback also fails, keep the in-memory state and log an error.
 */
function applyState(next: TransactionsState): void {
  const sanitizedState: TransactionsState = {
    transactions: sanitizeTransactions(next.transactions),
    budgets: sanitizeBudgets(next.budgets),
  };

  // Update in-memory state immediately so callers of getTransactionsState() see it.
  state = sanitizedState;

  // Attempt to persist; if it fails try a memory fallback.
  try {
    persistTransactionsState(serializeState(state));
  } catch (error) {
    console.warn(
      "Failed to persist transactions state to primary storage",
      error
    );

    try {
      const fallback = createMemoryStorage();
      setTransactionsPersistenceStorage(fallback);
      persistTransactionsState(serializeState(state));
      console.info(
        "Persisted transactions state to in-memory fallback storage"
      );
    } catch (fallbackError) {
      console.error(
        "Failed to persist transactions state to fallback storage; state will remain in memory only",
        fallbackError
      );
    }
  } finally {
    // Notify subscribers after persistence attempts (successful or failed).
    emit();
  }
}

function withState(
  producer: (previous: TransactionsState) => TransactionsState
): void {
  const draft: TransactionsState = {
    transactions: [...state.transactions],
    budgets: { ...state.budgets },
  };
  const result = producer(draft);
  applyState(result);
}

function getShareForYou(transaction: TransactionRecord): number {
  const you = transaction.participants.find((p) => p.id === "you");
  return you ? roundToCents(you.amount) : 0;
}

function computeCategorySpending(
  transactions: readonly TransactionRecord[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const transaction of transactions) {
    const category = normalizeCategoryName(transaction.category);
    const amount = getShareForYou(transaction);
    if (!map.has(category)) {
      map.set(category, amount);
    } else {
      map.set(category, roundToCents(map.get(category)! + amount));
    }
  }
  return map;
}

export function getTransactionsState(): TransactionsState {
  return state;
}

export function subscribeToTransactionsStore(
  listener: TransactionsListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTransactions(transactions: readonly unknown[]): void {
  withState((previous) => ({
    ...previous,
    transactions: sanitizeTransactions(transactions),
  }));
}

export function setCategoryBudget(
  category: string,
  amount: number | null | undefined
): void {
  const normalized = normalizeCategoryName(category);
  withState((previous) => {
    const budgets = { ...previous.budgets };
    if (amount === null || amount === undefined) {
      delete budgets[normalized];
      return { ...previous, budgets };
    }
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0) {
      delete budgets[normalized];
      return { ...previous, budgets };
    }
    budgets[normalized] = roundToCents(numeric);
    return { ...previous, budgets };
  });
}

export function selectBudgets(): Record<string, number> {
  return { ...state.budgets };
}

export function selectBudgetForCategory(category: string): number | null {
  const normalized = normalizeCategoryName(category);
  const value = state.budgets[normalized];
  return typeof value === "number" ? value : null;
}

export function clearAllBudgets(): void {
  withState((previous) => ({
    ...previous,
    budgets: {},
  }));
}

function getTransactionTimestamp(
  transaction: TransactionRecord
): string | null {
  const record = transaction as Record<string, unknown>;
  const createdAt = record.createdAt;
  const updatedAt = record.updatedAt;

  const normalize = (value: unknown): string | null => {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return new Date(value).toISOString();
    }
    return null;
  };

  return normalize(createdAt) ?? normalize(updatedAt);
}

function getMonthKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthKeyForTransaction(
  transaction: TransactionRecord
): string | null {
  const timestamp = getTransactionTimestamp(transaction);
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return getMonthKeyFromDate(date);
}

function computeCategorySpendingByMonth(
  transactions: readonly TransactionRecord[]
): Map<string, Map<string, number>> {
  const monthly = new Map<string, Map<string, number>>();
  for (const transaction of transactions) {
    const monthKey = getMonthKeyForTransaction(transaction);
    if (!monthKey) continue;
    const category = normalizeCategoryName(transaction.category);
    const amount = getShareForYou(transaction);
    if (amount <= 0) continue;
    if (!monthly.has(monthKey)) {
      monthly.set(monthKey, new Map());
    }
    const monthMap = monthly.get(monthKey)!;
    const current = monthMap.get(category) ?? 0;
    monthMap.set(category, roundToCents(current + amount));
  }
  return monthly;
}

export function selectCategorySpendForMonth(
  monthKey: string
): Record<string, number> {
  if (typeof monthKey !== "string" || monthKey.trim().length === 0) {
    return {};
  }
  const monthly = computeCategorySpendingByMonth(state.transactions);
  const map = monthly.get(monthKey);
  if (!map) {
    return {};
  }
  const result: Record<string, number> = {};
  for (const [category, amount] of map.entries()) {
    result[category] = amount;
  }
  return result;
}

function getPreviousMonthKey(reference: Date): string {
  const year = reference.getUTCFullYear();
  const month = reference.getUTCMonth();
  const prevMonthDate = new Date(Date.UTC(year, month - 1, 1));
  return getMonthKeyFromDate(prevMonthDate);
}

export function selectPreviousMonthCategorySpend(
  referenceDate: Date = new Date()
): Record<string, number> {
  const safeDate =
    referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime())
      ? referenceDate
      : new Date();
  const monthKey = getPreviousMonthKey(safeDate);
  return selectCategorySpendForMonth(monthKey);
}

export function selectBudgetAggregates(): BudgetAggregate[] {
  const categories = new Set<string>();
  for (const transaction of state.transactions) {
    categories.add(normalizeCategoryName(transaction.category));
  }
  for (const category of Object.keys(state.budgets)) {
    categories.add(normalizeCategoryName(category));
  }
  const spending = computeCategorySpending(state.transactions);
  return Array.from(categories)
    .sort((a, b) => a.localeCompare(b))
    .map((category) => {
      const spent = spending.get(category) ?? 0;
      const budget = state.budgets[category] ?? null;
      const remaining = budget === null ? null : roundToCents(budget - spent);
      const isOverBudget = budget !== null && spent > budget;
      const utilization =
        budget !== null && budget > 0
          ? Math.round((spent / budget) * 1000) / 1000
          : null;
      return {
        category,
        budget,
        spent,
        remaining,
        isOverBudget,
        utilization,
      } satisfies BudgetAggregate;
    });
}

export function selectBudgetTotals(): BudgetTotals {
  const aggregates = selectBudgetAggregates();
  const budgeted = aggregates.filter((entry) => entry.budget !== null);
  const totalBudgeted = roundToCents(
    budgeted.reduce((sum, entry) => sum + (entry.budget ?? 0), 0)
  );
  const totalSpentAgainstBudget = roundToCents(
    budgeted.reduce((sum, entry) => sum + entry.spent, 0)
  );
  const totalRemaining = roundToCents(totalBudgeted - totalSpentAgainstBudget);
  const totalOverBudget = roundToCents(
    budgeted.reduce(
      (sum, entry) => sum + Math.max(entry.spent - (entry.budget ?? 0), 0),
      0
    )
  );
  return {
    totalBudgeted,
    totalSpentAgainstBudget,
    totalRemaining,
    totalOverBudget,
  };
}

export interface ResetStoreOptions {
  hard?: boolean;
}

export function resetTransactionsStore(options?: ResetStoreOptions): void {
  if (options?.hard) {
    state = createDefaultState();
    clearTransactionsStatePersistence();
  } else {
    state = buildStateFromPersisted(loadTransactionsState());
  }
  try {
    persistTransactionsState(serializeState(state));
  } catch {
    // If persist fails during reset, install fallback memory storage and try again,
    // but always emit to let UI reflect the reset result (persist may be best-effort).
    try {
      const fallback = createMemoryStorage();
      setTransactionsPersistenceStorage(fallback);
      persistTransactionsState(serializeState(state));
      console.info("Persisted reset state to in-memory fallback storage");
    } catch (fallbackError) {
      console.error(
        "Failed to persist reset state to fallback storage",
        fallbackError
      );
    }
  } finally {
    emit();
  }
}
