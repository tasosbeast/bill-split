export const DEFAULT_MONTHLY_BUDGET = 500;

export function selectFriends(state) {
  return Array.isArray(state?.friends) ? state.friends : [];
}

export function selectTransactions(state) {
  return Array.isArray(state?.transactions) ? state.transactions : [];
}

export function selectBalances(state) {
  return state?.balances instanceof Map ? state.balances : new Map();
}

export function selectMonthlyBudget(state) {
  const preferencesBudget = state?.preferences?.monthlyBudget;
  const directBudget = state?.monthlyBudget;
  const budget =
    Number.isFinite(preferencesBudget) && preferencesBudget > 0
      ? preferencesBudget
      : Number.isFinite(directBudget) && directBudget > 0
      ? directBudget
      : DEFAULT_MONTHLY_BUDGET;
  return budget;
}
