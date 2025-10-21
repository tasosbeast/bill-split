import { roundToCents } from "../lib/money";
import type {
  SettlementStatus,
  TransactionPaymentMetadata,
} from "../types/transaction";

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?(): void;
}

export interface PersistedParticipant {
  id?: unknown;
  amount?: unknown;
}

export interface PersistedTransaction {
  [key: string]: unknown;
  id?: unknown;
  type?: unknown;
  category?: unknown;
  total?: unknown;
  participants?: PersistedParticipant[];
  settlementStatus?: unknown;
  settlementInitiatedAt?: unknown;
  settlementConfirmedAt?: unknown;
  settlementCancelledAt?: unknown;
  payment?: unknown;
}

export interface PersistedTransactionsState {
  transactions: PersistedTransaction[];
  budgets: Record<string, number>;
}

const STORAGE_KEY = "bill-split:transactions";

let customStorage: StorageAdapter | null = null;
let fallbackStorage: StorageAdapter | null = null;

const SETTLEMENT_STATUSES = new Set<SettlementStatus>([
  "initiated",
  "pending",
  "confirmed",
  "cancelled",
]);

function normalizeSettlementStatus(value: unknown): SettlementStatus | null {
  if (typeof value !== "string") return null;
  const lowered = value.trim().toLowerCase();
  if (lowered === "canceled") {
    return "cancelled";
  }
  if (SETTLEMENT_STATUSES.has(lowered as SettlementStatus)) {
    return lowered as SettlementStatus;
  }
  return null;
}

function sanitizePaymentMetadata(
  value: unknown
): TransactionPaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as TransactionPaymentMetadata;
}

function isStorageAdapter(value: unknown): value is StorageAdapter {
  if (!value || typeof value !== "object") return false;
  const maybe = value as Record<string, unknown>;
  return (
    typeof maybe.getItem === "function" &&
    typeof maybe.setItem === "function" &&
    typeof maybe.removeItem === "function"
  );
}

function resolveNativeStorage(): StorageAdapter | null {
  if (typeof globalThis === "undefined") return null;
  const maybe = (globalThis as Record<string, unknown>).localStorage;
  if (isStorageAdapter(maybe)) {
    return maybe;
  }
  return null;
}

function ensureStorage(): StorageAdapter {
  if (customStorage) return customStorage;
  const native = resolveNativeStorage();
  if (native) return native;
  if (!fallbackStorage) {
    fallbackStorage = createMemoryStorage();
  }
  return fallbackStorage;
}

function sanitizeBudgets(input: unknown): Record<string, number> {
  if (!input || typeof input !== "object") return {};
  const result: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(input as Record<string, unknown>)) {
    if (typeof rawKey !== "string") continue;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) continue;
    result[rawKey] = roundToCents(value);
  }
  return result;
}

function sanitizeTransaction(input: unknown): PersistedTransaction | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as PersistedTransaction;
  const safe: PersistedTransaction = { ...raw };

  if (Array.isArray(raw.participants)) {
    safe.participants = raw.participants
      .map((participant) => {
        if (!participant || typeof participant !== "object") return null;
        const pid =
          typeof participant.id === "string" ? participant.id : undefined;
        if (!pid) return null;
        const amount = Number(participant.amount);
        const normalized = Number.isFinite(amount) ? roundToCents(amount) : 0;
        return { id: pid, amount: normalized } satisfies PersistedParticipant;
      })
      .filter(
        (value): value is PersistedParticipant => value !== null
      );
  }

  if (safe.type === "settlement") {
    const nextStatus =
      normalizeSettlementStatus(safe.settlementStatus) ?? "confirmed";
    safe.settlementStatus = nextStatus;

    const createdAtString =
      typeof safe.createdAt === "string" && safe.createdAt
        ? safe.createdAt
        : null;
    const initiatedAt =
      typeof safe.settlementInitiatedAt === "string" && safe.settlementInitiatedAt
        ? safe.settlementInitiatedAt
        : createdAtString;
    safe.settlementInitiatedAt = initiatedAt;

    const updatedAtString =
      typeof safe.updatedAt === "string" && safe.updatedAt ? safe.updatedAt : null;
    const confirmedFallback = updatedAtString ?? initiatedAt;
    const confirmedAt =
      typeof safe.settlementConfirmedAt === "string" && safe.settlementConfirmedAt
        ? safe.settlementConfirmedAt
        : nextStatus === "confirmed"
        ? confirmedFallback
        : null;
    safe.settlementConfirmedAt = confirmedAt;

    const cancelledFallback = updatedAtString ?? initiatedAt;
    const cancelledAt =
      typeof safe.settlementCancelledAt === "string" && safe.settlementCancelledAt
        ? safe.settlementCancelledAt
        : nextStatus === "cancelled"
        ? cancelledFallback
        : null;
    safe.settlementCancelledAt = cancelledAt;

    safe.payment = sanitizePaymentMetadata(safe.payment);
  } else if (safe.payment !== undefined) {
    safe.payment = sanitizePaymentMetadata(safe.payment);
  }

  return safe;
}

export function createMemoryStorage(
  initialEntries: Record<string, string> = {}
): StorageAdapter {
  const map = new Map<string, string>(Object.entries(initialEntries));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

export function setTransactionsPersistenceStorage(
  storage: StorageAdapter | null
): void {
  customStorage = storage;
}

export function loadTransactionsState(): PersistedTransactionsState | null {
  const storage = ensureStorage();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const transactions = Array.isArray(parsed.transactions)
      ? (parsed.transactions
          .map((entry) => sanitizeTransaction(entry))
          .filter(Boolean) as PersistedTransaction[])
      : [];
    const budgets = sanitizeBudgets(parsed.budgets);
    return { transactions, budgets };
  } catch (error) {
    console.warn("Failed to load transactions state", error);
    return null;
  }
}

export function persistTransactionsState(
  state: PersistedTransactionsState
): void {
  const storage = ensureStorage();
  const safeTransactions = Array.isArray(state.transactions)
    ? (state.transactions
        .map((entry) => sanitizeTransaction(entry))
        .filter(Boolean) as PersistedTransaction[])
    : [];
  const payload = JSON.stringify({
    transactions: safeTransactions,
    budgets: sanitizeBudgets(state.budgets),
  });
  storage.setItem(STORAGE_KEY, payload);
}

export function clearTransactionsStatePersistence(): void {
  const storage = ensureStorage();
  storage.removeItem(STORAGE_KEY);
}

export const TRANSACTIONS_STATE_STORAGE_KEY = STORAGE_KEY;
