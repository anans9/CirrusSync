import React from "react";
import {
  FileKey,
  Key,
  Mail,
  Phone,
  Search,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

// Common shimmer classes
const shimmerClass = "animate-pulse bg-gray-200 dark:bg-[#1c1b23]";
const shimmerInsideCardClass = "animate-pulse bg-gray-200 dark:bg-[#2c2934]";

// --------------- DASHBOARD SKELETON LOADERS ---------------

export const DashboardSkeletonLoader = () => (
  <div className="flex flex-col h-full pb-6 lg:pb-2">
    {/* Static Header Skeleton */}
    <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="h-5 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
          <div className="mt-2 h-3 w-64 bg-gray-50 dark:bg-[#2c2934]/70 rounded-md"></div>
        </div>
      </div>
    </div>

    {/* Storage Section */}
    <div className="overflow-y-auto flex-grow">
      <div className="space-y-6 pb-6">
        <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden w-full">
          <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 sm:px-6 py-4">
            <div className={`h-5 w-32 ${shimmerClass} rounded mb-2`}></div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="space-y-4 xl:space-y-0 xl:grid xl:grid-cols-3 xl:gap-5">
              {/* Storage Usage Content */}
              <div className="xl:col-span-2">
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex flex-wrap justify-between items-start sm:items-baseline gap-2">
                    <div>
                      <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                        <div
                          className={`h-6 w-20 ${shimmerClass} rounded`}
                        ></div>
                        <div
                          className={`h-4 w-28 ${shimmerClass} rounded`}
                        ></div>
                      </div>
                      <div
                        className={`h-4 w-36 ${shimmerClass} rounded mt-1`}
                      ></div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`h-6 w-16 ${shimmerClass} rounded ml-auto`}
                      ></div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 sm:h-2.5 w-full bg-slate-100 dark:bg-[#343140] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: "30%",
                      }}
                    ></div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`h-4 w-36 ${shimmerClass} rounded`}></div>
                    <div className={`h-4 w-32 ${shimmerClass} rounded`}></div>
                  </div>
                </div>
              </div>

              {/* Storage Upgrade or Premium Info */}
              <div className="xl:col-span-1">
                <div className="h-full bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/20 p-3 sm:p-4">
                  <div
                    className={`h-5 w-48 ${shimmerClass} rounded mb-2`}
                  ></div>
                  <div
                    className={`h-4 w-full ${shimmerClass} rounded mt-1`}
                  ></div>
                  <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-emerald-100 dark:border-emerald-800/20">
                    <div className="space-y-1.5 sm:space-y-2">
                      {[1, 2].map((index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1.5 sm:gap-2"
                        >
                          <div
                            className={`h-4 w-4 ${shimmerClass} rounded-full`}
                          ></div>
                          <div
                            className={`h-4 w-full ${shimmerClass} rounded`}
                          ></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    className={`w-full mt-3 sm:mt-4 h-8 ${shimmerClass} rounded-lg`}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Plan Section */}
        <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden w-full">
          <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 sm:px-6 py-4">
            <div className={`h-5 w-24 ${shimmerClass} rounded mb-2`}></div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="space-y-4 sm:space-y-6 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-6">
              {/* Current Plan Card */}
              <div className="bg-white dark:bg-[#1c1b23] rounded-lg border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200/60 dark:border-[#343140]/60 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={`h-8 w-8 ${shimmerInsideCardClass} rounded-lg`}
                    ></div>
                    <div
                      className={`h-4 w-28 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>
                  <div
                    className={`h-5 w-16 ${shimmerInsideCardClass} rounded-full`}
                  ></div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-baseline gap-1 sm:gap-2 mb-3 sm:mb-4">
                    <div
                      className={`h-6 w-16 ${shimmerInsideCardClass} rounded`}
                    ></div>
                    <div
                      className={`h-4 w-16 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <div
                      className={`h-4 w-32 ${shimmerInsideCardClass} rounded`}
                    ></div>
                    <div className="space-y-1.5 sm:space-y-2">
                      {[1, 2, 3, 4, 5].map((index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1.5 sm:gap-2"
                        >
                          <div
                            className={`h-4 w-4 ${shimmerInsideCardClass} rounded-full`}
                          ></div>
                          <div
                            className={`h-4 w-full ${shimmerInsideCardClass} rounded`}
                          ></div>
                        </div>
                      ))}
                    </div>

                    <div
                      className={`h-5 w-full ${shimmerInsideCardClass} rounded mt-3`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Recommended Plan Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/10 rounded-lg border border-emerald-200/60 dark:border-emerald-800/30 overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-emerald-200/60 dark:border-emerald-800/30 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={`h-8 w-8 ${shimmerInsideCardClass} rounded-lg`}
                    ></div>
                    <div
                      className={`h-4 w-28 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>
                  <div
                    className={`h-5 w-24 ${shimmerInsideCardClass} rounded-full`}
                  ></div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="flex items-baseline gap-1 sm:gap-2 mb-3 sm:mb-4">
                    <div
                      className={`h-6 w-16 ${shimmerInsideCardClass} rounded`}
                    ></div>
                    <div
                      className={`h-4 w-16 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <div
                      className={`h-4 w-32 ${shimmerInsideCardClass} rounded`}
                    ></div>
                    <div className="space-y-1.5 sm:space-y-2">
                      {[1, 2, 3, 4].map((index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1.5 sm:gap-2"
                        >
                          <div
                            className={`h-4 w-4 ${shimmerInsideCardClass} rounded-full`}
                          ></div>
                          <div
                            className={`h-4 w-full ${shimmerInsideCardClass} rounded`}
                          ></div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-emerald-200/60 dark:border-emerald-800/20">
                      <div
                        className={`h-8 w-full ${shimmerInsideCardClass} rounded-lg`}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden w-full">
          <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 sm:px-6 py-4">
            <div className={`h-5 w-32 ${shimmerClass} rounded mb-2`}></div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="relative overflow-hidden p-3 sm:p-4 bg-white dark:bg-[#1c1b23] rounded-lg sm:rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0 pr-12 sm:pr-0">
                      <div
                        className={`h-10 w-10 ${shimmerInsideCardClass} rounded-xl flex-shrink-0`}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`h-4 w-40 ${shimmerInsideCardClass} rounded mb-1`}
                        ></div>
                        <div
                          className={`h-3 w-56 ${shimmerInsideCardClass} rounded`}
                        ></div>
                      </div>
                    </div>
                    <div className="absolute top-3 right-3 sm:static sm:flex-shrink-0">
                      <div
                        className={`h-6 w-11 ${shimmerInsideCardClass} rounded-full`}
                      ></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
);

// --------------- SECURITY SKELETON LOADERS ---------------

export const SecuritySettingsSkeletonLoader = () => (
  <div className="flex flex-col h-full pb-6 lg:pb-2">
    {/* Static Header Skeleton */}
    <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="h-5 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
          <div className="mt-2 h-3 w-64 bg-gray-50 dark:bg-[#2c2934]/70 rounded-md"></div>
        </div>
      </div>
    </div>

    {/* Security Settings */}
    <div className="overflow-y-auto flex-grow">
      <div className="space-y-6 pb-6">
        <div className="space-y-4">
          {[1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0 pr-10 sm:pr-0">
                  <div
                    className={`${shimmerInsideCardClass} h-10 w-10 rounded-xl flex-shrink-0`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div
                        className={`${shimmerInsideCardClass} h-4 w-36 rounded`}
                      />
                      {index % 2 === 0 && (
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-10 rounded-full`}
                        />
                      )}
                    </div>
                    <div
                      className={`${shimmerInsideCardClass} h-3 w-full max-w-md rounded mt-1`}
                    />
                    {index % 3 === 0 && (
                      <div
                        className={`${shimmerInsideCardClass} h-3 w-2/3 rounded mt-1`}
                      />
                    )}
                  </div>
                </div>
                <div
                  className={`${shimmerClass} h-6 w-11 rounded-full flex-shrink-0`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* MFA Methods */}
        <div className="mt-8 space-y-4">
          <div className={`${shimmerClass} h-5 w-64 rounded mb-4`} />

          <div className={`${shimmerClass} h-16 w-full rounded-lg mb-4`} />

          {[1, 2, 3].map((index) => (
            <div
              key={index}
              className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0 pr-10 sm:pr-0">
                  <div
                    className={`${shimmerInsideCardClass} h-10 w-10 rounded-xl flex-shrink-0`}
                  />
                  <div className="flex-1 min-w-0">
                    <div
                      className={`${shimmerInsideCardClass} h-4 w-40 rounded mb-2`}
                    />
                    <div className="flex items-center flex-wrap gap-2">
                      <div
                        className={`${shimmerInsideCardClass} h-4 w-16 rounded-full`}
                      />
                      {index === 2 && (
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-40 rounded-full`}
                        />
                      )}
                    </div>
                  </div>
                </div>
                <div
                  className={`${shimmerClass} h-6 w-11 rounded-full flex-shrink-0`}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Sessions */}
        <div className="mt-8 space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className={`${shimmerClass} h-5 w-40 rounded`} />
              <div className={`${shimmerClass} h-8 w-24 rounded`} />
            </div>
            <div className={`${shimmerClass} h-4 w-full max-w-lg rounded`} />
          </div>

          {[1, 2].map((index) => (
            <div
              key={index}
              className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60"
            >
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`${shimmerInsideCardClass} h-10 w-10 rounded-xl flex-shrink-0`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-32 rounded`}
                        />
                        {index === 1 && (
                          <div
                            className={`${shimmerInsideCardClass} h-5 w-28 rounded-md`}
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-32 rounded-md`}
                        />
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-28 rounded-md`}
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    className={`${shimmerInsideCardClass} h-8 w-24 rounded`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className={`${shimmerInsideCardClass} h-8 w-full rounded-lg`}
                  />
                  <div
                    className={`${shimmerInsideCardClass} h-8 w-full rounded-lg`}
                  />
                </div>
              </div>
            </div>
          ))}

          <div className={`${shimmerClass} h-10 w-full rounded-lg`} />
        </div>

        {/* Security Events */}
        <div className="mt-8 space-y-4">
          <div className="flex flex-col space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className={`${shimmerClass} h-5 w-40 rounded`} />
              <div className={`${shimmerClass} h-8 w-24 rounded`} />
            </div>
            <div className={`${shimmerClass} h-4 w-full max-w-lg rounded`} />
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-3">
            <div className={`${shimmerClass} h-8 w-24 rounded-lg`}></div>
            <div className={`${shimmerClass} h-8 w-28 rounded-lg`}></div>
            <div className={`${shimmerClass} h-8 w-32 rounded-lg`}></div>
          </div>

          {[1, 2, 3, 4, 5].map((index) => (
            <div
              key={index}
              className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`${shimmerInsideCardClass} h-10 w-10 rounded-xl flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-28 rounded`}
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-24 rounded-full`}
                        />
                        <div
                          className={`${shimmerInsideCardClass} h-4 w-32 rounded-full`}
                        />
                      </div>
                    </div>
                    <div
                      className={`${shimmerInsideCardClass} h-3 w-24 rounded`}
                    />
                  </div>
                  <div
                    className={`${shimmerInsideCardClass} mt-3 h-10 w-full rounded-lg`}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// For exporting individual components
export const SessionsSkeletonLoader = ({ count = 2 }) => {
  return (
    <div className="space-y-4 overflow-y-auto">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60"
        >
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`${shimmerInsideCardClass} h-10 w-10 rounded-xl flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <div
                      className={`${shimmerInsideCardClass} h-4 w-32 rounded`}
                    />
                    {index === 1 && (
                      <div
                        className={`${shimmerInsideCardClass} h-5 w-28 rounded-md`}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className={`${shimmerInsideCardClass} h-4 w-32 rounded-md`}
                    />
                    <div
                      className={`${shimmerInsideCardClass} h-4 w-28 rounded-md`}
                    />
                  </div>
                </div>
              </div>
              <div className={`${shimmerInsideCardClass} h-8 w-24 rounded`} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className={`${shimmerInsideCardClass} h-8 w-full rounded-lg`}
              />
              <div
                className={`${shimmerInsideCardClass} h-8 w-full rounded-lg`}
              />
            </div>
          </div>
        </div>
      ))}

      <div className={`${shimmerClass} h-10 w-full rounded-lg`} />
    </div>
  );
};

export const EventsSkeletonLoader = ({ count = 5 }) => {
  return (
    <div className="space-y-4 overflow-y-auto">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div
              className={`${shimmerInsideCardClass} h-10 w-10 rounded-xl flex-shrink-0`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={`${shimmerInsideCardClass} h-4 w-28 rounded`}
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div
                      className={`${shimmerInsideCardClass} h-4 w-24 rounded-full`}
                    />
                    <div
                      className={`${shimmerInsideCardClass} h-4 w-32 rounded-full`}
                    />
                  </div>
                </div>
                <div className={`${shimmerInsideCardClass} h-3 w-24 rounded`} />
              </div>
              <div
                className={`${shimmerInsideCardClass} mt-3 h-10 w-full rounded-lg`}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// --------------- RECOVERY SKELETON LOADERS ---------------

export const RecoverySkeletonLoader = () => (
  <div className="flex flex-col h-full pb-6 lg:pb-2">
    {/* Static Header Skeleton */}
    <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="h-5 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
          <div className="mt-2 h-3 w-64 bg-gray-50 dark:bg-[#2c2934]/70 rounded-md"></div>
        </div>
      </div>
    </div>

    {/* Security Score Card */}
    <div className="overflow-y-auto flex-grow">
      <div className="space-y-6 pb-6">
        <div className="relative overflow-hidden p-5 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-12 rounded-full flex items-center justify-center ${shimmerInsideCardClass}`}
              >
                <Shield className="h-6 w-6 text-gray-300 dark:text-gray-600" />
              </div>
              <div>
                <h3 className={`h-4 w-64 rounded mb-2 ${shimmerClass}`}></h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-32 h-2 bg-gray-100 dark:bg-[#343140] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${shimmerClass}`}
                      style={{ width: "30%" }}
                    ></div>
                  </div>
                  <span className={`h-4 w-16 rounded ${shimmerClass}`}></span>
                </div>
                <p
                  className={`h-3 w-full max-w-sm rounded mt-2 ${shimmerClass}`}
                ></p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className={`h-4 w-48 rounded mb-2 ${shimmerClass}`}></h4>
          <p className={`h-3 w-full max-w-md rounded ${shimmerClass}`}></p>
        </div>

        <div className="space-y-4">
          {/* Email Recovery Method */}
          <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-emerald-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4
                    className={`h-4 w-32 rounded ${shimmerInsideCardClass}`}
                  ></h4>
                  <span
                    className={`h-4 w-16 rounded-full ${shimmerInsideCardClass}`}
                  ></span>
                </div>
                <p
                  className={`h-3 w-full max-w-md rounded ${shimmerInsideCardClass}`}
                ></p>

                <div className="space-y-3 mt-3">
                  <div className="relative">
                    <input
                      disabled
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2c2934]/70 border-0 rounded-lg text-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="absolute top-4 right-4 sm:static sm:ml-2">
                <div
                  className={`h-6 w-11 rounded-full ${shimmerInsideCardClass}`}
                ></div>
              </div>
            </div>
          </div>

          {/* Phone Recovery Method */}
          <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="h-5 w-5 text-emerald-500" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4
                    className={`h-4 w-32 rounded ${shimmerInsideCardClass}`}
                  ></h4>
                </div>
                <p
                  className={`h-3 w-full max-w-md rounded ${shimmerInsideCardClass}`}
                ></p>

                <div className="space-y-3 mt-3">
                  <div className="relative">
                    <div className="flex bg-gray-50 dark:bg-[#2c2934]/70 rounded-lg">
                      <div
                        className={`flex-shrink-0 h-9 w-24 rounded-l-lg ${shimmerInsideCardClass}`}
                      ></div>
                      <div className="w-px h-full bg-gray-200 dark:bg-gray-700/50"></div>
                      <input
                        disabled
                        className="flex-1 min-w-0 px-3 py-2 bg-transparent border-0 text-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute top-4 right-4 sm:static sm:ml-2">
                <div
                  className={`h-6 w-11 rounded-full ${shimmerInsideCardClass}`}
                ></div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className={`h-4 w-32 rounded mb-2 ${shimmerClass}`}></h4>
              <p className={`h-3 w-full max-w-md rounded ${shimmerClass}`}></p>
            </div>

            {/* Recovery Phrase */}
            <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0">
                  <Key className="h-5 w-5 text-emerald-500" />
                </div>

                <div className="flex-1 min-w-0 pr-10 sm:pr-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4
                      className={`h-4 w-32 rounded ${shimmerInsideCardClass}`}
                    ></h4>
                  </div>
                  <p
                    className={`h-3 w-full max-w-md rounded ${shimmerInsideCardClass}`}
                  ></p>
                  <button
                    className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 ${shimmerInsideCardClass} rounded-lg h-7 w-48`}
                  ></button>
                </div>

                <div className="absolute top-4 right-4 sm:static sm:ml-2">
                  <div
                    className={`h-6 w-11 rounded-full ${shimmerInsideCardClass}`}
                  ></div>
                </div>
              </div>
            </div>

            {/* Recovery File */}
            <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0">
                  <FileKey className="h-5 w-5 text-emerald-500" />
                </div>

                <div className="flex-1 min-w-0 pr-10 sm:pr-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4
                      className={`h-4 w-32 rounded ${shimmerInsideCardClass}`}
                    ></h4>
                  </div>
                  <p
                    className={`h-3 w-full max-w-md rounded ${shimmerInsideCardClass}`}
                  ></p>
                  <button
                    className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 ${shimmerInsideCardClass} rounded-lg h-7 w-44`}
                  ></button>
                </div>

                <div className="absolute top-4 right-4 sm:static sm:ml-2">
                  <div
                    className={`h-6 w-11 rounded-full ${shimmerInsideCardClass}`}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --------------- ACCOUNT SKELETON LOADERS ---------------

export const AccountSkeletonLoader = () => (
  <div className="flex flex-col h-full pb-6 lg:pb-2">
    {/* Static Header Skeleton */}
    <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="h-5 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
          <div className="mt-2 h-3 w-64 bg-gray-50 dark:bg-[#2c2934]/70 rounded-md"></div>
        </div>
      </div>
    </div>

    {/* Scrollable Content Skeleton */}
    <div className="overflow-y-auto flex-grow">
      <div className="space-y-8 pb-6">
        {/* Profile Section Skeleton */}
        <div className="space-y-5">
          <div>
            <div className="h-5 w-36 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
            <div className="mt-2 h-3 w-56 bg-gray-50 dark:bg-[#2c2934]/70 rounded-md"></div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="animate-pulse relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
                <div className="space-y-4">
                  <div className="h-4 w-24 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                  <div className="h-10 w-full bg-gray-50 dark:bg-[#2c2934]/70 rounded-lg"></div>
                  <div className="h-3 w-48 bg-gray-50 dark:bg-[#2c2934]/50 rounded-md"></div>
                </div>
              </div>

              <div className="animate-pulse relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
                <div className="space-y-4">
                  <div className="h-4 w-24 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                  <div className="h-10 w-full bg-gray-50 dark:bg-[#2c2934]/70 rounded-lg"></div>
                  <div className="h-3 w-48 bg-gray-50 dark:bg-[#2c2934]/50 rounded-md"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Password Section Skeleton */}
        <div className="space-y-5">
          <div>
            <div className="h-5 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
            <div className="mt-2 h-3 w-56 bg-gray-50 dark:bg-[#2c2934]/70 rounded-md"></div>
          </div>

          <div className="animate-pulse relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
            <div className="space-y-6">
              <div className="h-4 w-36 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-32 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                  <div className="h-10 w-full bg-gray-50 dark:bg-[#2c2934]/70 rounded-lg"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-28 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                  <div className="h-10 w-full bg-gray-50 dark:bg-[#2c2934]/70 rounded-lg"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-36 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                  <div className="h-10 w-full bg-gray-50 dark:bg-[#2c2934]/70 rounded-lg"></div>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="h-10 w-32 bg-gray-100 dark:bg-[#2c2934] rounded-lg"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy Section Skeleton */}
        <div className="space-y-5">
          <div>
            <div className="h-5 w-48 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
            <div className="mt-2 h-3 w-64 bg-gray-50 dark:bg-[#2c2934]/70 rounded-md"></div>
          </div>

          <div className="space-y-4">
            <div className="animate-pulse relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
              <div className="space-y-4">
                <div>
                  <div className="h-4 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                  <div className="mt-2 h-3 w-full bg-gray-50 dark:bg-[#2c2934]/50 rounded-md"></div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#343140]/40">
                    <div className="space-y-2">
                      <div className="h-4 w-48 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                      <div className="h-3 w-64 bg-gray-50 dark:bg-[#2c2934]/50 rounded-md"></div>
                    </div>
                    <div className="h-6 w-11 rounded-full bg-gray-200 dark:bg-[#343140]"></div>
                  </div>

                  <div className="flex items-center justify-between py-2">
                    <div className="space-y-2">
                      <div className="h-4 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                      <div className="h-3 w-56 bg-gray-50 dark:bg-[#2c2934]/50 rounded-md"></div>
                    </div>
                    <div className="h-6 w-11 rounded-full bg-gray-200 dark:bg-[#343140]"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="animate-pulse relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
              <div className="space-y-4">
                <div>
                  <div className="h-4 w-24 bg-gray-100 dark:bg-[#2c2934] rounded-md"></div>
                  <div className="mt-2 h-3 w-48 bg-gray-50 dark:bg-[#2c2934]/50 rounded-md"></div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="h-10 w-40 bg-gray-100 dark:bg-[#2c2934] rounded-lg"></div>
                  <div className="h-10 w-40 bg-red-50 dark:bg-red-900/10 rounded-lg"></div>
                </div>

                <div className="h-3 w-full max-w-md bg-gray-50 dark:bg-[#2c2934]/50 rounded-md"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// --------------- BILLING SKELETON LOADERS ---------------

export const BillingSkeletonLoader = () => (
  <div className="flex flex-col h-full pb-6 lg:pb-2">
    {/* Static Header - With flex-shrink-0 to prevent it from shrinking */}
    <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className={`h-6 w-48 ${shimmerClass} rounded mb-2`}></div>
          <div className={`h-4 w-64 ${shimmerClass} rounded`}></div>
        </div>
      </div>
    </div>

    {/* Main content container with proper flexbox layout */}
    <div className="flex flex-col h-full min-h-0 flex-grow">
      {/* Alert for delinquent accounts (Optional) - Static with flex-shrink-0 */}
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg mb-6 flex-shrink-0">
        <div className="flex items-start">
          <div
            className={`h-5 w-5 ${shimmerClass} rounded-full flex-shrink-0`}
          ></div>
          <div className="ml-3 space-y-2">
            <div className={`h-4 w-48 ${shimmerClass} rounded`}></div>
            <div
              className={`h-3 w-full max-w-md ${shimmerClass} rounded`}
            ></div>
            <div className={`h-8 w-40 ${shimmerClass} rounded-lg mt-3`}></div>
          </div>
        </div>
      </div>

      {/* Tab Navigation - Static with flex-shrink-0 */}
      <div className="mb-6 -mx-2 sm:mx-0 flex-shrink-0">
        <div className="relative flex border-b border-slate-200/60 dark:border-[#343140]/60 overflow-x-auto hide-scrollbar">
          <div
            className={`py-2 px-4 w-24 ${shimmerClass} rounded-t-lg mb-0.5 relative`}
          >
            <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></span>
          </div>
          <div
            className={`py-2 px-4 w-40 ${shimmerClass} rounded-t-lg mb-0.5 ml-2`}
          ></div>
          <div
            className={`py-2 px-4 w-20 ${shimmerClass} rounded-t-lg mb-0.5 ml-2`}
          ></div>
          <div
            className={`py-2 px-4 w-32 ${shimmerClass} rounded-t-lg mb-0.5 ml-2`}
          ></div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="overflow-y-auto flex-grow min-h-0 pr-2">
        <div className="space-y-6 pb-6">
          {/* Current Plan Card */}
          <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
            <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3 flex flex-wrap justify-between items-center gap-2">
              <div
                className={`h-5 w-32 ${shimmerInsideCardClass} rounded`}
              ></div>
              <div
                className={`h-8 w-28 ${shimmerInsideCardClass} rounded-lg`}
              ></div>
            </div>
            <div className="p-4">
              <div className="flex flex-wrap items-center gap-4 mb-4">
                <div
                  className={`h-12 w-12 rounded-full ${shimmerInsideCardClass}`}
                ></div>
                <div>
                  <div
                    className={`h-5 w-40 ${shimmerInsideCardClass} rounded mb-1`}
                  ></div>
                  <div
                    className={`h-3 w-48 ${shimmerInsideCardClass} rounded`}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {/* Price Card */}
                <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3">
                  <div className="flex items-center mb-1">
                    <div
                      className={`h-4 w-4 ${shimmerInsideCardClass} rounded-full mr-1`}
                    ></div>
                    <div
                      className={`h-4 w-16 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>
                  <div
                    className={`h-5 w-24 ${shimmerInsideCardClass} rounded`}
                  ></div>
                  <div
                    className={`h-3 w-36 ${shimmerInsideCardClass} rounded mt-1`}
                  ></div>
                </div>

                {/* Renewal Card */}
                <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3">
                  <div className="flex items-center mb-1">
                    <div
                      className={`h-4 w-4 ${shimmerInsideCardClass} rounded-full mr-1`}
                    ></div>
                    <div
                      className={`h-4 w-24 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>
                  <div
                    className={`h-5 w-28 ${shimmerInsideCardClass} rounded`}
                  ></div>
                  <div
                    className={`h-3 w-32 ${shimmerInsideCardClass} rounded mt-1`}
                  ></div>
                </div>

                {/* Storage Card */}
                <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3">
                  <div className="flex items-center mb-1">
                    <div
                      className={`h-4 w-4 ${shimmerInsideCardClass} rounded-full mr-1`}
                    ></div>
                    <div
                      className={`h-4 w-16 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-5 w-16 ${shimmerInsideCardClass} rounded`}
                    ></div>
                    <div
                      className={`h-3 w-20 ${shimmerInsideCardClass} rounded`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Auto-renewal toggle */}
              <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div
                    className={`h-4 w-28 ${shimmerInsideCardClass} rounded mb-1`}
                  ></div>
                  <div
                    className={`h-3 w-full max-w-md ${shimmerInsideCardClass} rounded`}
                  ></div>
                </div>
                <div
                  className={`h-5 w-10 ${shimmerInsideCardClass} rounded-full`}
                ></div>
              </div>

              {/* Features */}
              <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-[#343140]/60">
                <div
                  className={`h-4 w-32 ${shimmerInsideCardClass} rounded mb-2`}
                ></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-1.5">
                  {[1, 2, 3, 4, 5, 6].map((index) => (
                    <div key={index} className="flex items-start">
                      <div
                        className={`h-3.5 w-3.5 ${shimmerInsideCardClass} rounded-full mt-0.5 flex-shrink-0`}
                      ></div>
                      <div
                        className={`h-4 w-32 ${shimmerInsideCardClass} rounded ml-2`}
                      ></div>
                    </div>
                  ))}
                </div>
                <div
                  className={`h-4 w-28 ${shimmerInsideCardClass} rounded-md mt-2`}
                ></div>
              </div>
            </div>
          </section>

          {/* Upgrade Recommendation */}
          <section className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/20 overflow-hidden shadow-sm">
            <div className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div>
                  <div
                    className={`h-5 w-24 ${shimmerInsideCardClass} rounded-full mb-1`}
                  ></div>
                  <div
                    className={`h-5 w-40 ${shimmerInsideCardClass} rounded mb-1`}
                  ></div>
                  <div
                    className={`h-3 w-64 ${shimmerInsideCardClass} rounded`}
                  ></div>
                </div>

                <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
                  <div
                    className={`h-3 w-20 ${shimmerInsideCardClass} rounded mb-1`}
                  ></div>
                  <div
                    className={`h-5 w-24 ${shimmerInsideCardClass} rounded mb-2`}
                  ></div>
                  <div
                    className={`h-8 w-full sm:w-32 ${shimmerInsideCardClass} rounded-lg`}
                  ></div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                {[1, 2, 3, 4, 5, 6].map((index) => (
                  <div key={index} className="flex items-start">
                    <div
                      className={`h-3.5 w-3.5 ${shimmerInsideCardClass} rounded-full mt-0.5 flex-shrink-0`}
                    ></div>
                    <div
                      className={`h-4 w-32 ${shimmerInsideCardClass} rounded ml-2`}
                    ></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Payment Method Tab Content */}
          <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
            <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3 flex flex-wrap justify-between items-center gap-2">
              <div
                className={`h-5 w-32 ${shimmerInsideCardClass} rounded`}
              ></div>
              <div
                className={`h-8 w-28 ${shimmerInsideCardClass} rounded-lg`}
              ></div>
            </div>
            <div className="p-4">
              {/* Credit Card Skeleton */}
              <div className="relative overflow-hidden rounded-xl shadow mb-4">
                <div className="p-5 bg-gradient-to-r from-emerald-500 to-emerald-700 h-36 sm:h-28">
                  <div className="relative z-10 flex flex-col h-full">
                    {/* Top section - Card brand and chip */}
                    <div className="flex justify-between mb-4">
                      <div
                        className={`w-8 h-6 bg-yellow-200 rounded-sm opacity-90`}
                      ></div>
                      <div className={`h-6 w-12 ${shimmerClass} rounded`}></div>
                    </div>

                    {/* Card Number */}
                    <div
                      className={`h-4 w-40 ${shimmerClass} rounded mb-4`}
                    ></div>

                    {/* Bottom section */}
                    <div className="flex justify-between items-end mt-auto">
                      <div>
                        <div
                          className={`h-3 w-14 ${shimmerClass} rounded mb-1 opacity-80`}
                        ></div>
                        <div
                          className={`h-4 w-10 ${shimmerClass} rounded`}
                        ></div>
                      </div>

                      <div>
                        <div
                          className={`h-3 w-16 ${shimmerClass} rounded mb-1 opacity-80`}
                        ></div>
                        <div
                          className={`h-5 w-16 ${shimmerClass} rounded-md`}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Actions */}
              <div className="flex flex-wrap gap-3">
                <div
                  className={`h-8 w-32 ${shimmerInsideCardClass} rounded-lg`}
                ></div>
                <div
                  className={`h-8 w-32 ${shimmerInsideCardClass} rounded-lg`}
                ></div>
              </div>
            </div>
          </section>

          {/* Billing History Tab Content */}
          <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
            <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <div
                className={`h-5 w-32 ${shimmerInsideCardClass} rounded`}
              ></div>
            </div>

            <div className="p-4">
              {/* Search & Filters Bar */}
              <div className="pb-5 p-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Search Box */}
                  <div className="relative flex-1 min-w-[200px]">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <div
                      className={`h-8 w-full rounded-md ${shimmerClass} pl-10`}
                    ></div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Filters Button */}
                    <div
                      className={`h-8 w-24 ${shimmerClass} rounded-md`}
                    ></div>

                    {/* Time Range Selector */}
                    <div
                      className={`h-8 w-48 ${shimmerClass} rounded-md`}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="border border-[#e1e1e6]/60 dark:border-[#343140]/60 rounded-md overflow-x-auto">
                <table
                  style={{ borderCollapse: "separate", borderSpacing: 0 }}
                  className="min-w-full border-0"
                >
                  <thead>
                    <tr className="bg-[#f9f9fb] dark:bg-[#2c2934] border-b border-[#e1e1e6]/60 dark:border-[#343140]/60">
                      {[
                        "Date",
                        "Description",
                        "Method",
                        "Status",
                        "Amount",
                        "Receipt",
                      ].map((i) => (
                        <th
                          key={i}
                          className="px-5 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
                        >
                          <div
                            className={`h-4 w-16 ${shimmerInsideCardClass} rounded`}
                          ></div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((index) => (
                      <tr
                        key={index}
                        className="border-b border-[#e1e1e6]/60 dark:border-[#343140]/60 animate-pulse"
                      >
                        {/* Date */}
                        <td className="px-5 py-4 align-top">
                          <div
                            className={`h-5 w-24 ${shimmerInsideCardClass} rounded mb-1.5`}
                          ></div>
                          <div
                            className={`h-3 w-16 ${shimmerInsideCardClass} rounded`}
                          ></div>
                        </td>

                        {/* Description */}
                        <td className="px-5 py-4 align-top">
                          <div
                            className={`h-5 w-32 ${shimmerInsideCardClass} rounded mb-1.5`}
                          ></div>
                          <div
                            className={`h-3 w-40 ${shimmerInsideCardClass} rounded`}
                          ></div>
                        </td>

                        {/* Payment Method */}
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center">
                            <div
                              className={`h-5 w-5 ${shimmerInsideCardClass} rounded-full mr-2`}
                            ></div>
                            <div className="flex flex-col">
                              <div
                                className={`h-4 w-16 ${shimmerInsideCardClass} rounded mb-1`}
                              ></div>
                              <div
                                className={`h-3 w-10 ${shimmerInsideCardClass} rounded`}
                              ></div>
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 align-top">
                          <div
                            className={`h-6 w-20 ${shimmerInsideCardClass} rounded-full`}
                          ></div>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4 text-right align-top">
                          <div
                            className={`h-5 w-16 ${shimmerInsideCardClass} rounded ml-auto`}
                          ></div>
                        </td>

                        {/* Receipt */}
                        <td className="px-5 py-4 text-right align-top">
                          <div
                            className={`h-4 w-4 ${shimmerInsideCardClass} rounded-full ml-auto`}
                          ></div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-4 flex flex-wrap justify-between items-center">
                <div className={`h-4 w-40 ${shimmerClass} rounded`}></div>

                <div className="flex items-center space-x-1 mt-3 sm:mt-0">
                  <div className={`p-1.5 rounded-md ${shimmerClass}`}>
                    <ChevronLeft className="h-4 w-4" />
                  </div>

                  {[1, 2, 3, "...", 10].map((index) => (
                    <div
                      key={`page-${index}`}
                      className={`px-3 py-1.5 rounded-md ${
                        index === 0 ? "bg-emerald-500" : shimmerClass
                      }`}
                    ></div>
                  ))}

                  <div className={`p-1.5 rounded-md ${shimmerClass}`}>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Static Help or Support Section - Show on all tabs */}
      <div className="flex-shrink-0 mt-6 mb-6">
        <section className="bg-slate-50 dark:bg-[#2c2934] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
          <div className="p-4">
            <div
              className={`h-5 w-32 ${shimmerInsideCardClass} rounded mb-2`}
            ></div>
            <div
              className={`h-3 w-full max-w-md ${shimmerInsideCardClass} rounded mb-4`}
            ></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                className={`h-10 w-full ${shimmerInsideCardClass} rounded-lg`}
              ></div>
              <div
                className={`h-10 w-full ${shimmerInsideCardClass} rounded-lg`}
              ></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
);

// --------------- APPEARANCE SKELETON LOADERS ---------------

export const AppearanceSkeletonLoader = () => {
  return (
    <div className="flex flex-col h-full pb-6 lg:pb-2">
      {/* Static Header - With flex-shrink-0 to prevent it from shrinking */}
      <div className="pb-6 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
        <div className={`h-6 w-48 ${shimmerClass} rounded mb-2`}></div>
        <div className={`h-4 w-64 ${shimmerClass} rounded`}></div>
      </div>

      {/* Scrollable Content Area */}
      <div className="overflow-y-auto flex-grow min-h-0">
        <div className="space-y-6 pb-6">
          <div className="space-y-4">
            <div className={`h-5 w-16 ${shimmerClass} rounded`}></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`relative overflow-hidden p-5 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 ${
                    index === 1 ? "border-2 border-emerald-500" : ""
                  }`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none">
                    <div
                      className={`w-full h-full ${shimmerClass} rounded-full`}
                    ></div>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`h-10 w-10 ${shimmerInsideCardClass} rounded-xl flex-shrink-0`}
                    ></div>
                    <div className="flex flex-col items-start">
                      <div
                        className={`h-4 w-24 ${shimmerInsideCardClass} rounded mb-1`}
                      ></div>
                      {index === 1 && (
                        <div
                          className={`h-5 w-16 ${shimmerInsideCardClass} rounded-full`}
                        ></div>
                      )}
                    </div>
                  </div>
                  <div
                    className={`h-3 w-full ${shimmerInsideCardClass} rounded`}
                  ></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --------------- SETTINGS SKELETON LOADER ---------------

export const SettingsSkeletonLoader: React.FC<{
  activeSection:
    | "dashboard"
    | "security"
    | "recovery"
    | "account"
    | "billing"
    | "appearance";
  mainContentRef: React.RefObject<HTMLDivElement | null>;
}> = ({ activeSection, mainContentRef }) => {
  const renderSkeleton = () => {
    switch (activeSection) {
      case "dashboard":
        return <DashboardSkeletonLoader />;
      case "security":
        return <SecuritySettingsSkeletonLoader />;
      case "recovery":
        return <RecoverySkeletonLoader />;
      case "account":
        return <AccountSkeletonLoader />;
      case "billing":
        return <BillingSkeletonLoader />;
      case "appearance":
        return <AppearanceSkeletonLoader />;
      default:
        return <DashboardSkeletonLoader />;
    }
  };

  return (
    <main ref={mainContentRef} className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white/95 dark:bg-[#040405] lg:rounded-xl shadow-sm lg:border border-slate-400/20 dark:border-[#343140] p-4 sm:p-6 overflow-y-auto overscroll-none flex-1 lg:mb-4">
        {renderSkeleton()}
      </div>
    </main>
  );
};
