import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

type Props = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  showingFrom: number;
  showingTo: number;
  totalCount: number;
};

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  showingFrom,
  showingTo,
  totalCount,
}: Props) {
  const clampedPage = Math.min(currentPage, Math.max(1, totalPages));

  return (
    <div className="flex items-center justify-between px-3 sm:px-4 md:px-6 py-2 sm:py-3 bg-white border-t border-gray-200">
      <div className="flex-1 flex justify-between sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, clampedPage - 1))}
          disabled={clampedPage === 1}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, clampedPage + 1))}
          disabled={clampedPage === totalPages}
          className="relative inline-flex items-center px-4 py-2 ml-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing <span className="font-medium">{totalCount === 0 ? 0 : showingFrom}</span> to{' '}
            <span className="font-medium">{showingTo}</span> of{' '}
            <span className="font-medium">{totalCount}</span> results
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, clampedPage - 1))}
              disabled={clampedPage === 1}
              className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <FiChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (clampedPage <= 3) {
                pageNum = i + 1;
              } else if (clampedPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = clampedPage - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                    clampedPage === pageNum
                      ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  } border`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => onPageChange(Math.min(totalPages, clampedPage + 1))}
              disabled={clampedPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r-md hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <FiChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
