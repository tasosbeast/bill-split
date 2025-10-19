import { getTransactionEffects } from "./transactions";

export function computeBalances(transactions) {
  const m = new Map();
  for (const t of transactions) {
    const effects = getTransactionEffects(t);
    for (const effect of effects) {
      const key = effect.friendId;
      if (!key) continue;
      const current = m.get(key) || 0;
      m.set(key, current + (effect.delta || 0));
    }
  }
  return m;
}
