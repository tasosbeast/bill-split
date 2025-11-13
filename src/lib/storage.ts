import type {
  UISnapshot,
  StoredTransaction,
  StoredSnapshotTemplate,
  Friend,
} from "../types/legacySnapshot";
import type {
  SettlementStatus,
  TransactionPaymentMetadata,
} from "../types/transaction";
import {
  buildVersionedKey,
  readStorageItem,
  writeStorageItem,
  removeStorageItem,
} from "../services/storage";
import {
  isQuotaExceededError,
  getStorageErrorMessage,
} from "../services/storageMonitor";

const STORAGE_BASE_KEY = "bill-split";
const STORAGE_VERSION = 1;
const KEY = buildVersionedKey(STORAGE_BASE_KEY, STORAGE_VERSION);

const EMPTY_SNAPSHOT: UISnapshot = {
  friends: [],
  selectedId: null,
  transactions: [],
  templates: [],
  settlements: [],
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

function sanitizePayment(value: unknown): TransactionPaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as TransactionPaymentMetadata;
}

function arePaymentsEqual(
  current: unknown,
  next: TransactionPaymentMetadata | null
): boolean {
  if (!current && !next) return true;
  if (!current || !next) return false;
  if (current === next) return true;
  if (
    typeof current !== "object" ||
    current === null ||
    Array.isArray(current)
  ) {
    return false;
  }
  const currentRecord = current as Record<string, unknown>;
  const nextRecord = next as Record<string, unknown>;
  const currentKeys = Object.keys(currentRecord);
  const nextKeys = Object.keys(nextRecord);
  if (currentKeys.length !== nextKeys.length) {
    return false;
  }
  for (const key of currentKeys) {
    if (!Object.prototype.hasOwnProperty.call(nextRecord, key)) {
      return false;
    }
    if (!Object.is(currentRecord[key], nextRecord[key])) {
      return false;
    }
  }
  return true;
}
function sanitizeFriends(input: unknown): {
  friends: Friend[];
  changed: boolean;
} {
  if (input === undefined) {
    return { friends: [], changed: false };
  }
  if (!Array.isArray(input)) {
    return { friends: [], changed: true };
  }
  const friends: Friend[] = [];
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
    let normalized: StoredTransaction = entryRecord;
    let entryChanged = false;

    if (id !== entryRecord.id) {
      normalized = { ...normalized, id };
      entryChanged = true;
    }

    if (normalized.type === "settlement") {
      const nextStatus =
        normalizeSettlementStatus(
          (normalized as { settlementStatus?: unknown }).settlementStatus
        ) ?? "confirmed";
      if (normalized.settlementStatus !== nextStatus) {
        normalized = { ...normalized, settlementStatus: nextStatus };
        entryChanged = true;
      }

      const initiatedAt =
        typeof normalized.settlementInitiatedAt === "string" &&
        normalized.settlementInitiatedAt
          ? normalized.settlementInitiatedAt
          : typeof normalized.createdAt === "string"
          ? normalized.createdAt
          : null;
      if ((normalized.settlementInitiatedAt ?? null) !== initiatedAt) {
        normalized = { ...normalized, settlementInitiatedAt: initiatedAt };
        entryChanged = true;
      }

      const confirmedFallback =
        typeof normalized.updatedAt === "string" && normalized.updatedAt
          ? normalized.updatedAt
          : initiatedAt;
      const confirmedAt =
        typeof normalized.settlementConfirmedAt === "string" &&
        normalized.settlementConfirmedAt
          ? normalized.settlementConfirmedAt
          : nextStatus === "confirmed"
          ? confirmedFallback
          : null;
      if ((normalized.settlementConfirmedAt ?? null) !== confirmedAt) {
        normalized = { ...normalized, settlementConfirmedAt: confirmedAt };
        entryChanged = true;
      }

      const cancelledFallback =
        typeof normalized.updatedAt === "string" && normalized.updatedAt
          ? normalized.updatedAt
          : initiatedAt;
      const cancelledAt =
        typeof normalized.settlementCancelledAt === "string" &&
        normalized.settlementCancelledAt
          ? normalized.settlementCancelledAt
          : nextStatus === "cancelled"
          ? cancelledFallback
          : null;
      if ((normalized.settlementCancelledAt ?? null) !== cancelledAt) {
        normalized = { ...normalized, settlementCancelledAt: cancelledAt };
        entryChanged = true;
      }

      const payment = sanitizePayment(normalized.payment);
      if (!arePaymentsEqual(normalized.payment, payment)) {
        normalized = { ...normalized, payment };
        entryChanged = true;
      }
    }

    transactions.push(normalized);
    if (entryChanged) {
      changed = true;
    }
  }
  return { transactions, changed };
}

