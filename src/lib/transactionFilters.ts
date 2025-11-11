export const CATEGORY_FILTER_ALL = "All";

export type DateRange = {
  start?: string | null;
  end?: string | null;
};

export type TransactionFilters = {
  category?: string;
  dateRange?: DateRange;
};

type TransactionLike = {
  category?: string | null;
  createdAt?: string | null;
  [key: string]: unknown;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function inRange(dateValue: unknown, range: DateRange): boolean {
  if (!dateValue) return true;
  const normalized = parseDate(dateValue);
  if (!normalized) return true;

  if (range?.start) {
    const startValue =
      typeof range.start === "string" && range.start.includes("T")
        ? range.start
        : `${range.start}T00:00:00`;
    const start = parseDate(startValue);
    if (start && normalized < start) {
      return false;
    }
  }

  if (range?.end) {
    const endValue =
      typeof range.end === "string" && range.end.includes("T")
        ? range.end
        : `${range.end}T23:59:59.999`;
    const end = parseDate(endValue);
    if (end && normalized > end) {
      return false;
    }
  }

  return true;
}

/**
 * Filters a list of transactions by category and date range.
 */
export function filterTransactions(
  transactions: TransactionLike[],
  filters: TransactionFilters = {}
): TransactionLike[] {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return [];
  }

  const category = filters.category || CATEGORY_FILTER_ALL;
  const dateRange = filters.dateRange || { start: null, end: null };

  return transactions.filter((tx) => {
    if (!tx) return false;

    if (category !== CATEGORY_FILTER_ALL) {
      const txCategory = tx.category ?? "Other";
      if (txCategory !== category) {
        return false;
      }
    }

    if (!inRange(tx.createdAt, dateRange)) {
      return false;
    }

    return true;
  });
}
