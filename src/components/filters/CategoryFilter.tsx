import { ChangeEvent } from "react";
import { CATEGORY_FILTER_ALL } from "../../lib/transactionFilters";

export type CategoryFilterProps = {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  id?: string;
  includeAllOption?: boolean;
  disabled?: boolean;
};

export function CategoryFilter({
  categories,
  value,
  onChange,
  label = "Category",
  id = "category-filter",
  includeAllOption = true,
  disabled = false,
}: CategoryFilterProps) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value);
  }

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
