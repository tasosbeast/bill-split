import { getTransactionEffects, type TransactionLike } from "./transactions";

/**
 * Compute net balances per friend from a list of transactions.
 * Positive means the friend owes you; negative means you owe the friend.
 */
export function computeBalances(
  transactions: TransactionLike[]
): Map<string, number> {
  const m = new Map<string, number>();
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
