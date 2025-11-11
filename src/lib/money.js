export function formatEUR(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function roundToCents(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  // Add a small epsilon before rounding to mitigate floating point issues,
  // then normalize to two decimal places to avoid -0 and representation artifacts.
  const rounded = Math.round((num + Number.EPSILON) * 100) / 100;
  return Number(rounded.toFixed(2));
}