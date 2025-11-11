export const DEFAULT_MONTHLY_BUDGET = 500;

type LooseState =
  | {
      friends?: unknown;
      transactions?: unknown;
      balances?: unknown;
      preferences?: { monthlyBudget?: unknown } | null;
      monthlyBudget?: unknown;
    }
  | null
  | undefined;

export function selectFriends(state: LooseState) {
  const friends = state && "friends" in state ? state.friends : undefined;
  return Array.isArray(friends) ? (friends as unknown[]) : [];
}

export function selectTransactions(state: LooseState) {
  const transactions =
    state && "transactions" in state ? state.transactions : undefined;
  return Array.isArray(transactions) ? (transactions as unknown[]) : [];
}

export function selectBalances(state: LooseState) {
  const balances = state && "balances" in state ? state.balances : undefined;
  return balances instanceof Map
    ? (balances as Map<unknown, unknown>)
    : new Map();
}

export function selectMonthlyBudget(state: LooseState) {
  const preferences =
    state && "preferences" in state ? state.preferences : null;
  const preferencesBudget = Number(
    preferences && typeof preferences === "object" && preferences
      ? (preferences as { monthlyBudget?: unknown }).monthlyBudget
      : undefined
  );
  if (Number.isFinite(preferencesBudget) && preferencesBudget > 0) {
    return preferencesBudget;
  }

  const directBudget = Number(
    state && "monthlyBudget" in state ? state.monthlyBudget : undefined
  );
  if (Number.isFinite(directBudget) && directBudget > 0) {
    return directBudget;
  }

  return DEFAULT_MONTHLY_BUDGET;
}
