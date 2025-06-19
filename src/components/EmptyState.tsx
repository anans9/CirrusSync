interface EmptyStateProps {
  isTrash?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ isTrash = false }) => (
  <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] text-gray-500 dark:text-gray-400">
    <div className="relative group animate-float">
      <div className="absolute inset-0 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-3xl blur-xl transform group-hover:scale-110 transition-transform duration-300" />
      <div className="relative w-32 h-32 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-3xl flex items-center justify-center mb-8 transform group-hover:scale-105 transition-transform duration-300">
        {isTrash ? (
          <svg
            className="w-16 h-16 text-emerald-500 dark:text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        ) : (
          <svg
            className="w-16 h-16 text-emerald-500 dark:text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 14v5a2 2 0 002 2h14a2 2 0 002-2v-5" />
            <path d="M12 3v12M7 8l5-5 5 5" />
          </svg>
        )}
      </div>
    </div>
    <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
      {isTrash ? "Trash is empty" : "Upload your files"}
    </h3>
    {isTrash ? (
      <p className="text-base text-gray-500 dark:text-gray-400 mb-1">
        Files that you delete will appear here
      </p>
    ) : (
      <>
        <p className="text-base text-gray-500 dark:text-gray-400 mb-1">
          Drag and drop files here or
        </p>
        <p className="text-base">
          use the{" "}
          <span className="font-medium text-emerald-600 dark:text-emerald-400">
            "+&nbsp;New"
          </span>{" "}
          button
        </p>
      </>
    )}
  </div>
);
