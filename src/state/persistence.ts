import { getStorage, type StorageLike } from "../services/storage";
import type { SettlementStatus } from "../types/transaction";
import { parsePersistedEnvelope } from "./schemas";
import type {
  PersistedTransaction as SchemaPersistedTransaction,
  PersistedParticipant as SchemaPersistedParticipant,
} from "./schemas";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StorageAdapter extends StorageLike {}

// Re-export types from schemas for backward compatibility
export type PersistedParticipant = SchemaPersistedParticipant;
export type PersistedTransaction = SchemaPersistedTransaction;

export interface PersistedTransactionsState {
  transactions: PersistedTransaction[];
  budgets: Record<string, number>;
}

const STORAGE_KEY = "bill-split:transactions";

let customStorage: StorageAdapter | null = null;
let fallbackStorage: StorageAdapter | null = null;

function resolveNativeStorage(): StorageAdapter | null {
  return getStorage();
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

/**
 * Apply settlement-specific timestamp normalization.
 * This function handles the settlement transaction timestamps that need
 * to be filled in based on status and other timestamps.
 */
function normalizeSettlementTimestamps(
  transaction: PersistedTransaction
): PersistedTransaction {
  if (transaction.type !== "settlement") {
    return transaction;
  }

  const safe = { ...transaction };
  
  // Determine the status, defaulting to "confirmed" for settlements
  const status = (safe.settlementStatus as SettlementStatus | undefined) ?? "confirmed";
  safe.settlementStatus = status;

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
      : status === "confirmed"
      ? confirmedFallback
      : null;
  safe.settlementConfirmedAt = confirmedAt;

  const cancelledFallback = updatedAtString ?? initiatedAt;
  const cancelledAt =
    typeof safe.settlementCancelledAt === "string" && safe.settlementCancelledAt
      ? safe.settlementCancelledAt
      : status === "cancelled"
      ? cancelledFallback
      : null;
  safe.settlementCancelledAt = cancelledAt;

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
    const parsed: unknown = JSON.parse(raw);
    
    // Use Zod-based parsing
    const envelope = parsePersistedEnvelope(parsed);
    if (!envelope) {
      console.warn("Failed to parse transactions state with Zod schemas");
      return null;
    }
    
    // Apply settlement-specific timestamp normalization
    const normalizedTransactions = envelope.payload.transactions.map(
      normalizeSettlementTimestamps
    );
    
    return {
      transactions: normalizedTransactions,
      budgets: envelope.payload.budgets,
    };
  } catch (error) {
    console.warn("Failed to load transactions state", error);
    return null;
  }
}

export function persistTransactionsState(
  state: PersistedTransactionsState
): void {
  const storage = ensureStorage();
  
  // Use Zod-based parsing to validate and sanitize before persisting
  const envelope = parsePersistedEnvelope({
    transactions: state.transactions,
    budgets: state.budgets,
  });
  
  if (!envelope) {
    console.warn("Failed to sanitize transactions state for persistence");
    // Use the state as-is if parsing fails (defensive)
    const payload = JSON.stringify({
      transactions: state.transactions,
      budgets: state.budgets,
    });
    try {
      storage.setItem(STORAGE_KEY, payload);
    } catch (error) {
      console.warn("Failed to persist transactions state to storage", error);
      throw error;
    }
    return;
  }
  
  // Apply settlement-specific timestamp normalization
  const normalizedTransactions = envelope.payload.transactions.map(
    normalizeSettlementTimestamps
  );
  
  const payload = JSON.stringify({
    transactions: normalizedTransactions,
    budgets: envelope.payload.budgets,
  });

  // Wrap setItem in try/catch so callers don't get an uncaught exception.
  // Re-throw after logging so callers can implement fallback strategies if desired.
  try {
    storage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    // Log the error with context and rethrow so the caller can decide what to do.
    // Typical errors are QuotaExceededError on browsers or storage implementation failures.
    console.warn("Failed to persist transactions state to storage", error);
    throw error;
  }
}

export function clearTransactionsStatePersistence(): void {
  const storage = ensureStorage();
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Failed to clear transactions state persistence", error);
  }
}

export const TRANSACTIONS_STATE_STORAGE_KEY = STORAGE_KEY;