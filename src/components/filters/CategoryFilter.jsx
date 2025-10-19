import { useCallback } from "react";
import { CATEGORY_FILTER_ALL } from "../../lib/transactionFilters";

const EMPTY_LIST = Object.freeze([]);

export function CategoryFilter({
  categories = EMPTY_LIST,
  value = CATEGORY_FILTER_ALL,
  onChange = () => {},
  label = "Category",
  id = "category-filter",
  includeAllOption = true,
  disabled = false,
}) {
  const handleChange = useCallback(
    (event) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <label className="filter-field" htmlFor={id}>
      <span className="filter-label">{label}</span>
      <select
        id={id}
        className="select w-180"
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        {includeAllOption && (
          <option value={CATEGORY_FILTER_ALL}>{CATEGORY_FILTER_ALL}</option>
        )}
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </label>
  );
}

export default CategoryFilter;
