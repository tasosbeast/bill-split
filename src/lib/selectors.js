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
  const preferencesBudget = Number(state?.preferences?.monthlyBudget);
  if (Number.isFinite(preferencesBudget) && preferencesBudget > 0) {
    return preferencesBudget;
  }

  const directBudget = Number(state?.monthlyBudget);
  if (Number.isFinite(directBudget) && directBudget > 0) {
    return directBudget;
  }

  return DEFAULT_MONTHLY_BUDGET;
}
