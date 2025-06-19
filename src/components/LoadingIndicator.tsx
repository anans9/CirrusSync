export const LoadingIndicator = () => (
  <div className="bg-white dark:bg-[#0e0d12] flex flex-col items-center justify-center min-h-screen">
    <div className="relative w-36 h-36">
      <svg
        className="absolute inset-0"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="cloudGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#10B981" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <path
          d="M30,62 Q22,48 36,40 Q36,25 52,28 Q72,28 78,45 Q88,53 78,70 Q62,82 42,78 Q25,74 30,62 Z"
          stroke="#10B981"
          strokeWidth="2"
          fill="url(#cloudGradient)"
        >
          <animate
            attributeName="stroke-dasharray"
            values="0 500;500 0"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </div>
    <p className="text-emerald-600 dark:text-emerald-500 text-sm font-medium tracking-wide">
      Loading Drive
      <span className="inline-block">
        <span className="animate-[dot_1s_infinite]">.</span>
        <span className="animate-[dot_1s_0.3s_infinite]">.</span>
        <span className="animate-[dot_1s_0.6s_infinite]">.</span>
      </span>
    </p>
  </div>
);
