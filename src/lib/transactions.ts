/* TypeScript migration of src/lib/transactions.js
   - preserves original behavior and ordering semantics
   - adds explicit types for safer usage across the codebase
*/

import { roundToCents } from "./money";

/**
 * Types
 */
export type Participant = {
  id: string;
  amount: number;
};

export type Effect = {
  friendId: string;
  share: number;
  delta: number;
};

export type SplitEffectsResult = {
  participants: Participant[];
  effects: Effect[];
};

export type BuildSplitTransactionInput = {
  id?: string | null;
  total?: number | null;
  payer?: string | null;
  participants?: Array<Partial<Participant> | Record<string, unknown>>;
  category?: string | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  templateId?: string | null;
  templateName?: string | null;
};

export type TransactionLike = {
  id?: string;
  type?: string;
  total?: number | null;
  payer?: string | null;
  friendId?: string | null;
  friendIds?: string[] | null;
  half?: number;
  delta?: number;
    effects?: Effect[] | null;
    participants?: Participant[] | null;
    category?: string | null;
    note?: string | null;
    createdAt?: string | null;
  updatedAt?: string | null;
  templateId?: string | null;
  templateName?: string | null;
};

/**
 * Helpers
 */
function generateId(): string {
  try {
    // Prefer global crypto.randomUUID when available, then getRandomValues.
    // Use safe guards for environments without crypto.
    const globalWithCrypto =
      typeof globalThis !== "undefined"
        ? (globalThis as { crypto?: Crypto })
        : undefined;
    const globalCrypto = globalWithCrypto?.crypto;
    if (globalCrypto) {
      const cryptoWithRandomUUID = globalCrypto as Crypto & {
        randomUUID?: () => string;
      };
      if (typeof cryptoWithRandomUUID.randomUUID === "function") {
        return cryptoWithRandomUUID.randomUUID();
      }
      if (typeof globalCrypto.getRandomValues === "function") {
        const buffer = new Uint32Array(4);
        globalCrypto.getRandomValues(buffer);
        const randomPart = Array.from(buffer)
          .map((value) => value.toString(16).padStart(8, "0"))
          .join("-");
        return `${Date.now().toString(16)}-${randomPart}`;
      }
    }
  } catch {
    // fall through to Math.random fallback
  }

  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2);
  return `tx-${timestamp}-${random}`;
}

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Normalize raw participants array into Participant[]
 * - trims ids
 * - deduplicates
 * - coerces amounts and rounds to cents
 * - ensures a 'you' participant exists (at the front)
 */
export function normalizeParticipants(
  rawParticipants: Array<Record<string, unknown>> = []
): Participant[] {
  const seen = new Set<string>();
  const participants: Participant[] = [];
  for (const p of rawParticipants) {
    if (!p || typeof p !== "object") continue;
    const idRaw = p.id;
    if (typeof idRaw !== "string") continue;
    const id = idRaw.trim();
    if (!id || seen.has(id)) continue;
    const amount = Number(p.amount);
    const safeAmount = isValidAmount(amount) ? roundToCents(amount) : 0;
    participants.push({ id, amount: safeAmount });
    seen.add(id);
  }
  if (!participants.find((p) => p.id === "you")) {
    // keep 'you' at the front to match existing UI expectations
    participants.unshift({ id: "you", amount: 0 });
  }
  return participants;
}

/**
 * Compute split effects (who owes how much) given a payer and participants
 */
export function computeSplitEffects({
  payer,
  participants,
}: {
  payer: string;
  participants: Array<Participant | Record<string, unknown>>;
}): SplitEffectsResult {
  const normalizedParticipants = normalizeParticipants(
    participants as Array<Record<string, unknown>>
  );
  const you = normalizedParticipants.find((p) => p.id === "you") ?? {
    id: "you",
    amount: 0,
  };
  const youShare = you.amount || 0;
  const effects: Effect[] = [];

  for (const p of normalizedParticipants) {
    if (p.id === "you") continue;
    const entry: Effect = { friendId: p.id, share: p.amount || 0, delta: 0 };
    if (payer === "you") {
      entry.delta = entry.share;
    } else if (payer === p.id) {
      entry.delta = -youShare;
    } else {
      entry.delta = 0;
    }
    effects.push(entry);
  }

  return { participants: normalizedParticipants, effects };
}

/**
 * Build a split transaction object. Keeps shape similar to the legacy JS version.
 */
