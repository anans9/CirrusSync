import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Download,
  Clock,
  FileIcon,
  Check,
  AlertCircle,
  RefreshCw,
  Calendar,
  Filter,
  Clock4,
  DownloadCloud,
  Ban,
  ExternalLink,
  Shield,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Modal } from "../Modal";
import { ApiService } from "../../services/ApiService";
import { format, formatDistance, isBefore } from "date-fns";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

// Define the download status type
type DownloadStatus = "processing" | "completed" | "failed" | "expired";

// Define interfaces for type safety
interface DownloadHistoryItem {
  id: string;
  user_id: string;
  status: DownloadStatus;
  file_name: string;
  file_size?: string;
  download_url?: string;
  error_message?: string;
  created_at: number;
  completed_at?: number;
  expires_at?: number;
  filters?: {
    range?: string;
    start_date?: string;
    end_date?: string;
    event_types?: string[];
  };
}

interface DownloadOptions {
  range: "all" | "custom" | "last30" | "last90";
  startDate?: string;
  endDate?: string;
  eventTypes?: string[];
}

interface DownloadEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  setToastMessage?: (message: any) => void;
  setShowToast?: (show: boolean) => void;
}

const DownloadEventsModal: React.FC<DownloadEventsModalProps> = ({
  isOpen,
  onClose,
  setToastMessage,
  setShowToast,
}) => {
  // Refs
  const processedRef = useRef(false);

  // States
  const [activeTab, setActiveTab] = useState<"new" | "available">("new");
  const [downloadOptions, setDownloadOptions] = useState<DownloadOptions>({
    range: "all",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    eventTypes: [],
  });
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>(
    [],
  );
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);
  const [activeDownload, setActiveDownload] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [coolingDown, setCoolingDown] = useState<boolean>(false);
  const [cooldownInfo, setCooldownInfo] = useState<{
    daysRemaining: number;
    lastDownload: DownloadHistoryItem | null;
  }>({
    daysRemaining: 0,
    lastDownload: null,
  });

  // Show toast helper
  const showToast = useCallback(
    (type: "success" | "error" | "info", message: string) => {
      if (setToastMessage && setShowToast) {
        setToastMessage({ type, text: message });
        setShowToast(true);
      }
    },
    [setToastMessage, setShowToast],
  );

  // Fetch download history and available event types when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchInitialData();
    }

    // Clean up poll interval if it exists when modal closes
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [isOpen]);

  // Fetch all initial data
  const fetchInitialData = async () => {
    try {
      // Fetch data in parallel
      await Promise.all([
        fetchDownloadHistory(),
        fetchEventTypes(),
        checkCooldownStatus(),
      ]);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 500); // Add slight delay for smoother transition
    }
  };

  // Format timestamp helper
  const formatTimestamp = (timestamp: number, isExpiry = false) => {
    if (!timestamp) return "Unknown";

    const date = new Date(timestamp * 1000);

    if (isExpiry) {
      // For expiry dates, show relative time if within 7 days
      const now = new Date();
      const diffDays = Math.floor(
        (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays < 7 && diffDays >= 0) {
        return `Expires ${formatDistance(date, now, { addSuffix: true })}`;
      } else if (diffDays < 0) {
        return "Expired";
      }
    }

    return format(date, "MMM d, yyyy h:mm a");
  };

  // Check cooldown status
  const checkCooldownStatus = async () => {
    try {
      // Try to download with empty options to check if we're in cooldown
      await ApiService.downloadSecurityEvents({
        range: "all",
      });

      setCoolingDown(false);
    } catch (error: any) {
      if (error?.response?.status === 429) {
        // We're in cooldown
        setCoolingDown(true);

        // Extract days remaining and last download info
        const data = error?.response?.data;
        if (data) {
          setCooldownInfo({
            daysRemaining: parseInt(data.detail.match(/\d+/g)?.pop() || "0"),
            lastDownload: data.last_download || null,
          });
        }
      } else {
        setCoolingDown(false);
      }
    }
  };

  // Poll for download status updates
  const startPollingDownload = useCallback(
    (downloadId: string) => {
      setActiveDownload(downloadId);

      // Clear any existing interval
      if (pollInterval) {
        clearInterval(pollInterval);
      }

      // Create new interval
      const interval = setInterval(async () => {
        try {
          const response = await ApiService.getDownloadStatus(downloadId);

          if (response.code === 1000) {
            const download = response.download;

            // Update the download in history
            setDownloadHistory((prev) =>
              prev.map((item) => (item.id === downloadId ? download : item)),
            );

            // If it's completed or failed, stop polling
            if (download.status !== "processing") {
              if (pollInterval) {
                clearInterval(pollInterval);
                setPollInterval(null);
              }
              setActiveDownload(null);

              // Show toast for completion or failure
              if (download.status === "completed") {
                showToast("success", "Your security events download is ready!");
              } else if (download.status === "failed") {
                showToast(
                  "error",
                  download.error_message ||
                    "Download failed. Please try again later.",
                );
              }
            }
          }
        } catch (error) {
          // Stop polling on error
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
          setActiveDownload(null);
        }
      }, 3000); // Poll every 3 seconds

      setPollInterval(interval);
    },
    [pollInterval, showToast],
  );

  const fetchDownloadHistory = async () => {
    try {
      const response = await ApiService.getDownloadHistory();

      if (response.code === 1000) {
        // Only keep active (non-expired) downloads
        const activeDownloads = response.downloads.filter(
          (download: DownloadHistoryItem) => download.status !== "expired",
        );

        setDownloadHistory(activeDownloads);

        // Check if any downloads are in processing state and resume polling
        const processingDownload = activeDownloads.find(
          (download: DownloadHistoryItem) => download.status === "processing",
        );

        if (processingDownload) {
          startPollingDownload(processingDownload.id);
        }
      }
    } catch (error) {
      showToast("error", "Failed to load download history");
    }
  };

  const refreshDownloads = async () => {
    setRefreshing(true);
    try {
      await fetchDownloadHistory();
    } finally {
      // Add slight delay for smoother transition
      setTimeout(() => {
        setRefreshing(false);
      }, 500);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const response = await ApiService.getSecurityEventTypes();
      if (response.code === 1000) {
        setAvailableEventTypes(response.event_types || []);
      }
    } catch (error) {
      showToast("error", "Failed to load event types");
    }
  };

  const handleRangeChange = (range: DownloadOptions["range"]) => {
    let startDate = downloadOptions.startDate;

    if (range === "last30") {
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
    } else if (range === "last90") {
      startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
    }

    setDownloadOptions({
      ...downloadOptions,
      range,
      startDate: range !== "custom" ? startDate : downloadOptions.startDate,
    });
  };

  const handleEventTypeToggle = (eventType: string) => {
    const updatedTypes = downloadOptions.eventTypes?.includes(eventType)
      ? downloadOptions.eventTypes.filter((type) => type !== eventType)
      : [...(downloadOptions.eventTypes || []), eventType];

    setDownloadOptions({
      ...downloadOptions,
      eventTypes: updatedTypes,
    });
  };

  const handleDownload = async () => {
    if (processedRef.current) return;
    processedRef.current = true;

    try {
      setIsProcessing(true);
      const response = await ApiService.downloadSecurityEvents(downloadOptions);

      if (response.code === 1000) {
        // Get download ID and start polling its status
        const downloadId = response.download_id;

        // Show success toast
        showToast(
          "success",
          "Download request initiated. Processing your events...",
        );

        // Refresh download history to get the new entry
        await fetchDownloadHistory();

        // Start polling for status updates
        startPollingDownload(downloadId);

        // Switch to history tab to view progress
        setActiveTab("available");
      }
    } catch (error) {
      const err = error as ApiError;
      showToast("error", err?.data?.detail || "Failed to initiate download");
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        processedRef.current = false;
      }, 1000);
    }
  };

  // Full corrected download file function
  const handleDownloadFile = async (downloadId: string) => {
    if (isDownloading) return;

    try {
      setIsDownloading(downloadId);
      const response = await ApiService.getDownloadUrl(downloadId);

      if (response.code === 1000 && response.download_url) {
        // Get the file name from history
        const downloadItem = downloadHistory.find(
          (item) => item.id === downloadId,
        );
        const fileName =
          downloadItem?.file_name ||
          `security_events_${new Date().getTime()}.json`;

        try {
          // Ask user where to save the file using Tauri's save dialog
          const filePath = await save({
            defaultPath: fileName,
            filters: [
              {
                name: "JSON Files",
                extensions: ["json"],
              },
            ],
          });

          if (filePath) {
            showToast("info", "Downloading file...");

            // Standard fetch for getting the data
            const downloadResponse = await fetch(response.download_url);
            const arrayBuffer = await downloadResponse.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Use Tauri's writeFile with the proper signature
            await writeFile(filePath, uint8Array);

            // Show success message
            showToast("success", "File downloaded successfully!");
          }
        } catch (error) {
          showToast("error", "Failed to save file");
        }
      }
    } catch (error) {
      const err = error as ApiError;
      showToast("error", err.data.detail || "Failed to get download URL");
    } finally {
      setIsDownloading(null);
    }
  };

  // Get status badge style and icon
  const getStatusBadge = (status: DownloadStatus, isActive: boolean) => {
    switch (status) {
      case "processing":
        return {
          className:
            "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
          icon: isActive ? (
            <div className="h-3 w-3 mr-1 animate-spin rounded-full border-b-2 border-current"></div>
          ) : (
            <Clock4 className="h-3 w-3 mr-1" />
          ),
        };
      case "completed":
        return {
          className:
            "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
          icon: <Check className="h-3 w-3 mr-1" />,
        };
      case "failed":
        return {
          className:
            "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400",
          icon: <AlertCircle className="h-3 w-3 mr-1" />,
        };
      case "expired":
        return {
          className:
            "bg-emerald-50/30 dark:bg-[#343140]/60 text-emerald-600 dark:text-emerald-400",
          icon: <Ban className="h-3 w-3 mr-1" />,
        };
    }
  };

  // Check if a date is in the past
  const isExpired = (expiryTimestamp?: number) => {
    if (!expiryTimestamp) return true;

    const expiryDate = new Date(expiryTimestamp * 1000);
    return isBefore(expiryDate, new Date());
  };

  // Render download history skeleton loader
  const renderSkeletonLoader = () => (
    <div className="space-y-4">
      <div className="p-4 rounded-lg border border-emerald-100/30 dark:border-[#343140]/60 bg-emerald-50/30 dark:bg-[#2c2934]/30 animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
          <div className="w-full">
            <div className="h-4 w-48 bg-emerald-100/50 dark:bg-[#343140]/60 rounded mb-2"></div>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <div className="h-3 w-24 bg-emerald-100/50 dark:bg-[#343140]/60 rounded"></div>
              <div className="h-3 w-20 bg-emerald-100/50 dark:bg-[#343140]/60 rounded"></div>
              <div className="h-3 w-16 bg-emerald-100/50 dark:bg-[#343140]/60 rounded"></div>
            </div>
          </div>
          <div className="h-8 w-20 bg-emerald-100/50 dark:bg-[#343140]/60 rounded"></div>
        </div>
        <div className="h-16 w-full bg-emerald-100/50 dark:bg-[#343140]/60 rounded"></div>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Download Security Events"
      icon={Download}
      iconColor="emerald"
      maxWidth="lg:max-w-3xl"
      footer={
        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
            disabled={isProcessing}
          >
            Cancel
          </motion.button>

          {activeTab === "new" && !coolingDown && (
            <motion.button
              whileHover={!isProcessing ? { scale: 1.02 } : {}}
              whileTap={!isProcessing ? { scale: 0.98 } : {}}
              type="button"
              onClick={handleDownload}
              className="px-6 py-2.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer flex items-center gap-2"
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Download Events
                </>
              )}
            </motion.button>
          )}
        </div>
      }
    >
      <div className="flex border-b border-slate-200/60 dark:border-[#343140]/60">
        <button
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "new"
              ? "text-emerald-600 dark:text-emerald-500 border-b-2 border-emerald-500"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("new")}
        >
          New Download
        </button>
        <button
          className={`flex-1 px-6 py-3 text-sm font-medium transition-colors cursor-pointer ${
            activeTab === "available"
              ? "text-emerald-600 dark:text-emerald-500 border-b-2 border-emerald-500"
              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
          onClick={() => setActiveTab("available")}
        >
          Available Downloads
        </button>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-20 w-full bg-emerald-50/30 dark:bg-[#2c2934]/30 rounded"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-emerald-50/30 dark:bg-[#2c2934]/30 rounded"></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="h-12 w-full bg-emerald-50/30 dark:bg-[#2c2934]/30 rounded"></div>
                <div className="h-12 w-full bg-emerald-50/30 dark:bg-[#2c2934]/30 rounded"></div>
                <div className="h-12 w-full bg-emerald-50/30 dark:bg-[#2c2934]/30 rounded"></div>
                <div className="h-12 w-full bg-emerald-50/30 dark:bg-[#2c2934]/30 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {activeTab === "new" && (
            <div className="p-6 space-y-6">
              {coolingDown && (
                <div className="mb-4 p-4 rounded-lg border border-amber-200/70 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium mb-1">
                        Download cooldown active
                      </h4>
                      <p className="text-sm">
                        You can download security events once every 7 days.
                        Please wait {cooldownInfo.daysRemaining} more{" "}
                        {cooldownInfo.daysRemaining === 1 ? "day" : "days"}{" "}
                        before requesting a new download.
                      </p>
                      {cooldownInfo.lastDownload && (
                        <div className="mt-2 text-xs p-2 bg-amber-100/40 dark:bg-amber-800/20 rounded">
                          <div>
                            Last download:{" "}
                            {formatTimestamp(
                              cooldownInfo.lastDownload.created_at,
                            )}
                          </div>
                          {cooldownInfo.lastDownload.status === "completed" &&
                            !isExpired(
                              cooldownInfo.lastDownload.expires_at,
                            ) && (
                              <button
                                onClick={() => {
                                  setActiveTab("available");
                                }}
                                className="text-amber-700 dark:text-amber-300 underline mt-1 inline-flex items-center gap-1 cursor-pointer"
                              >
                                <ExternalLink className="h-3 w-3" /> View
                                previous download
                              </button>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Time Range
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => handleRangeChange("all")}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      downloadOptions.range === "all"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200/60 dark:border-[#343140]/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#343140]/30"
                    }`}
                    disabled={coolingDown}
                  >
                    All Events
                  </button>
                  <button
                    onClick={() => handleRangeChange("last30")}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      downloadOptions.range === "last30"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200/60 dark:border-[#343140]/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#343140]/30"
                    }`}
                    disabled={coolingDown}
                  >
                    Last 30 Days
                  </button>
                  <button
                    onClick={() => handleRangeChange("last90")}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      downloadOptions.range === "last90"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200/60 dark:border-[#343140]/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#343140]/30"
                    }`}
                    disabled={coolingDown}
                  >
                    Last 90 Days
                  </button>
                  <button
                    onClick={() => handleRangeChange("custom")}
                    className={`px-4 py-3 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      downloadOptions.range === "custom"
                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400"
                        : "border-slate-200/60 dark:border-[#343140]/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#343140]/30"
                    }`}
                    disabled={coolingDown}
                  >
                    Custom Range
                  </button>
                </div>

                {downloadOptions.range === "custom" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label
                        htmlFor="start-date"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >
                        Start Date
                      </label>
                      <input
                        type="date"
                        id="start-date"
                        value={downloadOptions.startDate}
                        onChange={(e) =>
                          setDownloadOptions({
                            ...downloadOptions,
                            startDate: e.target.value,
                          })
                        }
                        disabled={coolingDown}
                        className="w-full bg-slate-50/50 dark:bg-[#2c2934]/70 border border-slate-200/60 dark:border-[#343140]/60 rounded-lg px-4 py-2 text-slate-900 dark:text-white transition-all duration-300 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 focus:border-transparent cursor-pointer"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="end-date"
                        className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                      >
                        End Date
                      </label>
                      <input
                        type="date"
                        id="end-date"
                        value={downloadOptions.endDate}
                        onChange={(e) =>
                          setDownloadOptions({
                            ...downloadOptions,
                            endDate: e.target.value,
                          })
                        }
                        max={new Date().toISOString().split("T")[0]}
                        disabled={coolingDown}
                        className="w-full bg-slate-50/50 dark:bg-[#2c2934]/70 border border-slate-200/60 dark:border-[#343140]/60 rounded-lg px-4 py-2 text-slate-900 dark:text-white transition-all duration-300 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 focus:border-transparent cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>

              {availableEventTypes.length > 0 && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                      <Filter className="h-4 w-4" />
                      Event Types (Optional)
                    </h4>
                    <button
                      className="text-xs text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                      onClick={() =>
                        setDownloadOptions({
                          ...downloadOptions,
                          eventTypes:
                            downloadOptions.eventTypes?.length ===
                            availableEventTypes.length
                              ? []
                              : [...availableEventTypes],
                        })
                      }
                      disabled={coolingDown}
                    >
                      {downloadOptions.eventTypes?.length ===
                      availableEventTypes.length
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {availableEventTypes.map((eventType) => (
                      <label
                        key={eventType}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={downloadOptions.eventTypes?.includes(
                            eventType,
                          )}
                          onChange={() => handleEventTypeToggle(eventType)}
                          className="rounded text-emerald-500 focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 h-4 w-4 cursor-pointer"
                          disabled={coolingDown}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {eventType.replace(/_/g, " ")}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    If no event types are selected, all types will be included
                    in the download.
                  </p>
                </div>
              )}

              {/* Security notice */}
              <div className="p-3 bg-emerald-50/30 dark:bg-[#2c2934]/30 rounded-lg border border-emerald-100/40 dark:border-[#343140]/40">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                      About Security Event Downloads
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Downloaded security events are available for 7 days before
                      being automatically deleted for privacy and security
                      reasons. You can request a new download once every 7 days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "available" && (
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-sm font-medium text-slate-900 dark:text-white">
                  Available Downloads
                </h4>
                <button
                  onClick={refreshDownloads}
                  className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                  disabled={refreshing}
                >
                  <RefreshCw
                    className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>

              <AnimatePresence>
                {refreshing ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderSkeletonLoader()}
                  </motion.div>
                ) : downloadHistory.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-8 text-slate-500 dark:text-slate-400"
                  >
                    <FileIcon className="h-12 w-12 mx-auto text-emerald-200 dark:text-emerald-800/30 mb-3" />
                    <p className="text-sm">No downloads available</p>
                    <p className="text-xs mt-1">
                      {coolingDown
                        ? `You can request a new download in ${cooldownInfo.daysRemaining} days`
                        : "Click on 'New Download' to request security events"}
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4 max-h-96 overflow-y-auto pr-2"
                  >
                    {downloadHistory.map((item) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="p-4 rounded-lg border border-slate-200/60 dark:border-[#343140]/60 bg-white dark:bg-[#2c2934]/70 hover:bg-slate-50 dark:hover:bg-[#343140]/50 transition-colors"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                          <div>
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {item.file_name || "Security Events"}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTimestamp(item.created_at)}
                              </span>
                              {item.status && (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${
                                    getStatusBadge(
                                      item.status,
                                      item.id === activeDownload,
                                    ).className
                                  }`}
                                >
                                  {
                                    getStatusBadge(
                                      item.status,
                                      item.id === activeDownload,
                                    ).icon
                                  }
                                  {item.status.charAt(0).toUpperCase() +
                                    item.status.slice(1)}
                                </span>
                              )}
                              {item.file_size && (
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {item.file_size}
                                </span>
                              )}
                              {item.expires_at &&
                                item.status === "completed" && (
                                  <span
                                    className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"
                                    title={formatTimestamp(item.expires_at)}
                                  >
                                    <Clock4 className="h-3 w-3" />
                                    {formatTimestamp(item.expires_at, true)}
                                  </span>
                                )}
                            </div>
                          </div>
                          {item.status === "completed" && item.download_url && (
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleDownloadFile(item.id)}
                              className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 py-1.5 px-3 rounded-lg flex items-center gap-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer"
                              disabled={isDownloading === item.id}
                            >
                              {isDownloading === item.id ? (
                                <>
                                  <div className="h-3 w-3 mr-1 animate-spin rounded-full border-b-2 border-current"></div>
                                  Downloading...
                                </>
                              ) : (
                                <>
                                  <DownloadCloud className="h-3 w-3" />
                                  Download
                                </>
                              )}
                            </motion.button>
                          )}
                          {item.status === "processing" && (
                            <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 py-1.5 px-3 rounded-lg flex items-center gap-1">
                              <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-current"></div>
                              Processing...
                            </span>
                          )}
                        </div>

                        {item.filters && (
                          <div className="text-xs text-slate-600 dark:text-slate-300 bg-white dark:bg-[#343140] p-2.5 rounded-lg border border-emerald-100/40 dark:border-emerald-800/20">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {item.filters.range && (
                                <div>
                                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                    Range:
                                  </span>{" "}
                                  {item.filters.range === "all"
                                    ? "All Events"
                                    : item.filters.range === "last30"
                                      ? "Last 30 Days"
                                      : item.filters.range === "last90"
                                        ? "Last 90 Days"
                                        : "Custom Range"}
                                </div>
                              )}
                              {item.filters.start_date && (
                                <div>
                                  <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                    Date Range:
                                  </span>{" "}
                                  {new Date(
                                    item.filters.start_date,
                                  ).toLocaleDateString()}{" "}
                                  to{" "}
                                  {item.filters.end_date
                                    ? new Date(
                                        item.filters.end_date,
                                      ).toLocaleDateString()
                                    : "Present"}
                                </div>
                              )}
                              {item.filters.event_types &&
                                item.filters.event_types.length > 0 && (
                                  <div className="sm:col-span-2">
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400">
                                      Event Types:
                                    </span>{" "}
                                    {item.filters.event_types.length ===
                                    availableEventTypes.length
                                      ? "All"
                                      : item.filters.event_types
                                          .map((type) =>
                                            type.replace(/_/g, " "),
                                          )
                                          .join(", ")}
                                  </div>
                                )}
                            </div>
                          </div>
                        )}

                        {item.status === "failed" && item.error_message && (
                          <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg flex items-start gap-1">
                            <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                            <span>{item.error_message}</span>
                          </div>
                        )}

                        {item.status === "processing" && (
                          <div className="mt-2">
                            <div className="w-full h-1.5 bg-emerald-50/40 dark:bg-[#343140]/60 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 dark:bg-emerald-600 rounded-full animate-pulse"></div>
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 text-center">
                              Processing your download... This may take a few
                              minutes.
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Download policy reminder */}
              <div className="mt-4 text-xs text-slate-600 dark:text-slate-400 bg-emerald-50/30 dark:bg-[#2c2934]/30 p-3 rounded-lg border border-emerald-100/40 dark:border-[#343140]/40">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400" />
                  <div>
                    <p className="mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        Download Policy:
                      </span>{" "}
                      You can request a new download once every 7 days.
                    </p>
                    <p>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        File Expiration:
                      </span>{" "}
                      Downloaded files are automatically deleted after 7 days.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

export default DownloadEventsModal;
