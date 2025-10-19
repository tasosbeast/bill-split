import { roundToCents } from "./money";

function generateId() {
  if (typeof crypto === "object" && crypto) {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    if (typeof crypto.getRandomValues === "function") {
      const buffer = new Uint32Array(4);
      crypto.getRandomValues(buffer);
      const randomPart = Array.from(buffer)
        .map((value) => value.toString(16).padStart(8, "0"))
        .join("-");
      return `${Date.now().toString(16)}-${randomPart}`;
    }
  }
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2);
  return `tx-${timestamp}-${random}`;
}

function isValidAmount(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function normalizeParticipants(rawParticipants = []) {
  const seen = new Set();
  const participants = [];
  for (const p of rawParticipants) {
    if (!p || typeof p.id !== "string") continue;
    const id = p.id.trim();
    if (!id || seen.has(id)) continue;
    const amount = Number(p.amount);
    const safeAmount = isValidAmount(amount) ? roundToCents(amount) : 0;
    participants.push({ id, amount: safeAmount });
    seen.add(id);
  }
  if (!participants.find((p) => p.id === "you")) {
    participants.unshift({ id: "you", amount: 0 });
  }
  return participants;
}

export function computeSplitEffects({ payer, participants }) {
  const normalizedParticipants = normalizeParticipants(participants);
  const you = normalizedParticipants.find((p) => p.id === "you") || {
    id: "you",
    amount: 0,
  };
  const youShare = you.amount || 0;
  const effects = [];

  for (const p of normalizedParticipants) {
    if (p.id === "you") continue;
    const entry = { friendId: p.id, share: p.amount || 0, delta: 0 };
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

export function buildSplitTransaction({
  id,
  total,
  payer = "you",
  participants = [],
  category = "Other",
  note = "",
  createdAt = new Date().toISOString(),
  updatedAt = null,
}) {
  const cleanTotal = roundToCents(total || 0);
  const { participants: normalizedParticipants, effects } = computeSplitEffects({
    payer,
    participants,
  });

  const friendIds = effects.map((e) => e.friendId).filter(Boolean);
  const friendId = friendIds.length === 1 ? friendIds[0] : null;

  return {
    id: id || generateId(),
    type: "split",
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
  };
}

export function getTransactionEffects(tx) {
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
        };
      })
      .filter(Boolean);
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

export function getTransactionFriendIds(tx) {
  if (!tx || typeof tx !== "object") return [];
  if (Array.isArray(tx.friendIds)) {
    return tx.friendIds.filter((id) => typeof id === "string" && id);
  }
  const effects = getTransactionEffects(tx);
  return effects.map((e) => e.friendId);
}

export function transactionIncludesFriend(tx, friendId) {
  if (!friendId) return false;
  return getTransactionFriendIds(tx).includes(friendId);
}

export function upgradeTransaction(tx) {
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
    const friendShare = isValidAmount(half) ? roundToCents(half) : roundToCents(total / 2);
    const youShare = roundToCents(Math.max(total - friendShare, 0));
    const rawPayer = typeof tx.payer === "string" ? tx.payer.trim() : "you";
    const normalizedPayer = rawPayer === "friend" && friendId ? friendId : rawPayer || "you";
    const participants = [
      { id: "you", amount: youShare },
      ...(friendId ? [{ id: friendId, amount: friendShare }] : []),
    ];
    const { effects } = computeSplitEffects({ payer: normalizedPayer, participants });
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

export function upgradeTransactions(list = []) {
  const upgraded = [];
  for (const tx of list) {
    const next = upgradeTransaction(tx);
    if (next) upgraded.push(next);
  }
  return upgraded;
}
