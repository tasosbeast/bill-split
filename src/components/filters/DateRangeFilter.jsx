const EMPTY_RANGE = Object.freeze({ start: null, end: null });

export function DateRangeFilter({
  value = EMPTY_RANGE,
  onChange = () => {},
  idPrefix = "date-range",
  label = "Date range",
  disabled = false,
}) {
  const state = value ?? EMPTY_RANGE;

  const handleStartChange = (event) => {
    onChange({
      ...state,
      start: event.target.value ? event.target.value : null,
    });
  };

  const handleEndChange = (event) => {
    onChange({
      ...state,
      end: event.target.value ? event.target.value : null,
    });
  };

  return (
    <fieldset className="filter-field" disabled={disabled}>
      <legend className="filter-label">{label}</legend>
      <div className="row gap-8">
        <label className="sr-only" htmlFor={`${idPrefix}-start`}>
          {`${label} start`}
        </label>
        <input
          id={`${idPrefix}-start`}
          className="input"
          type="date"
          value={state.start ?? ""}
          onChange={handleStartChange}
        />
        <span aria-hidden="true" className="filter-separator">
          –
        </span>
        <label className="sr-only" htmlFor={`${idPrefix}-end`}>
          {`${label} end`}
        </label>
        <input
          id={`${idPrefix}-end`}
          className="input"
          type="date"
          value={state.end ?? ""}
          onChange={handleEndChange}
        />
      </div>
    </fieldset>
  );
}

export default DateRangeFilter;
