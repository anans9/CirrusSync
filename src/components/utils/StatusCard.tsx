import React from "react";

interface StatusCardProps {
  icon: React.ElementType;
  title: string;
  status: string;
  mainValue: string | number;
  mainLabel: string;
  footerIcon: React.ElementType;
  footerText: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  icon: Icon,
  title,
  status,
  mainValue,
  mainLabel,
  footerIcon: FooterIcon,
  footerText,
}) => {
  return (
    <div className="relative flex flex-col h-full overflow-hidden p-4 sm:p-5 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200 hover:shadow-md">
      {/* Background Icon */}
      <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 opacity-[0.03] pointer-events-none">
        {Icon && <Icon className="w-full h-full text-emerald-500" />}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-5">
        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {title}
          </h3>
          <span className="inline-flex mt-0.5 sm:mt-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
            {status}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
          <span className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
            {mainValue}
          </span>
          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            {mainLabel}
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-1.5 sm:gap-2 text-xs text-gray-500 dark:text-gray-400 bg-slate-100 dark:bg-[#2c2934] px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg">
          <FooterIcon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-500 flex-shrink-0" />
          <span className="truncate">{footerText}</span>
        </div>
      </div>
    </div>
  );
};
