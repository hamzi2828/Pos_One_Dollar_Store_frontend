"use client";
import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ProductPaginationProps {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
  filteredCount: number;
  indexOfFirstProduct: number;
  indexOfLastProduct: number;
}

export default function ProductPagination({
  currentPage,
  totalPages,
  setCurrentPage,
  filteredCount,
  indexOfFirstProduct,
  indexOfLastProduct
}: ProductPaginationProps) {
  if (filteredCount === 0) return null;

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 px-2 sm:px-4 py-2 sm:py-3">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Results info - hidden on mobile, shown on larger screens */}
        <p className="hidden sm:block text-sm text-gray-600">
          Showing <span className="font-medium text-gray-900">{filteredCount === 0 ? 0 : indexOfFirstProduct + 1}</span> to{" "}
          <span className="font-medium text-gray-900">{Math.min(indexOfLastProduct, filteredCount)}</span> of{" "}
          <span className="font-medium text-gray-900">{filteredCount}</span> products
        </p>

        {/* Mobile results info */}
        <p className="sm:hidden text-xs text-gray-600">
          <span className="font-medium">{filteredCount}</span> products
        </p>

        {/* Pagination controls */}
        <div className="flex items-center gap-1">
          {/* Previous Button */}
          <button
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className="p-1.5 sm:p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>

          {/* Page Numbers */}
          <div className="hidden sm:flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              page === '...' ? (
                <span key={`ellipsis-${index}`} className="px-2 py-1 text-gray-400">...</span>
              ) : (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page as number)}
                  className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                    currentPage === page
                      ? "bg-honey-500 text-gray-900 font-semibold shadow-md"
                      : "text-gray-600 hover:bg-sage-100"
                  }`}
                >
                  {page}
                </button>
              )
            ))}
          </div>

          {/* Mobile page indicator */}
          <span className="sm:hidden px-2 py-0.5 text-xs text-gray-600">
            {currentPage}/{totalPages}
          </span>

          {/* Next Button */}
          <button
            onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-1.5 sm:p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
