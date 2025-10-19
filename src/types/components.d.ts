import type { ReactNode } from "react";

type DateRangeValue = {
  start: string | null;
  end: string | null;
};

type TransactionFiltersState = {
  category?: string;
  dateRange?: DateRangeValue | null;
};

type TransactionFiltersApi = {
  filters: {
    category: string;
    dateRange: DateRangeValue;
  };
  setCategory: (category: string) => void;
  setDateRange: (range: DateRangeValue) => void;
  resetFilters: () => void;
  applyFilters: <T extends { category?: string | undefined; createdAt?: string | null | undefined; updatedAt?: string | null | undefined }>(
    transactions?: T[],
  ) => T[];
  hasActiveFilters: boolean;
};

declare module "../components/AnalyticsCard" {
  type AnalyticsCardAccent = "brand" | "danger" | "neutral";

  export type AnalyticsCardProps = {
    title: ReactNode;
    value?: ReactNode;
    description?: ReactNode;
    footer?: ReactNode;
    accent?: AnalyticsCardAccent;
    className?: string;
    children?: ReactNode;
  };

  export default function AnalyticsCard(props: AnalyticsCardProps): JSX.Element;
}

declare module "../components/AnalyticsTrendChart" {
  export type AnalyticsTrendPoint = {
    key?: string;
    label: string;
    amount: number;
  };

  export type AnalyticsTrendChartProps = {
    data?: AnalyticsTrendPoint[] | null;
  };

  export default function AnalyticsTrendChart(
    props: AnalyticsTrendChartProps,
  ): JSX.Element;
}

declare module "../components/AnalyticsCategoryList" {
  export type AnalyticsCategoryEntry = {
    category: string;
    amount: number;
  };

  export type AnalyticsCategoryListProps = {
    categories?: AnalyticsCategoryEntry[] | null;
  };

  export default function AnalyticsCategoryList(
    props: AnalyticsCategoryListProps,
  ): JSX.Element;
}

declare module "../components/filters/CategoryFilter" {
  export type CategoryFilterProps = {
    id?: string;
    label?: string;
    categories?: string[];
    value?: string;
    onChange?: (category: string) => void;
    includeAllOption?: boolean;
    disabled?: boolean;
  };

  export default function CategoryFilter(props: CategoryFilterProps): JSX.Element;
}

declare module "../components/filters/DateRangeFilter" {
  export type DateRangeFilterValue = DateRangeValue;

  export type DateRangeFilterProps = {
    value?: DateRangeFilterValue | null;
    onChange?: (range: DateRangeFilterValue) => void;
    idPrefix?: string;
    label?: string;
    disabled?: boolean;
  };

  export default function DateRangeFilter(props: DateRangeFilterProps): JSX.Element;
}

declare module "../components/filters/useTransactionFilters" {
  export function useTransactionFilters(
    initialState?: TransactionFiltersState,
  ): TransactionFiltersApi;
}

declare module "../components/filters" {
  export { default as CategoryFilter } from "../components/filters/CategoryFilter";
  export { default as DateRangeFilter } from "../components/filters/DateRangeFilter";
  export { useTransactionFilters } from "../components/filters/useTransactionFilters";
  export { CATEGORY_FILTER_ALL } from "../../lib/transactionFilters";
}

declare module "../../lib/transactionFilters" {
  export const CATEGORY_FILTER_ALL: string;
  export type DateRange = DateRangeValue;
}
