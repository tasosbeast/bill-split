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

