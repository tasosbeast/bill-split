export function DateRangeFilter({
  value,
  onChange,
  idPrefix = "date-range",
  label = "Date range",
  disabled = false,
}) {
  const handleStartChange = (event) => {
    onChange({
      ...value,
      start: event.target.value ? event.target.value : null,
    });
  };

  const handleEndChange = (event) => {
    onChange({
      ...value,
      end: event.target.value ? event.target.value : null,
    });
  };

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
