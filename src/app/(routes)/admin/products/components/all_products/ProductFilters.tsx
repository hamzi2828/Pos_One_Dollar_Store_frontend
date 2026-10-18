"use client";
import React, { useMemo } from "react";
import { Search, X, Filter } from "lucide-react";
import Select, { type StylesConfig, type SingleValue } from "react-select";

type CategoryOption = { value: string; label: string };

// Select2-like styling — tuned to match existing filter controls
const selectStyles: StylesConfig<CategoryOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 40,
    borderRadius: 8,
    borderColor: state.isFocused ? "#111827" : "#d1d5db",
    boxShadow: state.isFocused ? "0 0 0 1px #111827" : "none",
    fontSize: 14,
    backgroundColor: "white",
    cursor: "pointer",
    "&:hover": { borderColor: state.isFocused ? "#111827" : "#9ca3af" },
  }),
  valueContainer: (base) => ({ ...base, padding: "0 8px" }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, padding: 6, color: "#6b7280" }),
  clearIndicator: (base) => ({ ...base, padding: 4, color: "#9ca3af" }),
  menu: (base) => ({
    ...base,
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
    overflow: "hidden",
    zIndex: 40,
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 13,
    padding: "8px 12px",
    backgroundColor: state.isSelected
      ? "#111827"
      : state.isFocused
        ? "#f3f4f6"
        : "white",
    color: state.isSelected ? "white" : "#111827",
    cursor: "pointer",
  }),
  placeholder: (base) => ({ ...base, color: "#9ca3af", fontSize: 13 }),
  singleValue: (base) => ({ ...base, color: "#111827", fontSize: 13 }),
};

interface ProductFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: "all" | "published" | "draft" | "out_of_stock";
  setStatusFilter: (filter: "all" | "published" | "draft" | "out_of_stock") => void;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  availableCategories: string[];
  onCurrentPageReset: () => void;
  onClearFilters?: () => void;
}

export default function ProductFilters({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  availableCategories,
  onCurrentPageReset,
  onClearFilters
}: ProductFiltersProps) {
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleStatusChange = (value: "all" | "published" | "draft" | "out_of_stock") => {
    setStatusFilter(value);
  };

  const handleCategoryChange = (option: SingleValue<CategoryOption>) => {
    setCategoryFilter(option?.value || "all");
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  // Build options for react-select
  const categoryOptions = useMemo<CategoryOption[]>(
    () => [
      { value: "all", label: "All Categories" },
      ...availableCategories.map((c) => ({ value: c, label: c })),
    ],
    [availableCategories]
  );

  const selectedCategoryOption =
    categoryOptions.find((o) => o.value === categoryFilter) || categoryOptions[0];

  const hasActiveFilters = searchQuery || statusFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 sm:gap-4">
        {/* Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
            <input
              type="text"
              aria-label="Search products"
              className="h-8 sm:h-10 w-full rounded-lg border border-gray-300 bg-white pl-8 sm:pl-10 pr-8 sm:pr-10 text-xs sm:text-sm placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 rounded p-0.5 sm:p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filters:</span>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as "all" | "published" | "draft" | "out_of_stock")}
            className="h-8 sm:h-10 px-2 sm:px-3 rounded-lg border border-gray-300 bg-white text-xs sm:text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all duration-200"
          >
            <option value="all">All Status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          {/* Category Filter — searchable Select2-style dropdown */}
          <div className="min-w-[180px] sm:min-w-[220px]">
            <Select<CategoryOption, false>
              instanceId="product-category-filter"
              value={selectedCategoryOption}
              onChange={handleCategoryChange}
              options={categoryOptions}
              placeholder="All Categories"
              isSearchable
              isClearable={categoryFilter !== "all"}
              styles={selectStyles}
              noOptionsMessage={() => "No categories found"}
              menuPlacement="auto"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
