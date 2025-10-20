const KEY = "bill-split@v1";

const isProdBuild = (() => {
  if (
    typeof import.meta !== "undefined" &&
    import.meta.env &&
    Object.prototype.hasOwnProperty.call(import.meta.env, "PROD")
  ) {
    return Boolean(import.meta.env.PROD);
  }
  if (typeof globalThis !== "undefined" && globalThis.process?.env?.NODE_ENV) {
    return globalThis.process.env.NODE_ENV === "production";
  }
  return false;
})();

const shouldLogWarnings = !isProdBuild;

function logStorageWarning(message) {
  if (!shouldLogWarnings) {
    return;
  }
  console.warn(`[storage] ${message}`);
}

function createEmptySnapshot() {
  return { friends: [], selectedId: null, transactions: [] };
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeFriends(value) {
  if (value === undefined) {
    return { friends: [], changed: false };
  }
  if (!Array.isArray(value)) {
    return { friends: [], changed: true };
  }

  const friends = [];
  let changed = false;

  for (const friend of value) {
    if (!isRecord(friend)) {
      changed = true;
      continue;
    }
    if (typeof friend.id !== "string") {
      changed = true;
      continue;
    }
    const trimmedId = friend.id.trim();
    if (!trimmedId) {
      changed = true;
      continue;
    }
    if (trimmedId !== friend.id) {
      friends.push({ ...friend, id: trimmedId });
      changed = true;
      continue;
    }
    friends.push(friend);
  }

  return { friends, changed };
}

function sanitizeTransactions(value) {
  if (value === undefined) {
    return { transactions: [], changed: false };
  }
  if (!Array.isArray(value)) {
    return { transactions: [], changed: true };
  }

  const transactions = [];
  let changed = false;

  for (const tx of value) {
    if (!isRecord(tx)) {
      changed = true;
      continue;
    }
    if (typeof tx.id !== "string") {
      changed = true;
      continue;
    }
    const trimmedId = tx.id.trim();
    if (!trimmedId) {
      changed = true;
      continue;
    }
    if (trimmedId !== tx.id) {
      transactions.push({ ...tx, id: trimmedId });
      changed = true;
      continue;
    }
    transactions.push(tx);
  }

  return { transactions, changed };
}

function sanitizeSnapshot(raw) {
  if (!isRecord(raw)) {
    return { snapshot: null, changed: raw !== null && raw !== undefined };
  }

  const { friends, changed: friendsChanged } = sanitizeFriends(raw.friends);
  const { transactions, changed: transactionsChanged } = sanitizeTransactions(
    raw.transactions
  );

  const friendIds = new Set(friends.map((f) => f.id));
  let selectedId = null;
  let selectedChanged = false;
  if (typeof raw.selectedId === "string") {
    if (friendIds.has(raw.selectedId)) {
      selectedId = raw.selectedId;
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

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const { snapshot, changed } = sanitizeSnapshot(parsed);
    if (!snapshot) {
      if (changed) {
        logStorageWarning("Stored UI snapshot was invalid. Falling back to defaults.");
      }
      return null;
    }
    if (changed) {
      logStorageWarning("Stored UI snapshot contained invalid data and was sanitized.");
    }
    return snapshot;
  } catch {
    return null;
  }
}

export function saveState(snapshot) {
  try {
    const { snapshot: sanitized } = sanitizeSnapshot(snapshot);
    const payload = sanitized ?? createEmptySnapshot();
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    logStorageWarning("Could not save state to localStorage");
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    logStorageWarning("Could not clear state from localStorage");
  }
}