function sanitizeTemplateParticipant(
  value: unknown
): { id: string; amount: number } | null {
  if (!isRecord(value)) return null;
  const id =
    typeof value.id === "string" && value.id.trim().length > 0
      ? value.id.trim()
      : null;
  if (!id) return null;
  const amountValue = Number(value.amount);
  const amount =
    Number.isFinite(amountValue) && amountValue >= 0 ? amountValue : 0;
  return { id, amount };
}

function isAllowedRecurrenceFrequency(
  value: unknown
): value is NonNullable<StoredSnapshotTemplate["recurrence"]>["frequency"] {
  return value === "weekly" || value === "monthly" || value === "yearly";
}

function sanitizeTemplateRecurrence(
  value: unknown
): StoredSnapshotTemplate["recurrence"] | null {
  if (!isRecord(value)) return null;
  const frequency = value.frequency;
  if (!isAllowedRecurrenceFrequency(frequency)) {
    return null;
  }
  const nextOccurrence = value.nextOccurrence;
  if (typeof nextOccurrence !== "string" || !nextOccurrence.trim()) {
    return null;
  }
  const reminderValue = value.reminderDaysBefore;
  let reminderDaysBefore: number | null = null;
  if (reminderValue !== undefined) {
    const parsed = Number(reminderValue);
    if (Number.isFinite(parsed) && parsed >= 0) {
      reminderDaysBefore = Math.floor(parsed);
    }
  }
  return {
    frequency,
    nextOccurrence: nextOccurrence.trim(),
    reminderDaysBefore,
  };
}

function sanitizeTemplate(value: unknown): {
  template: StoredSnapshotTemplate | null;
  changed: boolean;
} {
  if (!isRecord(value)) return { template: null, changed: value !== undefined };
  const record = value;
  const id =
    typeof record.id === "string" && record.id.trim().length > 0
      ? record.id.trim()
      : null;
  const name =
    typeof record.name === "string" && record.name.trim().length > 0
      ? record.name.trim()
      : null;
  if (!id || !name) {
    return { template: null, changed: true };
  }
  const totalValue = Number(record.total);
  const total = Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : 0;
  const payer =
    typeof record.payer === "string" && record.payer.trim().length > 0
      ? record.payer.trim()
      : "you";
  const category =
    typeof record.category === "string" && record.category.trim().length > 0
      ? record.category.trim()
      : "Other";
  const note =
    typeof record.note === "string" && record.note.trim().length > 0
      ? record.note.trim()
      : null;
  const createdAt =
    typeof record.createdAt === "string" && record.createdAt.trim().length > 0
      ? record.createdAt.trim()
      : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === "string" && record.updatedAt.trim().length > 0
      ? record.updatedAt.trim()
      : null;

  const participantsSource = Array.isArray(record.participants)
    ? record.participants
    : [];
  const participants: StoredSnapshotTemplate["participants"] = [];
  let participantChanged = !Array.isArray(record.participants);
  const seen = new Set<string>();
  for (const entry of participantsSource) {
    const sanitized = sanitizeTemplateParticipant(entry);
    if (!sanitized) {
      participantChanged = true;
      continue;
    }
    if (seen.has(sanitized.id)) {
      participantChanged = true;
      continue;
    }
    participants.push(sanitized);
    seen.add(sanitized.id);
  }
  if (!participants.find((p) => p.id === "you")) {
    participants.unshift({ id: "you", amount: 0 });
    participantChanged = true;
  }

  const recurrence = sanitizeTemplateRecurrence(record.recurrence);
  const recurrenceChanged =
    record.recurrence !== undefined && record.recurrence !== recurrence;

  const template: StoredSnapshotTemplate = {
    ...record,
    id,
    name,
    total,
    payer,
    category,
    note,
    createdAt,
    updatedAt,
    participants,
    recurrence: recurrence ?? null,
  };

  return {
    template,
    changed: participantChanged || recurrenceChanged,
  };
}

function sanitizeTemplates(input: unknown): {
  templates: StoredSnapshotTemplate[];
  changed: boolean;
} {
  if (input === undefined) {
    return { templates: [], changed: false };
  }
  if (!Array.isArray(input)) {
    return { templates: [], changed: true };
  }
  const templates: StoredSnapshotTemplate[] = [];
  let changed = false;
  for (const entry of input) {
    const { template, changed: templateChanged } = sanitizeTemplate(entry);
    if (!template) {
      changed = true;
      continue;
    }
    templates.push(template);
    if (templateChanged) {
      changed = true;
    }
  }
  return { templates, changed };
}

