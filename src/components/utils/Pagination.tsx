import React from "react";

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  onPageChange,
  totalItems,
  itemsPerPage,
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalItems <= 0 || totalPages <= 1) return null;

  return (
    <div className="flex items-center bg-gray-50 dark:bg-[#1c1b23] rounded-lg border border-gray-200 dark:border-[#343140]/60">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        className="h-8 w-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors border-r border-gray-200 dark:border-[#343140]/60 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        ←
      </button>
      <div className="h-8 px-4 flex items-center gap-1 text-gray-500 dark:text-gray-400">
        <span>{currentPage}</span>
        <span>/</span>
        <span>{totalPages}</span>
      </div>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        className="h-8 w-8 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors border-l border-gray-200 dark:border-[#343140]/60 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        →
      </button>
    </div>
  );
};
