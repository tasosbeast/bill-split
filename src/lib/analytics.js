import { getTransactionEffects } from "./transactions";

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function resolveTransactionTotal(tx) {
  if (!tx) return 0;
  if (typeof tx.total === "number") {
    return Math.abs(tx.total);
  }

  const effects = getTransactionEffects(tx);
  if (!effects || effects.length === 0) return 0;
  let aggregate = 0;
  for (const effect of effects) {
    aggregate += Math.abs(asNumber(effect.delta));
  }
  return aggregate;
}

export function computeAnalyticsOverview(transactions) {
  const safe = Array.isArray(transactions) ? transactions : [];
  let totalVolume = 0;
  let owedToYou = 0;
  let youOwe = 0;

  for (const tx of safe) {
    if (!tx) continue;
    totalVolume += resolveTransactionTotal(tx);
    const effects = getTransactionEffects(tx);
    for (const effect of effects) {
      const delta = asNumber(effect.delta);
      if (delta > 0) {
        owedToYou += delta;
      } else if (delta < 0) {
        youOwe += Math.abs(delta);
      }
    }
  }

  const count = safe.filter(Boolean).length;
  const netBalance = owedToYou - youOwe;
  const average = count > 0 ? totalVolume / count : 0;

  return {
    count,
    totalVolume,
    owedToYou,
    youOwe,
    netBalance,
    average,
  };
}

export function computeCategoryBreakdown(transactions) {
  const safe = Array.isArray(transactions) ? transactions : [];
  const map = new Map();

  for (const tx of safe) {
    if (!tx) continue;
    const key = tx.category ?? "Other";
    const next = map.get(key) || { count: 0, total: 0 };
    next.count += 1;
    next.total += resolveTransactionTotal(tx);
    map.set(key, next);
  }

  const totalVolume = Array.from(map.values()).reduce(
    (sum, entry) => sum + entry.total,
    0,
  );

  return Array.from(map.entries())
    .map(([category, info]) => ({
      category,
      count: info.count,
      total: info.total,
      percentage:
        totalVolume > 0 ? Math.round((info.total / totalVolume) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