function sanitizeSnapshot(raw: unknown): {
  snapshot: UISnapshot | null;
  changed: boolean;
} {
  if (!isRecord(raw)) {
    return { snapshot: null, changed: raw !== null && raw !== undefined };
  }

  const { friends, changed: friendsChanged } = sanitizeFriends(raw.friends);
  const { transactions, changed: transactionsChanged } = sanitizeTransactions(
    raw.transactions
  );
  const { transactions: settlements, changed: settlementsChanged } =
    sanitizeTransactions(raw.settlements);
  const { templates, changed: templatesChanged } = sanitizeTemplates(
    raw.templates
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
    snapshot: { friends, selectedId, transactions, templates, settlements },
    changed:
      friendsChanged ||
      transactionsChanged ||
      templatesChanged ||
      settlementsChanged ||
      selectedChanged,
  };
}

function unwrapSnapshotEnvelope(raw: unknown): {
  version: number;
  data: unknown;
} {
  if (isRecord(raw)) {
    const versionCandidate = (raw as { version?: unknown }).version;
    if (
      typeof versionCandidate === "number" &&
      Number.isFinite(versionCandidate) &&
      Object.prototype.hasOwnProperty.call(raw, "data")
    ) {
      return {
        version: versionCandidate,
        data: (raw as { data: unknown }).data,
      };
    }
  }
  return { version: 0, data: raw };
}

export function loadState(): UISnapshot | null {
  const readResult = readStorageItem(KEY);
  if (!readResult.ok) {
    if (readResult.error !== "unavailable") {
      logStorageWarning(
        `Unable to read UI snapshot (${readResult.error}). Falling back to defaults.`
      );
    }
    return null;
  }

  const raw = readResult.value;
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    logStorageWarning(
      "Stored UI snapshot could not be parsed and was ignored."
    );
    return null;
  }

  const { version, data } = unwrapSnapshotEnvelope(parsed);
  if (version !== 0 && version !== STORAGE_VERSION) {
    logStorageWarning(
      `Stored UI snapshot version ${version} differs from expected ${STORAGE_VERSION}. Attempting to load.`
    );
  }

  const { snapshot, changed } = sanitizeSnapshot(data);
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
}

export function saveState(snapshot: unknown): void {
  const { snapshot: sanitized } = sanitizeSnapshot(snapshot);
  const payload = sanitized ?? EMPTY_SNAPSHOT;
  const envelope = {
    version: STORAGE_VERSION,
    data: payload,
  };
  const writeResult = writeStorageItem(KEY, JSON.stringify(envelope));
  if (!writeResult.ok) {
    const errorMsg = writeResult.cause
      ? getStorageErrorMessage(writeResult.cause)
      : `Storage operation failed: ${writeResult.error}`;

    if (writeResult.error === "unavailable") {
      logStorageWarning("localStorage is not available; state was not saved");
    } else if (writeResult.cause && isQuotaExceededError(writeResult.cause)) {
      logStorageWarning(
        `Storage quota exceeded. ${errorMsg} Consider exporting and removing old data.`
      );
    } else {
      logStorageWarning(
        `Could not save state to localStorage (${writeResult.error}).`
      );
    }
  }
}

export function clearState(): void {
  const removeResult = removeStorageItem(KEY);
  if (!removeResult.ok && removeResult.error !== "unavailable") {
    logStorageWarning("Could not clear state from localStorage");
  }
}

export type { UISnapshot, Friend, StoredTransaction };
function sanitizeFriend(value: unknown): Friend | null {
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
      : undefined;
  const avatarUrl =
    typeof value.avatarUrl === "string" && value.avatarUrl.trim().length > 0
      ? value.avatarUrl.trim()
      : undefined;
  const active = typeof value.active === "boolean" ? value.active : true;
  const createdAtCandidate = value.createdAt;
  let createdAt = Date.now();
  if (
    typeof createdAtCandidate === "number" &&
    Number.isFinite(createdAtCandidate)
  ) {
    createdAt = createdAtCandidate;
  } else if (typeof createdAtCandidate === "string") {
    const parsed = Date.parse(createdAtCandidate);
    if (!Number.isNaN(parsed)) {
      createdAt = parsed;
    }
  }
  const tag =
    typeof value.tag === "string" && value.tag.trim().length > 0
      ? value.tag.trim()
      : undefined;

  return {
    id,
    name,
    email,
    avatarUrl,
    active,
    createdAt,
    tag,
  };
}
