export function computeBalances(transactions) {
  const m = new Map();
  for (const t of transactions) {
    m.set(t.friendId, (m.get(t.friendId) || 0) + (t.delta || 0));
  }
  return m;
}
