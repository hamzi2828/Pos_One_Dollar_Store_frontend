"use client";
import React from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";

interface EmptyStateProps {
  searchQuery: string;
  statusFilter: string;
  categoryFilter: string;
  onClearFilters: () => void;
}

export default function EmptyState({
  searchQuery,
  statusFilter,
  categoryFilter,
  onClearFilters
}: EmptyStateProps) {
  const hasFilters = searchQuery || statusFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-6 sm:p-8 md:p-12">
      <div className="flex flex-col items-center text-center">
        <div className="p-3 sm:p-4 bg-gray-100 rounded-full mb-3 sm:mb-4">
          <Package className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
        </div>
        <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-1">No products found</h3>
        <p className="text-xs sm:text-sm text-gray-500 max-w-sm">
          {hasFilters
            ? "Try adjusting your search criteria or filters to find what you're looking for."
            : "Get started by creating your first product."}
        </p>
        <div className="mt-4 sm:mt-6 flex items-center gap-2 sm:gap-3">
          {hasFilters ? (
            <button
              onClick={onClearFilters}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Clear all filters
            </button>
          ) : (
            <Link
              href="/admin/products/create"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-900 bg-honey-500 rounded-lg hover:bg-honey-600 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
