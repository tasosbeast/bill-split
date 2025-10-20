import type {
  UISnapshot,
  LegacyFriend,
  StoredTransaction,
} from "../types/legacySnapshot";

const KEY = "bill-split@v1";

const EMPTY_SNAPSHOT: UISnapshot = {
  friends: [],
  selectedId: null,
  transactions: [],
};

function getNodeEnv(): string | undefined {
  if (typeof globalThis === "undefined") {
    return undefined;
  }
  const processValue =
    (globalThis as { process?: unknown }).process ?? undefined;
  if (
    typeof processValue !== "object" ||
    processValue === null ||
    !("env" in processValue)
  ) {
    return undefined;
  }
  const envValue = (processValue as { env?: unknown }).env;
  if (
    typeof envValue !== "object" ||
    envValue === null ||
    !("NODE_ENV" in envValue)
  ) {
    return undefined;
  }
  const nodeEnv = (envValue as { NODE_ENV?: unknown }).NODE_ENV;
  return typeof nodeEnv === "string" ? nodeEnv : undefined;
}

const isProdBuild = getNodeEnv() === "production";

const shouldLogWarnings = !isProdBuild;

function logStorageWarning(message: string): void {
  if (!shouldLogWarnings) return;
  console.warn(`[storage] ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeFriend(value: unknown): LegacyFriend | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id.trim()
      : null;
  if (!id) return null;
  const name =
    typeof value.name === "string" && value.name.trim().length > 0
      ? value.name.trim()
      : "Friend";
  const emailValue = value.email;
  const email =
    typeof emailValue === "string" && emailValue.trim().length > 0
      ? emailValue.trim().toLowerCase()
      : null;
  const friend: LegacyFriend = {
    id,
    name,
  };
  if (email) {
    friend.email = email;
  }
  if (typeof value.tag === "string" && value.tag.trim().length > 0) {
    friend.tag = value.tag;
  }
  return friend;
}

function sanitizeFriends(input: unknown): {
  friends: LegacyFriend[];
  changed: boolean;
} {
  if (input === undefined) {
    return { friends: [], changed: false };
  }
  if (!Array.isArray(input)) {
    return { friends: [], changed: true };
  }
  const friends: LegacyFriend[] = [];
  let changed = false;
  for (const entry of input) {
    const sanitized = sanitizeFriend(entry);
    if (!sanitized) {
      changed = true;
      continue;
    }
    friends.push(sanitized);
  }
  return { friends, changed };
}

function sanitizeTransactions(input: unknown): {
  transactions: StoredTransaction[];
  changed: boolean;
} {
  if (input === undefined) {
    return { transactions: [], changed: false };
  }
  if (!Array.isArray(input)) {
    return { transactions: [], changed: true };
  }
  const transactions: StoredTransaction[] = [];
  let changed = false;
  for (const entry of input) {
    if (!isRecord(entry)) {
      changed = true;
      continue;
    }
    const id =
      typeof entry.id === "string" && entry.id.trim().length > 0
        ? entry.id.trim()
        : null;
    if (!id) {
      changed = true;
      continue;
    }
    const entryRecord = entry as StoredTransaction;
    if (id !== entryRecord.id) {
      transactions.push({ ...entryRecord, id });
      changed = true;
    } else {
      transactions.push(entryRecord);
    }
  }
  return { transactions, changed };
}

function sanitizeSnapshot(
  raw: unknown
): { snapshot: UISnapshot | null; changed: boolean } {
  if (!isRecord(raw)) {
    return { snapshot: null, changed: raw !== null && raw !== undefined };
  }

  const { friends, changed: friendsChanged } = sanitizeFriends(raw.friends);
  const { transactions, changed: transactionsChanged } = sanitizeTransactions(
    raw.transactions
  );

  const friendIds = new Set(friends.map((friend) => friend.id));
  let selectedId: string | null = null;
  let selectedChanged = false;

  if (typeof raw.selectedId === "string") {
    if (friendIds.has(raw.selectedId.trim())) {
      selectedId = raw.selectedId.trim();
    } else {
      selectedChanged = true;
    }
  } else if (raw.selectedId !== undefined && raw.selectedId !== null) {
    selectedChanged = true;
  }

  return {
    snapshot: { friends, selectedId, transactions },
    changed: friendsChanged || transactionsChanged || selectedChanged,
  };
}

export function loadState(): UISnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const { snapshot, changed } = sanitizeSnapshot(parsed);
    if (!snapshot) {
      if (changed) {
        logStorageWarning(
          "Stored UI snapshot was invalid. Falling back to defaults."
        );
      }
      return null;
    }
    if (changed) {
      logStorageWarning(
        "Stored UI snapshot contained invalid data and was sanitized."
      );
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function saveState(snapshot: unknown): void {
  try {
    const { snapshot: sanitized } = sanitizeSnapshot(snapshot);
    const payload = sanitized ?? EMPTY_SNAPSHOT;
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    logStorageWarning("Could not save state to localStorage");
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    logStorageWarning("Could not clear state from localStorage");
  }
}

export type { UISnapshot, LegacyFriend, StoredTransaction };
