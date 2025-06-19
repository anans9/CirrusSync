import { useState, useEffect } from "react";
import { FileText } from "lucide-react";
import { Modal } from "../Modal";
import { ItemIntegrityStatus } from "./ItemIntegrityStatus";

const getTruncatedName = (filename: string, threshold = 25) => {
  if (filename.length <= threshold) return filename;
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex < threshold - 3) {
    return filename.substring(0, threshold - 3) + "...";
  }
  const base = filename.substring(0, dotIndex);
  const ext = filename.substring(dotIndex);
  const maxBaseLength = threshold - ext.length - 3;
  if (maxBaseLength <= 0) return filename;
  if (base.length > maxBaseLength) {
    return base.substring(0, maxBaseLength) + "..." + ext;
  }
  return filename;
};

export const FileDetailsModal = ({
  isOpen,
  onClose,
  item,
  formatFileSize,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: FileDetails;
  formatFileSize: (size: number) => string;
}) => {
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const { verifyIntegrity } = useDriveCache();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTriggerRef = useRef<HTMLButtonElement>(null);

  // Close tooltip on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.display = "none";
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setIsVerified(false);
      setIsVerifying(false);
    }
  }, [isOpen]);

  const verifyFileIntegrity = async () => {
    setIsVerifying(true);
    try {
      const result = await verifyIntegrity(
        item.id,
        item.type,
        item.original.signatureEmail,
      );
      await new Promise((resolve) => setTimeout(resolve, 500));
      setIsVerified(result);
    } catch (error) {
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      verifyFileIntegrity();
    }
  }, [isOpen, item.id]);

  const showTooltip = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = "block";
      const rect = e.currentTarget.getBoundingClientRect();
      tooltipRef.current.style.left = `${
        rect.left + window.scrollX - 125 + rect.width / 2
      }px`;
      tooltipRef.current.style.top = `${rect.bottom + window.scrollY + 10}px`;
    }
  };

  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = "none";
    }
  };

  // Function to format date in a consistent way
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000) // Convert from seconds to milliseconds
      .toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      .replace(",", " at"); // Change comma to 'at'
  };

  // Function to get truncated name
  const getTruncatedName = (name: string) => {
    return name;
  };

  // Animation variants
  const detailsVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (custom: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: 0.1 + custom * 0.05 },
    }),
  };

  // Create details array based on conditions
  const detailsArray = [
    { label: "Name", value: getTruncatedName(item.name) },
    { label: "Uploaded by", value: item?.original?.signatureEmail },
    { label: "Location", value: item.path },
    { label: "Uploaded", value: formatDate(item.createdAt) },
    { label: "Modified", value: formatDate(item.modifiedAt) },
    // Only include Deleted if item has deletedAt property
    ...(item.deletedAt
      ? [{ label: "Deleted", value: formatDate(item.deletedAt) }]
      : []),
    // Only include MIME type if item type is file
    ...(item.type === "file"
      ? [
          {
            label: "MIME type",
            value: item?.original?.mimeType,
          },
        ]
      : []),
    ...(item.type === "file"
      ? [
          {
            label: "Size",
            value: formatFileSize(item.size),
            hasTooltip: true,
          },
          {
            label: "Original size",
            value: item.size ? formatFileSize(item.size) : "-",
          },
          {
            label: "Last edited by",
            value: item.original.signatureEmail,
          },
        ]
      : []),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={item.type === "folder" ? "Folder details" : "File details"}
      icon={item.type === "folder" ? FolderIcon : FileText}
      iconColor={item.type === "folder" ? "yellow" : "emerald"}
      footer={
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            Close
          </motion.button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className={`p-4 rounded-lg flex items-start gap-3 ${
            isVerifying
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
              : isVerified
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"
                : "bg-red-100 text-red-700 dark:bg-red-500/70 dark:text-white"
          }`}
        >
          <ItemIntegrityStatus
            verified={isVerified}
            lastEditedBy={item?.original?.signatureEmail}
            isVerifying={isVerifying}
            item={item}
          />
        </motion.div>

        <div className="grid grid-cols-2 gap-y-5 gap-x-3">
          {detailsArray.map((detail, index) => (
            <React.Fragment key={detail.label}>
              <motion.div
                custom={index}
                variants={detailsVariants}
                initial="hidden"
                animate="visible"
                className="text-gray-500 dark:text-zinc-400 text-sm flex items-center"
              >
                {detail.label}
                {detail.hasTooltip && (
                  <button
                    ref={tooltipTriggerRef}
                    className="p-1 rounded-full hover:bg-zinc-100 hover:dark:bg-zinc-800 transition-colors relative cursor-pointer ml-1"
                    onMouseEnter={showTooltip}
                    onMouseLeave={hideTooltip}
                  >
                    <Info size={14} className="text-zinc-400" />
                  </button>
                )}
              </motion.div>
              <motion.div
                custom={index}
                variants={detailsVariants}
                initial="hidden"
                animate="visible"
                className="text-gray-900 dark:text-white text-sm font-medium truncate"
              >
                {detail.value}
              </motion.div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipRef.current?.style.display === "block" && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            transition={{ duration: 0.2 }}
            ref={tooltipRef}
            style={{
              position: "fixed",
              zIndex: 10000,
              left: 0,
              top: 0,
              width: "250px",
              display: "none",
            }}
            className="text-center pointer-events-none"
          >
            <div className="relative bg-white dark:bg-[#2c2934] text-black dark:text-white text-sm rounded-lg p-3 shadow-lg border border-slate-200/60 dark:border-[#343140]/60">
              <svg
                className="absolute -top-2 left-1/2 -translate-x-1/2 text-white dark:text-[#2c2934]"
                width="16"
                height="8"
                viewBox="0 0 16 8"
                fill="currentColor"
              >
                <path d="M0 8L8 0L16 8H0Z" />
              </svg>
              The encrypted data is slightly larger due to the overhead of the
              encryption and signatures, which ensure the security of your data.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};

import { AlertTriangle, Download } from "lucide-react";

export const UnsupportedFileView = ({
  currentItem,
  downloadItem,
}: {
  currentItem: FileDetails;
  downloadItem: (id: string) => void;
}) => (
  <div className="flex flex-col h-[90vh] items-center justify-center gap-4 p-8 bg-gray-50/95 dark:bg-black/90 rounded-lg">
    <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
    <div className="text-center space-y-3 max-w-md">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
        Preview Not Available
      </h3>
      <div className="space-y-2">
        <p className="text-gray-700 dark:text-zinc-300 text-sm leading-relaxed">
          Our app is currently unable to generate a preview for this document.
          We're working on adding this feature in a future update.
        </p>
        <p className="text-gray-500 dark:text-zinc-400 text-sm">
          In the meantime, you can download{" "}
          <span className="text-gray-900 dark:text-white font-medium">
            {currentItem.name}
          </span>{" "}
          to view it on your device.
        </p>
      </div>
      <div className="pt-4 flex flex-col gap-3">
        <button
          onClick={() => downloadItem(currentItem.id)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors group cursor-pointer"
        >
          <Download className="w-4 h-4 group-hover:transform group-hover:-translate-y-0.5 transition-transform" />
          <span>Download</span>
        </button>
        <span className="text-xs text-gray-500 dark:text-zinc-500">
          Opens it with your system default file viewer
        </span>
      </div>
    </div>
  </div>
);

import { ZoomIn, ZoomOut } from "lucide-react";

const MediaContainer = ({
  children,
  scale,
  onZoomIn,
  onZoomOut,
  showZoom,
}: {
  children: React.ReactNode;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  showZoom: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        onZoomIn();
      } else {
        onZoomOut();
      }
    },
    [onZoomIn, onZoomOut],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => {
        container.removeEventListener("wheel", handleWheel);
      };
    }
  }, [handleWheel]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
    >
      <div className="relative max-w-[90vw] max-h-[90vh] w-full h-full flex items-center justify-center">
        {children}
        {showZoom && (
          <div className="absolute bottom-4 z-50 flex items-center gap-2 p-2 bg-gray-100/80 dark:bg-black/60 backdrop-blur-sm rounded-lg">
            <button
              onClick={onZoomOut}
              disabled={scale <= 0.5}
              className="p-2 rounded-lg bg-gray-200/80 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ZoomOut className="w-5 h-5 text-gray-700 dark:text-white" />
            </button>
            <span className="text-gray-900 dark:text-white text-sm font-medium min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={onZoomIn}
              disabled={scale >= 3}
              className="p-2 rounded-lg bg-gray-200/80 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ZoomIn className="w-5 h-5 text-gray-700 dark:text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

import React, { useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, Info, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../context/AuthContext";
import { FileContent } from "./FileContent";
import { FolderIcon } from "../../utils/utils";
import { useDriveCache } from "../../context/DriveManager";

export const Preview: React.FC<PreviewProps> = ({
  isOpen,
  onClose,
  currentItem,
  nextItem,
  prevItem,
  hasNext,
  hasPrev,
  formatFileSize,
  currentIndex,
  totalItems,
  downloadItem,
}) => {
  const [scale, setScale] = useState(1);
  const [showFileDetails, setShowFileDetails] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(true);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const { user } = useAuth();

  const isTextBased = (filename: string): boolean => {
    const textExtensions = [
      "txt",
      "md",
      "json",
      "csv",
      "xml",
      "html",
      "css",
      "js",
      "ts",
      "jsx",
      "tsx",
      "yml",
      "yaml",
      "conf",
      "ini",
      "log",
      "py",
      "java",
      "cpp",
      "c",
      "cs",
      "go",
      "rb",
      "php",
      "swift",
      "kt",
      "rs",
      "sql",
      "pem",
      "sh",
      "env",
    ];
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return textExtensions.includes(ext);
  };

  const isSvg = currentItem.fileInfo?.mimeType === "image/svg+xml";
  const isImage = currentItem.fileInfo?.mimeType?.startsWith("image/");
  const isVideo = currentItem.fileInfo?.mimeType?.startsWith("video/");
  const isPDF = currentItem.fileInfo?.mimeType === "application/pdf";
  const canPreview =
    isTextBased(currentItem.name) || isImage || isVideo || isPDF;
  const [fileContent, setFileContent] = useState<Uint8Array | null>(null);

  const previousItemId = useRef<string | null>(null);

  interface BlobCache {
    [key: string]: { url: string; content: Uint8Array };
  }
  const blobUrlCache = useRef<BlobCache>({});

  const fetchOriginalFile = useCallback(async () => {
    if (!canPreview) {
      setIsLoadingOriginal(false);
      return;
    }

    if (currentItem.id && blobUrlCache.current[currentItem.id]) {
      setOriginalImageUrl(blobUrlCache.current[currentItem.id].url);
      setFileContent(blobUrlCache.current[currentItem.id].content);
      setIsLoadingOriginal(false);
      return;
    }

    setIsLoadingOriginal(true);

    try {
      const fileContent = await window.electron.getFileContent({
        fileId: currentItem.id,
        userId: user?.id as string,
      });

      const mimeType = isPDF
        ? "application/pdf"
        : currentItem.fileInfo?.mimeType || currentItem.thumbnail?.mime;
      const blob = new Blob([fileContent], { type: mimeType });
      const newBlobUrl = URL.createObjectURL(blob);

      if (currentItem.id) {
        blobUrlCache.current[currentItem.id] = {
          url: newBlobUrl,
          content: fileContent,
        };
      }

      setOriginalImageUrl(newBlobUrl);
      setFileContent(fileContent);
      setIsLoadingOriginal(false);
    } catch (error) {
      setPreviewError(true);
      setFileContent(null);
      setIsLoadingOriginal(false);
    }
  }, [canPreview, currentItem.id, user?.id, isPDF]);

  const cleanupCache = useCallback(() => {
    Object.values(blobUrlCache.current).forEach((item) => {
      URL.revokeObjectURL(item.url);
    });
    blobUrlCache.current = {};
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    if (previousItemId.current !== currentItem.id) {
      setScale(1);
      setPreviewError(false);
      previousItemId.current = currentItem.id;
    }

    fetchOriginalFile();

    return () => {};
  }, [isOpen, currentItem.id, fetchOriginalFile]);

  useEffect(() => {
    return () => {
      cleanupCache();
    };
  }, [cleanupCache]);

  const handleZoomIn = useCallback(() => {
    if (!isLoadingOriginal) {
      setScale((prev) => Math.min(prev + 0.25, 3));
    }
  }, [isLoadingOriginal]);

  const handleZoomOut = useCallback(() => {
    if (!isLoadingOriginal) {
      setScale((prev) => Math.max(prev - 0.25, 0.5));
    }
  }, [isLoadingOriginal]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showFileDetails && e.key === "Escape") {
        setShowFileDetails(false);
        return;
      }

      if (!isLoadingOriginal) {
        switch (e.key) {
          case "Escape":
            onClose();
            break;
          case "ArrowRight":
            if (hasNext && nextItem) nextItem();
            break;
          case "ArrowLeft":
            if (hasPrev && prevItem) prevItem();
            break;
          case "ArrowUp":
            handleZoomIn();
            break;
          case "ArrowDown":
            handleZoomOut();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    onClose,
    nextItem,
    prevItem,
    hasNext,
    hasPrev,
    showFileDetails,
    handleZoomIn,
    handleZoomOut,
    isLoadingOriginal,
  ]);

  const renderContent = () => {
    if (previewError || !canPreview) {
      return (
        <MediaContainer
          scale={scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showZoom={false}
        >
          <div className="w-full h-[90vh] rounded-lg bg-gray-100/95 dark:bg-black/90">
            <UnsupportedFileView
              currentItem={currentItem}
              downloadItem={downloadItem}
            />
          </div>
        </MediaContainer>
      );
    }

    if (isLoadingOriginal) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-gray-700 dark:text-white animate-spin" />
        </div>
      );
    }

    if (isTextBased(currentItem.name) && fileContent) {
      return (
        <FileContent
          data={fileContent}
          name={currentItem.name}
          size={currentItem.size || 0}
          currentItem={currentItem}
          downloadItem={downloadItem}
        />
      );
    }

    if (isVideo && originalImageUrl) {
      return (
        <MediaContainer
          scale={scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showZoom={false}
        >
          <video
            src={originalImageUrl}
            controls
            className="max-w-full max-h-[90vh] rounded-lg bg-gray-100 dark:bg-black"
            style={{ transform: `scale(${scale})` }}
            autoPlay
          />
        </MediaContainer>
      );
    }

    if (isPDF && originalImageUrl) {
      return (
        <MediaContainer
          scale={scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showZoom={true}
        >
          <object
            data={`${originalImageUrl}#toolbar=0`}
            type="application/pdf"
            className="w-full h-[90vh] rounded-lg bg-gray-100/95 dark:bg-black/90"
            style={{ transform: `scale(${scale})` }}
          >
            <UnsupportedFileView
              currentItem={currentItem}
              downloadItem={downloadItem}
            />
          </object>
        </MediaContainer>
      );
    }

    if (isImage && originalImageUrl) {
      return (
        <MediaContainer
          scale={scale}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          showZoom={true}
        >
          <motion.img
            src={originalImageUrl}
            alt={currentItem.name}
            className={`rounded-lg shadow-2xl ${
              isSvg
                ? "w-auto max-h-[90vh]"
                : "max-w-full max-h-[90vh] object-contain"
            }`}
            style={{ transform: `scale(${scale})` }}
            draggable={false}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        </MediaContainer>
      );
    }
  };

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-white dark:bg-black backdrop-blur-sm"
            onClick={handleBackgroundClick}
          >
            <div className="absolute top-0 left-0 right-0 z-50 p-8 flex justify-between items-center bg-gradient-to-b from-gray-50/80 to-transparent dark:from-black/50 dark:to-transparent">
              <span className="text-gray-900/90 dark:text-white/90 text-[15px] font-medium w-[200px] truncate">
                {getTruncatedName(currentItem.name)}
              </span>

              <div className="flex-1 flex items-center justify-center gap-4 px-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevItem?.();
                  }}
                  disabled={!hasPrev}
                  className="p-2 rounded-lg bg-gray-200/80 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-gray-200/80 dark:disabled:hover:bg-white/10"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-white" />
                </button>

                <span className="text-gray-600/60 dark:text-white/60 text-sm min-w-[80px] text-center">
                  {currentIndex + 1} of {totalItems}
                </span>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextItem?.();
                  }}
                  disabled={!hasNext}
                  className="p-2 rounded-lg bg-gray-200/80 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-default disabled:hover:bg-gray-200/80 dark:disabled:hover:bg-white/10"
                >
                  <ChevronRight className="w-5 h-5 text-gray-700 dark:text-white" />
                </button>
              </div>

              <div className="flex items-center gap-2 w-[200px] justify-end">
                <button
                  onClick={() => setShowFileDetails(true)}
                  className="p-2 rounded-lg bg-gray-200/80 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <Info className="w-5 h-5 text-gray-700 dark:text-white" />
                </button>
                <button
                  onClick={() => downloadItem(currentItem.id)}
                  className="p-2 rounded-lg bg-gray-200/80 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <Download className="w-5 h-5 text-gray-700 dark:text-white" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg bg-gray-200/80 hover:bg-gray-300/80 dark:bg-white/10 dark:hover:bg-white/20 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-gray-700 dark:text-white" />
                </button>
              </div>
            </div>

            <div
              className="h-full w-full flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              {renderContent()}
            </div>

            {isImage && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-gray-600/60 dark:text-white/60 text-sm">
                Use arrow keys to navigate and zoom
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <FileDetailsModal
        isOpen={showFileDetails}
        onClose={() => setShowFileDetails(false)}
        formatFileSize={formatFileSize}
        item={currentItem}
        user={user as User}
      />
    </>
  );
};
