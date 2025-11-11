import { CATEGORIES } from "./categories";
import { roundToCents } from "./money";
import {
  buildSplitTransaction,
  upgradeTransactions,
} from "./transactions";
import type {
  TransactionParticipant,
  SettlementStatus,
  TransactionPaymentMetadata,
} from "../types/transaction";
import type {
  LegacyFriend,
  RestoreSnapshotResult,
  StoredTransaction,
  StoredSnapshotTemplate,
} from "../types/legacySnapshot";
import type { TransactionTemplateRecurrence } from "../types/transactionTemplate";

type TransactionBase = {
  id: string;
  category: string;
  note: string;
  createdAt: string;
  updatedAt: string | null;
};

type ParseHelpers = {
  stableId: (value: unknown) => string;
  friendIdSet: Set<string>;
};

type RawTransaction = Record<string, unknown>;

type ParsedTransaction = StoredTransaction;

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

function sanitizePaymentMetadata(value: unknown): TransactionPaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as TransactionPaymentMetadata;
}

function parseV2SplitTransaction(
  transaction: RawTransaction,
  base: TransactionBase,
  helpers: ParseHelpers
): ParsedTransaction {
  const { stableId, friendIdSet } = helpers;
  const sanitized: TransactionParticipant[] = [];
  const seen = new Set<string>();

  const maybeParticipants = (transaction as { participants?: unknown })
    .participants;
  const participants = Array.isArray(maybeParticipants)
    ? maybeParticipants
    : [];

  for (const part of participants) {
    if (!part || typeof part !== "object") continue;
    const rawId = (part as Record<string, unknown>).id;
    let pid =
      typeof rawId === "string" && rawId.trim().length > 0
        ? rawId.trim()
        : null;
    if (!pid) continue;
    if (pid !== "you") {
      pid = stableId(pid);
      if (!friendIdSet.has(pid)) {
        console.warn(
          "Skipping participant with unknown friend id during restore"
        );
        continue;
      }
    }
    if (seen.has(pid)) continue;
    const amountValue = (part as Record<string, unknown>).amount;
    const amount = roundToCents(
      typeof amountValue === "number" ? amountValue : Number(amountValue ?? 0)
    );
    sanitized.push({ id: pid === "you" ? "you" : pid, amount });
    seen.add(pid);
  }

  if (!sanitized.find((p) => p.id === "you")) {
    sanitized.unshift({ id: "you", amount: 0 });
  }

  const friendParts = sanitized.filter((p) => p.id !== "you");
  if (friendParts.length === 0) {
    throw new Error("Split is missing friend participants");
  }

  const rawTotal = (transaction as Record<string, unknown>).total;
  let total =
    typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal > 0
      ? roundToCents(rawTotal)
      : null;
  const friendsSum = roundToCents(
    friendParts.reduce((acc, p) => acc + p.amount, 0)
  );
  const youIndex = sanitized.findIndex((p) => p.id === "you");
  const yourShare = roundToCents(
    total !== null ? total - friendsSum : Math.max(-friendsSum, 0)
  );
  if (yourShare < 0) {
    throw new Error("Participant shares exceed total amount");
  }
  sanitized[youIndex].amount = yourShare;
  const computedTotal = roundToCents(friendsSum + yourShare);
  if (total === null) {
    total = computedTotal;
  }
  if (computedTotal !== total) {
    throw new Error("Participant shares do not match total");
  }

  const rawPayer = (transaction as Record<string, unknown>).payer;
  let payer = "you";
  if (typeof rawPayer === "string" && rawPayer.trim()) {
    if (rawPayer === "friend" && friendParts.length === 1) {
      payer = friendParts[0].id;
    } else if (rawPayer === "you") {
      payer = "you";
    } else {
      const mapped = stableId(rawPayer);
      if (friendParts.some((p) => p.id === mapped)) {
        payer = mapped;
      }
    }
  }
  if (friendParts.length > 1 && payer !== "you") {
    payer = "you";
  }

  const splitInput = {
    ...base,
    total,
    payer,
    participants: sanitized,
  } as unknown as Parameters<typeof buildSplitTransaction>[0];
  return buildSplitTransaction(splitInput) as ParsedTransaction;
}

