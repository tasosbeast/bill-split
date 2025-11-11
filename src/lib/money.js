export function formatEUR(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function roundToCents(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  // Add epsilon in the direction away from zero to fix floating-point rounding
  const epsilon = num >= 0 ? Number.EPSILON : -Number.EPSILON;
  const rounded = Math.round(num * 100 + epsilon) / 100;
  // Normalize to exactly 2 decimal places to avoid -0 and representation artifacts
  return Number(rounded.toFixed(2));
}
