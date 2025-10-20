import { CATEGORIES } from "./categories";
import { roundToCents } from "./money";
import { buildSplitTransaction, upgradeTransactions } from "./transactions";

function parseV2SplitTransaction(transaction, base, helpers) {
  const { stableId, friendIdSet } = helpers;
  const sanitized = [];
  const seen = new Set();

  for (const part of transaction.participants) {
    if (!part || typeof part !== "object") continue;
    let pid = part.id;
    if (typeof pid === "string") pid = pid.trim();
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
    const amount = roundToCents(part.amount ?? 0);
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

  const rawTotal = Number(transaction.total);
  let total =
    Number.isFinite(rawTotal) && rawTotal > 0 ? roundToCents(rawTotal) : null;
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

  const rawPayer =
    typeof transaction.payer === "string" ? transaction.payer.trim() : "you";
  let payer = "you";
  if (rawPayer === "you" || !rawPayer) {
    payer = "you";
  } else if (rawPayer === "friend" && friendParts.length === 1) {
    payer = friendParts[0].id;
  } else {
    const mapped = stableId(rawPayer);
    if (friendParts.some((p) => p.id === mapped)) {
      payer = mapped;
    }
  }
  if (friendParts.length > 1 && payer !== "you") {
    payer = "you";
  }

  return buildSplitTransaction({
    ...base,
    total,
    payer,
    participants: sanitized,
  });
}

function parseV1SplitTransaction(transaction, base, helpers) {
  const { stableId, friendIdSet } = helpers;
  const friendId =
    typeof transaction.friendId === "string"
      ? stableId(transaction.friendId)
      : null;
  if (!friendId || !friendIdSet.has(friendId)) {
    throw new Error("Split references an unknown friend");
  }

  const rawTotal = Number(transaction.total);
  const total =
    Number.isFinite(rawTotal) && rawTotal > 0 ? roundToCents(rawTotal) : 0;
  if (total <= 0) throw new Error("Split total must be positive");

  const rawHalf = Number(transaction.half);
  const friendShare =
    Number.isFinite(rawHalf) && rawHalf >= 0
      ? roundToCents(rawHalf)
      : roundToCents(total / 2);
  const yourShare = roundToCents(Math.max(total - friendShare, 0));

  const rawPayer =
    typeof transaction.payer === "string" ? transaction.payer.trim() : "you";
  const payer = rawPayer === "friend" ? friendId : "you";

  return buildSplitTransaction({
    ...base,
    total,
    payer,
    participants: [
      { id: "you", amount: yourShare },
      { id: friendId, amount: friendShare },
    ],
  });
}

function parseSettlementTransaction(transaction, base, helpers) {
  const { stableId, friendIdSet } = helpers;
  const friendId =
    typeof transaction.friendId === "string"
      ? stableId(transaction.friendId)
      : null;
  if (!friendId || !friendIdSet.has(friendId)) {
    throw new Error("Settlement references an unknown friend");
  }

  const rawDelta = Number(transaction.delta);
  const delta = Number.isFinite(rawDelta) ? roundToCents(rawDelta) : 0;

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
  };
}

function buildCategoryIndex() {
  return new Map(
    CATEGORIES.map((c) => {
      const label = typeof c === "string" ? c : c.value ?? c.name ?? String(c);
      return [label.trim().toLowerCase(), label];
    })
  );
}

export function restoreSnapshot(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON root");
  }
  if (!Array.isArray(data.friends)) throw new Error("Missing friends[]");
  if (!Array.isArray(data.transactions))
    throw new Error("Missing transactions[]");
  if (data.selectedId !== null && typeof data.selectedId !== "string") {
    throw new Error("selectedId must be null or string");
  }

  const idMap = new Map();
  function stableId(id) {
    if (typeof id === "string") return id;
    if (idMap.has(id)) return idMap.get(id);
    const newId = crypto.randomUUID();
    idMap.set(id, newId);
    return newId;
  }

  const categoryIndex = buildCategoryIndex();
  const emailIndex = new Map();
  const safeFriends = [];

  for (const friend of data.friends) {
    const id = stableId(friend?.id);
    const name = String(friend?.name ?? "").trim() || "Friend";
    const email = String(friend?.email ?? "")
      .trim()
      .toLowerCase();
    const tag = friend?.tag ?? "friend";

    if (email && emailIndex.has(email)) {
      const existing = emailIndex.get(email);
      console.warn("Merging duplicate friend by email during restore:", {
        kept: existing,
        dropped: { id, name, email, tag },
      });
      continue;
    }

    const entry = { id, name, email, tag };
    safeFriends.push(entry);
    if (email) emailIndex.set(email, entry);
  }

  const friendIdSet = new Set(safeFriends.map((friend) => friend.id));
  const safeTransactions = [];
  const skippedTransactions = [];

  for (const rawTx of data.transactions.filter(Boolean)) {
    const debugContext = {};
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
      const createdAt = rawTx.createdAt ?? new Date().toISOString();
      const updatedAt = rawTx.updatedAt ?? null;
      const note = String(rawTx.note ?? "");

      const base = { id: baseId, category, note, createdAt, updatedAt };
      const helpers = { stableId, friendIdSet };

      let parsed;
      if (normalizedType === "split") {
        parsed = Array.isArray(rawTx.participants)
          ? parseV2SplitTransaction(rawTx, base, helpers)
          : parseV1SplitTransaction(rawTx, base, helpers);
      } else {
        parsed = parseSettlementTransaction(rawTx, base, helpers);
      }

      safeTransactions.push(parsed);
    } catch (transactionError) {
      console.warn("Skipping transaction during restore:", {
        error:
          transactionError instanceof Error
            ? transactionError.message
            : String(transactionError),
        context: debugContext,
      });
      skippedTransactions.push({
        transaction: rawTx,
        reason:
          transactionError instanceof Error
            ? transactionError.message
            : String(transactionError),
      });
    }
  }

  const upgradedTransactions = upgradeTransactions(safeTransactions);
  const normalizedSelectedId = data.selectedId
    ? stableId(data.selectedId)
    : null;

  return {
    friends: safeFriends,
    transactions: upgradedTransactions,
    selectedId: normalizedSelectedId,
    skippedTransactions,
  };
}