export function buildSplitTransaction({
  id,
  total,
  payer = "you",
  participants = [],
  category = "Other",
  note = "",
  createdAt = new Date().toISOString(),
  updatedAt = null,
  templateId = null,
  templateName = null,
}: BuildSplitTransactionInput = {}) {
  const cleanTotal = roundToCents(total || 0);
  const { participants: normalizedParticipants, effects } = computeSplitEffects(
    {
      payer: payer ?? "you",
      participants,
    }
  );

  const friendIds = effects.map((e) => e.friendId).filter(Boolean);
  const friendId = friendIds.length === 1 ? friendIds[0] : null;

  return {
    id: id || generateId(),
    type: "split" as const,
    total: cleanTotal,
    payer,
    participants: normalizedParticipants,
    effects,
    friendId,
    friendIds,
    category,
    note,
    createdAt,
    updatedAt,
    templateId,
    templateName,
  };
}

/**
 * Read effects from a transaction-like object
 */
export function getTransactionEffects(tx: TransactionLike): Effect[] {
  if (!tx || typeof tx !== "object") return [];
  if (Array.isArray(tx.effects)) {
    return tx.effects
      .map((e) => {
        if (!e || typeof e.friendId !== "string") return null;
        const delta = Number(e.delta);
        const share = Number(e.share);
        return {
          friendId: e.friendId,
          delta: Number.isFinite(delta) ? delta : 0,
          share: Number.isFinite(share) ? share : 0,
        } as Effect;
      })
      .filter((e): e is Effect => e !== null);
  }

  if (tx.type === "settlement") {
    if (typeof tx.friendId !== "string") return [];
    const delta = Number(tx.delta) || 0;
    return [
      {
        friendId: tx.friendId,
        delta,
        share: Math.abs(delta),
      },
    ];
  }

  if (tx.type === "split" && typeof tx.friendId === "string") {
    const share = Number(tx.half);
    const normalizedShare = isValidAmount(share) ? share : null;
    const delta = Number(tx.delta) || 0;
    return [
      {
        friendId: tx.friendId,
        delta,
        share: normalizedShare ?? Math.abs(delta),
      },
    ];
  }

  return [];
}

/**
 * Return friend ids involved in a transaction (either friendIds array or derived from effects)
 */
export function getTransactionFriendIds(tx: TransactionLike): string[] {
  if (!tx || typeof tx !== "object") return [];
  if (Array.isArray(tx.friendIds)) {
    return tx.friendIds.filter(
      (id): id is string => typeof id === "string" && Boolean(id)
    );
  }
  const effects = getTransactionEffects(tx);
  return effects.map((e) => e.friendId);
}

export function transactionIncludesFriend(
  tx: TransactionLike,
  friendId?: string | null
): boolean {
  if (!friendId) return false;
  return getTransactionFriendIds(tx).includes(friendId);
}

/**
 * Upgrade a legacy transaction object to the normalized shape.
 * Returns null if transaction is invalid/unusable in some legacy cases.
 */
export function upgradeTransaction(
  tx: TransactionLike
): TransactionLike | null {
  if (!tx || typeof tx !== "object") return null;
  if (Array.isArray(tx.effects) && Array.isArray(tx.participants)) {
    const friendIds = getTransactionFriendIds(tx);
    const friendId =
      typeof tx.friendId === "string"
        ? tx.friendId
        : friendIds.length === 1
        ? friendIds[0]
        : null;
    return { ...tx, friendId: friendId ?? null, friendIds };
  }

  if (tx.type === "split") {
    const total = Number(tx.total);
    if (!Number.isFinite(total) || total <= 0) return null;
    const friendId = typeof tx.friendId === "string" ? tx.friendId : null;
    const half = Number(tx.half);
    const friendShare = isValidAmount(half)
      ? roundToCents(half)
      : roundToCents(total / 2);
    const youShare = roundToCents(Math.max(total - friendShare, 0));
    const rawPayer = typeof tx.payer === "string" ? tx.payer.trim() : "you";
    const normalizedPayer =
      rawPayer === "friend" && friendId ? friendId : rawPayer || "you";

    const participants: Participant[] = [
      { id: "you", amount: youShare },
      ...(friendId ? [{ id: friendId, amount: friendShare }] : []),
    ];

    const { effects } = computeSplitEffects({
      payer: normalizedPayer,
      participants,
    });
    const friendIds = friendId ? [friendId] : effects.map((e) => e.friendId);
    return {
      ...tx,
      total,
      participants,
      effects,
      payer: normalizedPayer,
      friendIds,
    };
  }

  if (tx.type === "settlement" && typeof tx.friendId === "string") {
    const delta = Number(tx.delta) || 0;
    return {
      ...tx,
      effects: [
        {
          friendId: tx.friendId,
          delta,
          share: Math.abs(delta),
        },
      ],
      friendIds: [tx.friendId],
    };
  }

  return { ...tx };
}

/**
 * Bulk upgrade
 */
export function upgradeTransactions(
  list: TransactionLike[] = []
): TransactionLike[] {
  const upgraded: TransactionLike[] = [];
  for (const tx of list) {
    const next = upgradeTransaction(tx);
    if (next) upgraded.push(next);
  }
  return upgraded;
}
