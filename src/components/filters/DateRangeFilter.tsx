import { ChangeEvent } from "react";
import type { DateRange } from "./types";

export type DateRangeFilterProps = {
  value: DateRange;
  onChange: (value: DateRange) => void;
  idPrefix?: string;
  label?: string;
  disabled?: boolean;
};

export function DateRangeFilter({
  value,
  onChange,
  idPrefix = "date-range",
  label = "Date range",
  disabled = false,
}: DateRangeFilterProps) {
  function handleStartChange(event: ChangeEvent<HTMLInputElement>) {
    onChange({
      ...value,
      start: event.target.value ? event.target.value : null,
    });
  }

  function handleEndChange(event: ChangeEvent<HTMLInputElement>) {
    onChange({
      ...value,
      end: event.target.value ? event.target.value : null,
    });
  }

  return (
    <fieldset className="filter-field" disabled={disabled}>
      <legend className="filter-label">{label}</legend>
      <div className="row gap-8">
        <input
          id={`${idPrefix}-start`}
          className="input"
          type="date"
          value={value.start ?? ""}
          onChange={handleStartChange}
        />
        <span aria-hidden="true" className="filter-separator">
          –
        </span>
        <input
          id={`${idPrefix}-end`}
          className="input"
          type="date"
          value={value.end ?? ""}
          onChange={handleEndChange}
        />
      </div>
    </fieldset>
  );
}
