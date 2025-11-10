import { useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "../../hooks/useDebouncedCallback";

const EMPTY_RANGE = Object.freeze({ start: null, end: null });

export function DateRangeFilter({
  value = EMPTY_RANGE,
  onChange = () => {},
  idPrefix = "date-range",
  label = "Date range",
  disabled = false,
  debounceMs = 250,
}) {
  const state = value ?? EMPTY_RANGE;
  const [draftStart, setDraftStart] = useState(state.start ?? "");
  const [draftEnd, setDraftEnd] = useState(state.end ?? "");

  useEffect(() => {
    setDraftStart(state.start ?? "");
    setDraftEnd(state.end ?? "");
  }, [state.start, state.end]);

  const emitChange = useDebouncedCallback(
    (nextStart, nextEnd) => {
      onChange({
        start: nextStart || null,
        end: nextEnd || null,
      });
    },
    debounceMs
  );

  const handleStartChange = (event) => {
    const next = event.target.value ?? "";
    setDraftStart(next);
    emitChange(next, draftEnd);
  };

  const handleEndChange = (event) => {
    const next = event.target.value ?? "";
    setDraftEnd(next);
    emitChange(draftStart, next);
  };

  const describedBy = useMemo(() => {
    const ids = [];
    if (draftStart && !draftEnd) {
      ids.push(`${idPrefix}-start-label`);
    } else if (draftEnd && !draftStart) {
      ids.push(`${idPrefix}-end-label`);
    }
    return ids.join(" ") || undefined;
  }, [draftStart, draftEnd, idPrefix]);

  return (
    <fieldset className="filter-field" disabled={disabled}>
      <legend className="filter-label" id={`${idPrefix}-legend`}>
        {label}
      </legend>
      <div className="row gap-8">
        <label className="sr-only" id={`${idPrefix}-start-label`} htmlFor={`${idPrefix}-start`}>
          {`${label} start`}
        </label>
        <input
          id={`${idPrefix}-start`}
          className="input"
          type="date"
          value={draftStart}
          onChange={handleStartChange}
          aria-describedby={describedBy}
        />
        <span aria-hidden="true" className="filter-separator">
          –
        </span>
        <label className="sr-only" id={`${idPrefix}-end-label`} htmlFor={`${idPrefix}-end`}>
          {`${label} end`}
        </label>
        <input
          id={`${idPrefix}-end`}
          className="input"
          type="date"
          value={draftEnd}
          onChange={handleEndChange}
          aria-describedby={describedBy}
        />
      </div>
    </fieldset>
  );
}

export default DateRangeFilter;