function parseV1SplitTransaction(
  transaction: RawTransaction,
  base: TransactionBase,
  helpers: ParseHelpers
): ParsedTransaction {
  const { stableId, friendIdSet } = helpers;
  const friendIdValue = transaction.friendId;
  const friendId =
    typeof friendIdValue === "string" ? stableId(friendIdValue) : null;
  if (!friendId || !friendIdSet.has(friendId)) {
    throw new Error("Split references an unknown friend");
  }

  const rawTotal = transaction.total;
  const total =
    typeof rawTotal === "number" && Number.isFinite(rawTotal) && rawTotal > 0
      ? roundToCents(rawTotal)
      : 0;
  if (total <= 0) throw new Error("Split total must be positive");

  const rawHalf = transaction.half;
  const halfValue =
    typeof rawHalf === "number" && Number.isFinite(rawHalf) && rawHalf >= 0
      ? rawHalf
      : Number(rawHalf ?? NaN);
  const friendShare = Number.isFinite(halfValue)
    ? roundToCents(halfValue)
    : roundToCents(total / 2);
  const yourShare = roundToCents(Math.max(total - friendShare, 0));

  const rawPayer = transaction.payer;
  const payer =
    typeof rawPayer === "string" && rawPayer.trim() === "friend"
      ? friendId
      : "you";

  const splitInput = {
    ...base,
    total,
    payer,
    participants: [
      { id: "you", amount: yourShare },
      { id: friendId, amount: friendShare },
    ],
  } as unknown as Parameters<typeof buildSplitTransaction>[0];
  return buildSplitTransaction(splitInput) as ParsedTransaction;
}

function parseSettlementTransaction(
  transaction: RawTransaction,
  base: TransactionBase,
  helpers: ParseHelpers
): ParsedTransaction {
  const { stableId, friendIdSet } = helpers;
  const rawFriendId = transaction.friendId;
  const friendId =
    typeof rawFriendId === "string" ? stableId(rawFriendId) : null;
  if (!friendId || !friendIdSet.has(friendId)) {
    throw new Error("Settlement references an unknown friend");
  }

  const rawDelta = transaction.delta;
  const numericDelta =
    typeof rawDelta === "number" && Number.isFinite(rawDelta)
      ? rawDelta
      : Number(rawDelta ?? 0);
  const delta = Number.isFinite(numericDelta)
    ? roundToCents(numericDelta)
    : 0;

  const rawStatus = normalizeSettlementStatus(
    (transaction as { settlementStatus?: unknown }).settlementStatus
  );
  const settlementStatus: SettlementStatus =
    rawStatus ?? "confirmed";

  const rawInitiatedAt = (transaction as { settlementInitiatedAt?: unknown }).settlementInitiatedAt;
  const settlementInitiatedAt =
    typeof rawInitiatedAt === "string" && rawInitiatedAt
      ? rawInitiatedAt
      : base.createdAt;

  const rawConfirmedAt = (transaction as { settlementConfirmedAt?: unknown }).settlementConfirmedAt;
  const settlementConfirmedAt =
    typeof rawConfirmedAt === "string" && rawConfirmedAt
      ? rawConfirmedAt
      : settlementStatus === "confirmed"
      ? base.updatedAt ?? base.createdAt
      : null;

  const rawCancelledAt = (transaction as { settlementCancelledAt?: unknown }).settlementCancelledAt;
  const settlementCancelledAt =
    typeof rawCancelledAt === "string" && rawCancelledAt
      ? rawCancelledAt
      : settlementStatus === "cancelled"
      ? base.updatedAt ?? base.createdAt
      : null;

  const payment = sanitizePaymentMetadata(
    (transaction as { payment?: unknown }).payment
  );

  return {
    id: base.id,
    type: "settlement",
    friendId,
    total: null,
    payer: null,
    participants: [
      { id: "you", amount: delta < 0 ? Math.abs(delta) : 0 },
      { id: friendId, amount: delta > 0 ? delta : 0 },
    ],
    effects: [{ friendId, delta, share: Math.abs(delta) }],
    friendIds: [friendId],
    category: base.category,
    note: base.note,
    createdAt: base.createdAt,
    updatedAt: base.updatedAt,
    settlementStatus,
    settlementInitiatedAt,
    settlementConfirmedAt,
    settlementCancelledAt,
    payment: payment ?? null,
  };
}

function buildCategoryIndex(): Map<string, string> {
  return new Map(
    CATEGORIES.map((category) => {
      let label: string | null = null;
      if (typeof category === "string") {
        label = category;
      } else if (category && typeof category === "object") {
        const categoryRecord = category as Record<string, unknown>;
        const rawValue = categoryRecord.value;
        if (typeof rawValue === "string") {
          label = rawValue;
        } else {
          const rawName = categoryRecord.name;
          if (typeof rawName === "string") {
            label = rawName;
          }
        }
      }
      const safeLabel = (label ?? "Other").trim();
      return [safeLabel.toLowerCase(), safeLabel];
    })
  );
}

