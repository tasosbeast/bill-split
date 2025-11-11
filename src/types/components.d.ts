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
  applyFilters: <
    T extends {
      category?: string | undefined;
      createdAt?: string | null | undefined;
      updatedAt?: string | null | undefined;
    }
  >(
    transactions?: T[]
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
    props: AnalyticsTrendChartProps
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
    props: AnalyticsCategoryListProps
  ): JSX.Element;
}
