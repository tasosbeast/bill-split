export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear?: () => void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isStorageLike(value: unknown): value is StorageLike {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.getItem === "function" &&
    typeof value.setItem === "function" &&
    typeof value.removeItem === "function"
  );
}

let overrideStorage: StorageLike | undefined;

export function setStorageImplementation(storage: StorageLike | null): void {
  overrideStorage = storage ?? undefined;
}

export function getStorage(): StorageLike | null {
  if (overrideStorage !== undefined) {
    return overrideStorage;
  }
  if (typeof globalThis === "undefined") {
    return null;
  }
  const candidate = (globalThis as Record<string, unknown>).localStorage;
  return isStorageLike(candidate) ? (candidate as StorageLike) : null;
}

export const STORAGE_NAMESPACE = "bill-split";
export const STORAGE_VERSION = 1;

export function buildVersionedKey(baseKey: string, version: number = STORAGE_VERSION): string {
  return `${baseKey}@v${version}`;
}

export type StorageErrorCode = "unavailable" | "read_failed" | "write_failed" | "remove_failed";

export interface StorageOperationError {
  ok: false;
  error: StorageErrorCode;
  cause?: unknown;
}

export interface StorageReadSuccess {
  ok: true;
  value: string | null;
}

export interface StorageWriteSuccess {
  ok: true;
}

export type StorageReadResult = StorageReadSuccess | StorageOperationError;
export type StorageWriteResult = StorageWriteSuccess | StorageOperationError;

export function readStorageItem(key: string, storage: StorageLike | null = getStorage()): StorageReadResult {
  if (!storage) {
    return { ok: false, error: "unavailable" };
  }
  try {
    return { ok: true, value: storage.getItem(key) };
  } catch (cause) {
    return { ok: false, error: "read_failed", cause };
  }
}

export function writeStorageItem(
  key: string,
  value: string,
  storage: StorageLike | null = getStorage()
): StorageWriteResult {
  if (!storage) {
    return { ok: false, error: "unavailable" };
  }
  try {
    storage.setItem(key, value);
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: "write_failed", cause };
  }
}

export function removeStorageItem(key: string, storage: StorageLike | null = getStorage()): StorageWriteResult {
  if (!storage) {
    return { ok: false, error: "unavailable" };
  }
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: "remove_failed", cause };
  }
}