function sanitizeFriendRaw(
  friend: unknown,
  stableId: (value: unknown) => string,
  emailIndex: Map<string, LegacyFriend>
): LegacyFriend | null {
  if (!isRecord(friend)) return null;
  const friendRecord: Record<string, unknown> = friend;
  const id = stableId(friendRecord.id);

  const rawName = friendRecord.name;
  const name =
    typeof rawName === "string" && rawName.trim().length > 0
      ? rawName.trim()
      : "Friend";

  const rawEmail = friendRecord.email;
  const email =
    typeof rawEmail === "string" && rawEmail.trim().length > 0
      ? rawEmail.trim().toLowerCase()
      : null;

  const rawTag = friendRecord.tag;
  const tag =
    typeof rawTag === "string" && rawTag.trim().length > 0
      ? rawTag
      : "friend";

  if (email && emailIndex.has(email)) {
    const existing = emailIndex.get(email)!;
    console.warn("Merging duplicate friend by email during restore:", {
      kept: existing,
      dropped: { id, name, email, tag },
    });
    return null;
  }

  const entry: LegacyFriend = { 
    id, 
    name, 
    tag,
    active: true,
    createdAt: Date.now()
  };
  if (email) {
    entry.email = email;
    emailIndex.set(email, entry);
  }
  return entry;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeTemplateParticipantRaw(
  participant: unknown,
  helpers: ParseHelpers
): { id: string; amount: number } | null {
  if (!isRecord(participant)) return null;
  const rawId = participant.id;
  let id: string | null = null;
  if (rawId === "you") {
    id = "you";
  } else if (typeof rawId === "string" && rawId.trim().length > 0) {
    const normalized = helpers.stableId(rawId.trim());
    if (helpers.friendIdSet.has(normalized)) {
      id = normalized;
    }
  }
  if (!id) return null;
  const amountValue = Number(participant.amount);
  const amount = Number.isFinite(amountValue) && amountValue >= 0 ? amountValue : 0;
  return { id, amount: roundToCents(amount) };
}

function sanitizeTemplateRecurrenceRaw(
  value: unknown
): TransactionTemplateRecurrence | null {
  if (!isRecord(value)) return null;
  const frequency = value.frequency;
  if (frequency !== "monthly" && frequency !== "weekly" && frequency !== "yearly") {
    return null;
  }
  const rawDate = value.nextOccurrence;
  if (typeof rawDate !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(rawDate.trim())) {
    return null;
  }
  const trimmedDate = rawDate.trim();
  const reminderRaw = value.reminderDaysBefore;
  let reminderDaysBefore: number | null = null;
  if (reminderRaw !== undefined && reminderRaw !== null) {
    const parsed = Number(reminderRaw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      reminderDaysBefore = Math.floor(parsed);
    }
  }
  return {
    frequency,
    nextOccurrence: trimmedDate,
    reminderDaysBefore,
  };
}

function parseTemplates(
  raw: unknown,
  helpers: ParseHelpers
): StoredSnapshotTemplate[] {
  if (!Array.isArray(raw)) return [];
  const templates: StoredSnapshotTemplate[] = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const rawId = entry.id;
    const rawName = entry.name;
    const id = typeof rawId === "string" && rawId.trim().length > 0 ? rawId.trim() : null;
    const name =
      typeof rawName === "string" && rawName.trim().length > 0 ? rawName.trim() : null;
    if (!id || !name) continue;

    const participantsRaw = Array.isArray(entry.participants) ? entry.participants : [];
    const participants: StoredSnapshotTemplate["participants"] = [];
    const seen = new Set<string>();
    for (const part of participantsRaw) {
      const sanitized = sanitizeTemplateParticipantRaw(part, helpers);
      if (!sanitized || seen.has(sanitized.id)) continue;
      participants.push(sanitized);
      seen.add(sanitized.id);
    }
    if (!seen.has("you")) {
      participants.unshift({ id: "you", amount: 0 });
    }

    const record = entry;
    const recurrence = sanitizeTemplateRecurrenceRaw(record.recurrence);
    const template: StoredSnapshotTemplate = {
      ...record,
      id,
      name,
      total: roundToCents(Number(record.total) || 0),
      payer:
        typeof record.payer === "string" && record.payer.trim().length > 0
          ? record.payer.trim()
          : "you",
      category:
        typeof record.category === "string" && record.category.trim().length > 0
          ? record.category.trim()
          : "Other",
      note:
        typeof record.note === "string" && record.note.trim().length > 0
          ? record.note.trim()
          : null,
      participants,
      createdAt:
        typeof record.createdAt === "string" && record.createdAt.trim().length > 0
          ? record.createdAt.trim()
          : new Date().toISOString(),
      updatedAt:
        typeof record.updatedAt === "string" && record.updatedAt.trim().length > 0
          ? record.updatedAt.trim()
          : null,
      recurrence: recurrence ?? null,
    };

    templates.push(template);
  }
  return templates;
}

