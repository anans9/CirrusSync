export const SkeletonItem = ({ type = "session" }) => {
  return (
    <div className="animate-pulse relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
      <div className="flex items-start gap-3">
        {/* Icon placeholder */}
        <div className="h-10 w-10 bg-gray-100 dark:bg-[#2c2934] rounded-xl flex-shrink-0 border border-gray-200 dark:border-[#343140]/60"></div>
        <div className="flex-1 space-y-3 min-w-0">
          {/* Title and badges */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="h-4 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
            <div className="h-4 w-24 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
          </div>
          {/* Tags line */}
          <div className="flex flex-wrap gap-2">
            <div className="h-3 w-28 bg-gray-50 dark:bg-[#2c2934] rounded-full"></div>
            <div className="h-3 w-24 bg-gray-50 dark:bg-[#2c2934] rounded-full"></div>
          </div>
          {/* Additional details for session */}
          {type === "session" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="h-8 bg-gray-50 dark:bg-[#2c2934] rounded-lg"></div>
              <div className="h-8 bg-gray-50 dark:bg-[#2c2934] rounded-lg"></div>
            </div>
          )}
          {/* Additional details for events */}
          {type === "event" && (
            <div className="mt-3 h-10 bg-gray-50 dark:bg-[#2c2934] rounded-lg"></div>
          )}
        </div>
        {/* Action button for sessions */}
        {type === "session" && (
          <div className="sm:flex-shrink-0">
            <div className="h-8 w-24 bg-gray-100 dark:bg-[#2c2934] rounded-lg"></div>
          </div>
        )}
      </div>
    </div>
  );
};

// Skeleton loader for session list
export const SessionsSkeletonLoader = ({ count = 3 }) => {
  return (
    <div className="space-y-4">
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <SkeletonItem key={`session-skeleton-${index}`} type="session" />
        ))}
    </div>
  );
};

// Skeleton loader for events list
export const EventsSkeletonLoader = ({ count = 5 }) => {
  return (
    <div className="space-y-4">
      {Array(count)
        .fill(0)
        .map((_, index) => (
          <SkeletonItem key={`event-skeleton-${index}`} type="event" />
        ))}
    </div>
  );
};
