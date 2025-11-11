/**
 * Formats a value as EUR currency using a stable locale for tests and UI.
 */
export function formatEUR(value: unknown): string {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Rounds a number to two decimal places (cents) with stable behavior,
 * avoiding -0 and floating point artifacts. Accepts strings and numbers.
 */
export function roundToCents(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  // Add epsilon in the direction away from zero to fix floating-point rounding
  const epsilon = num >= 0 ? Number.EPSILON : -Number.EPSILON;
  const rounded = Math.round(num * 100 + epsilon) / 100;
  // Normalize to exactly 2 decimal places to avoid -0 and representation artifacts
  return Number(rounded.toFixed(2));
}