export function restoreSnapshot(data: unknown): RestoreSnapshotResult {
  if (!isRecord(data)) {
    throw new Error("Invalid JSON root");
  }
  if (!Array.isArray(data.friends)) throw new Error("Missing friends[]");
  if (!Array.isArray(data.transactions))
    throw new Error("Missing transactions[]");
  if (data.selectedId !== null && typeof data.selectedId !== "string") {
    throw new Error("selectedId must be null or string");
  }

  const idMap = new Map<unknown, string>();
  const stableId = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (idMap.has(value)) return idMap.get(value)!;
    const newId = crypto.randomUUID();
    idMap.set(value, newId);
    return newId;
  };

  const categoryIndex = buildCategoryIndex();
  const emailIndex = new Map<string, LegacyFriend>();
  const safeFriends: LegacyFriend[] = [];

  for (const friend of data.friends) {
    const sanitized = sanitizeFriendRaw(friend, stableId, emailIndex);
    if (sanitized) {
      safeFriends.push(sanitized);
    }
  }

  const friendIdSet = new Set(safeFriends.map((friend) => friend.id));
  const safeTransactions: ParsedTransaction[] = [];
  const skippedTransactions: RestoreSnapshotResult["skippedTransactions"] = [];

  for (const rawTx of data.transactions) {
    if (!isRecord(rawTx)) {
      skippedTransactions.push({
        transaction: rawTx,
        reason: "Transaction entry was not an object",
      });
      continue;
    }
    const debugContext: Record<string, unknown> = {};
    try {
      const normalizedType =
        rawTx.type === "settlement" ? "settlement" : "split";
      debugContext.type = normalizedType;
      debugContext.format =
        normalizedType === "split"
          ? Array.isArray(rawTx.participants)
            ? "v2"
            : "v1"
          : "settlement";

      const rawCategory =
        typeof rawTx.category === "string" ? rawTx.category.trim() : "";
      let category = "Other";
      if (rawCategory) {
        const normalizedCategory = rawCategory.toLowerCase();
        const canonicalCategory = categoryIndex.get(normalizedCategory);
        if (!canonicalCategory) {
          console.warn(
            "Unknown category during restore, defaulting to 'Other':",
            rawCategory
          );
        } else {
          category = canonicalCategory;
        }
      }

      const baseId = stableId(rawTx.id);
      debugContext.id = baseId;
      const createdAt =
        typeof rawTx.createdAt === "string"
          ? rawTx.createdAt
          : new Date().toISOString();
      const updatedAt =
        typeof rawTx.updatedAt === "string" ? rawTx.updatedAt : null;
      const rawNote = rawTx.note;
      const note = typeof rawNote === "string" ? rawNote : "";

      const base: TransactionBase = { id: baseId, category, note, createdAt, updatedAt };
      const helpers: ParseHelpers = { stableId, friendIdSet };

      let parsed: ParsedTransaction;
      if (normalizedType === "split") {
        parsed = Array.isArray(rawTx.participants)
          ? parseV2SplitTransaction(rawTx, base, helpers)
          : parseV1SplitTransaction(rawTx, base, helpers);
      } else {
        parsed = parseSettlementTransaction(rawTx, base, helpers);
      }

      safeTransactions.push(parsed);
    } catch (transactionError) {
      const reason =
        transactionError instanceof Error
          ? transactionError.message
          : String(transactionError);
      console.warn("Skipping transaction during restore:", {
        error: reason,
        context: debugContext,
      });
      skippedTransactions.push({
        transaction: rawTx,
        reason,
      });
    }
  }

  const upgradedTransactions = upgradeTransactions(
    safeTransactions
  ) as ParsedTransaction[];
  const normalizedSelectedId =
    typeof data.selectedId === "string"
      ? stableId(data.selectedId)
      : null;
  const templates = parseTemplates(data.templates, { stableId, friendIdSet });

  return {
    friends: safeFriends,
    transactions: upgradedTransactions,
    templates,
    selectedId: normalizedSelectedId,
    skippedTransactions,
  };
}
