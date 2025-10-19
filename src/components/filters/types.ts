export type DateRange = {
  start: string | null;
  end: string | null;
};

export type TransactionFilters = {
  category: string;
  dateRange: DateRange;
};
