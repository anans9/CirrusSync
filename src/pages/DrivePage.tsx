import { useVirtualizer } from "@tanstack/react-virtual";
import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  memo,
  FC,
  useReducer,
  useTransition,
} from "react";
import {
  List,
  Upload,
  FileUp,
  FolderUp,
  Edit,
  Trash,
  Download,
  LayoutGrid,
  ChevronRight,
  MoreVertical,
  Eye,
  FolderPlus,
  Info,
  Move,
  EyeIcon,
  ArrowUp,
  Users,
  Lock,
} from "lucide-react";
import { TauriEvent } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";

import Toast from "../components/Toast";
import { FileIcon, FolderIcon } from "../utils/utils";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { ActionTooltip, TooltipItem } from "../components/Home/ActionToolTip";
import { FileDetailsModal, Preview } from "../components/Home/Preview";
import FolderBrowserModal from "../components/Home/FolderBrowserModal";
import Dialog from "../components/Home/DialogModal";
import { TransferHandler } from "../components/Home/TransferHandler";
import { useDriveCache } from "../context/DriveManager";
import { invoke } from "@tauri-apps/api/core";
import useTauriEventListeners from "../hooks/useTauriEventListeners";
import { CustomCheckBox } from "../components/CustomCheckBox";

interface DriveItem {
  id: string;
  type: "folder" | "file" | "share";
  name: string;
  selected?: boolean;
  size: number;
  createdAt: number;
  modifiedAt: number;
  parentId?: string;
  isShared?: boolean;
  thumbnail?: {
    blobURL?: string;
  };
}

interface SelectedItem {
  id: string;
  name: string;
  type: string;
  size?: number;
}

interface TooltipPosition {
  x: number;
  y: number;
  isLeft: boolean;
}

interface ApiError {
  message: string;
}

interface ItemProps {
  item: DriveItem;
  onSelect: (id: string, keepSelection?: boolean) => void;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  downloadItem: (id: string) => void;
  moveToTrash: () => void;
  setIsMoveFolderModalOpen: (isOpen: boolean) => void;
  renameItem: (id: string) => void;
  setShowPreview: (show: boolean) => void;
  setShowDetailsModal: (show: boolean) => void;
  tooltipPortal: HTMLDivElement | null;
  user: User;
  isSmallScreen?: boolean;
}

interface VirtualizedViewProps {
  items: DriveItem[];
  onSelect: (id: string, keepSelection?: boolean) => void;
  handleFolderClick: (e: React.MouseEvent, item: DriveItem) => void;
  handleDownload: (id: string) => void;
  handleEdit: (id: string) => void;
  setIsMoveFolderModalOpen: (open: boolean) => void;
  user: User;
  setShowPreview: (show: boolean) => void;
  setShowDetailsModal: (show: boolean) => void;
  moveToTrash: () => void;
  loadMoreItems: () => void;
  hasMoreItems: boolean;
  isLoadingMore: boolean;
  isSmallScreen?: boolean;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface DrivePageState {
  selectedCount: number;
  selectedItems: SelectedItem[];
  isGridView: boolean;
  sortBy: "created" | "name" | "size" | "modified";
  sortOrder: "asc" | "desc";
  showModal: boolean;
  modalMode: "new" | "edit";
  inputValue: string;
  isDraggingOver: boolean;
  isExternalDrag: boolean;
  showToast: boolean;
  toastMessage: ToastMessage;
  isProcessing: boolean;
  showTransferHandler: boolean;
  isMoveFolderModalOpen: boolean;
  showPreview: boolean;
  currentIndex: number;
  currentPreviewItem: DriveItem | null;
  showDetailsModal: boolean;
  selectedItemId: string | null;
  showingEmpty: boolean;
  isSmallScreen: boolean;
}

type DrivePageAction =
  | { type: "SET_SELECTION"; count: number; items: SelectedItem[] }
  | { type: "SET_VIEW_MODE"; isGrid: boolean }
  | {
      type: "SET_SORT";
      sortBy: "created" | "name" | "size" | "modified";
      sortOrder?: "asc" | "desc";
    }
  | {
      type: "SET_MODAL";
      show: boolean;
      mode?: "new" | "edit";
      inputValue?: string;
    }
  | { type: "SET_DRAG_STATE"; isDragging: boolean; isExternal: boolean }
  | { type: "SET_TOAST"; show: boolean; message?: ToastMessage }
  | { type: "SET_PROCESSING"; isProcessing: boolean }
  | { type: "SET_TRANSFER_HANDLER"; show: boolean }
  | { type: "SET_MOVE_FOLDER_MODAL"; show: boolean }
  | {
      type: "SET_PREVIEW";
      show: boolean;
      item?: DriveItem | null;
      index?: number;
    }
  | { type: "SET_DETAILS_MODAL"; show: boolean }
  | { type: "SET_SELECTED_ITEM_ID"; id: string | null }
  | { type: "SET_SHOWING_EMPTY"; showing: boolean }
  | { type: "SET_SMALL_SCREEN"; isSmall: boolean };

// Memoized utility functions
const formatBytes = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

const getTruncatedName = (filename: string, threshold = 15): string => {
  if (filename.length <= threshold) return filename;

  const dotIndex = filename.lastIndexOf(".");

  if (dotIndex === -1 || dotIndex < 3) {
    return filename.substring(0, threshold - 3) + "...";
  }

  const base = filename.substring(0, dotIndex);
  const ext = filename.substring(dotIndex);
  const maxBaseLength = threshold - ext.length - 3;

  if (maxBaseLength <= 3) {
    return base.substring(0, 2) + "..." + ext;
  }

  if (base.length > maxBaseLength) {
    const frontChars = Math.ceil(maxBaseLength / 2);
    const endChars = Math.floor(maxBaseLength / 2);

    if (endChars <= 0) {
      return base.substring(0, frontChars) + "..." + ext;
    }

    return (
      base.substring(0, frontChars) +
      "..." +
      base.substring(base.length - endChars) +
      ext
    );
  }

  return filename;
};

// Cache for truncated names to avoid recalculation
const truncateCache = new Map<string, string>();

const getCachedTruncatedName = (filename: string, threshold = 15): string => {
  const cacheKey = `${filename}-${threshold}`;
  if (truncateCache.has(cacheKey)) {
    return truncateCache.get(cacheKey)!;
  }

  const result = getTruncatedName(filename, threshold);
  truncateCache.set(cacheKey, result);
  return result;
};

const GridItem: FC<ItemProps> = memo(
  ({
    item,
    onSelect,
    selected,
    onClick,
    downloadItem,
    moveToTrash,
    setIsMoveFolderModalOpen,
    renameItem,
    setShowPreview,
    setShowDetailsModal,
    tooltipPortal,
  }) => {
    const [showActionTooltip, setShowActionTooltip] = useState(false);
    const [showTooltip, setShowTooltip] = useState(false);
    const TRUNCATE_THRESHOLD = 15;
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
      x: 0,
      y: 0,
      isLeft: false,
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const truncatedName = useMemo(
      () => getCachedTruncatedName(item.name, TRUNCATE_THRESHOLD),
      [item.name],
    );
    const shouldShowTooltip = truncatedName !== item.name;
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handlePreview = useCallback(() => {
      setShowPreview(true);
    }, [setShowPreview]);

    useEffect(() => {
      if (!showActionTooltip) return;

      const updateTooltipPosition = () => {
        if (buttonRef.current && showActionTooltip) {
          const rect = buttonRef.current.getBoundingClientRect();
          const spaceOnRight = window.innerWidth - rect.right;
          const tooltipWidth = 200;

          setTooltipPosition({
            x: rect.right,
            y: rect.top,
            isLeft: spaceOnRight < tooltipWidth + 20,
          });
        }
      };

      const scrollableParent = containerRef.current
        ? containerRef.current.closest(".overflow-y-auto")
        : null;

      if (scrollableParent) {
        scrollableParent.addEventListener("scroll", updateTooltipPosition, {
          passive: true,
        });
        return () => {
          scrollableParent.removeEventListener("scroll", updateTooltipPosition);
        };
      }
    }, [showActionTooltip]);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick(e);
      },
      [onClick],
    );

    const handleSelect = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(item.id);
      },
      [item.id, onSelect],
    );

    const handleDownload = useCallback(() => {
      setShowActionTooltip(false);
      downloadItem(item.id);
    }, [downloadItem, item.id]);

    const handleMoveToFolder = useCallback(() => {
      setShowActionTooltip(false);
      setIsMoveFolderModalOpen(true);
    }, [setIsMoveFolderModalOpen]);

    const handleRename = useCallback(() => {
      setShowActionTooltip(false);
      renameItem(item.id);
    }, [item.id, renameItem]);

    const handleDetails = useCallback(() => {
      setShowActionTooltip(false);
      setShowDetailsModal(true);
    }, [setShowDetailsModal]);

    const handleMoveToTrash = useCallback(() => {
      setShowActionTooltip(false);
      moveToTrash();
    }, [moveToTrash]);

    const handleShowTooltip = useCallback(() => {
      if (shouldShowTooltip) setShowTooltip(true);
    }, [shouldShowTooltip]);

    const handleHideTooltip = useCallback(() => {
      if (shouldShowTooltip) setShowTooltip(false);
    }, [shouldShowTooltip]);

    const handleMoreClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const spaceOnRight = window.innerWidth - rect.right;
          const tooltipWidth = 200;

          onSelect(item.id, true);

          requestAnimationFrame(() => {
            setTooltipPosition({
              x: rect.right,
              y: rect.top,
              isLeft: spaceOnRight < tooltipWidth + 20,
            });
            setShowActionTooltip((prev) => !prev);
          });
        }
      },
      [item.id, onSelect],
    );

    const renderActionTooltip = () => {
      if (!showActionTooltip) return null;

      const tooltipContent = (
        <ActionTooltip
          isOpen={showActionTooltip}
          setIsOpen={setShowActionTooltip}
          position={{
            x: tooltipPosition.x,
            y: tooltipPosition.y,
            isLeft: tooltipPosition.isLeft,
          }}
          selected={() => selected && onSelect(item.id)}
          buttonRef={buttonRef}
        >
          {item.type === "file" && (
            <TooltipItem icon={Eye} label="Preview" onClick={handlePreview} />
          )}
          <TooltipItem
            icon={Download}
            label="Download"
            onClick={handleDownload}
          />
          <TooltipItem
            icon={FolderPlus}
            label="Move to folder"
            onClick={handleMoveToFolder}
          />
          <TooltipItem icon={Edit} label="Rename" onClick={handleRename} />
          <TooltipItem icon={Info} label="Details" onClick={handleDetails} />
          <TooltipItem
            icon={Trash}
            label="Move to trash"
            onClick={handleMoveToTrash}
          />
        </ActionTooltip>
      );

      return tooltipPortal && showActionTooltip
        ? createPortal(tooltipContent, tooltipPortal)
        : tooltipContent;
    };

    const renderNameTooltip = () => {
      if (!shouldShowTooltip || !showTooltip) return null;

      const getTooltipPosition = () => {
        if (!containerRef.current)
          return { top: 0, left: 0, position: "bottom", tooltipWidth: 200 };

        const rect = containerRef.current.getBoundingClientRect();

        // Calculate dynamic width based on text length
        const charWidth = 7; // approximate width per character in pixels
        const minWidth = 120; // minimum tooltip width
        const maxWidth = 280; // maximum tooltip width
        const textLength = item.name.length;
        const calculatedWidth = Math.min(
          Math.max(textLength * charWidth, minWidth),
          maxWidth,
        );

        const tooltipWidth = calculatedWidth;
        const tooltipHeight = 70;
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const margin = 10;

        let left = rect.left + rect.width / 2;
        left = Math.min(
          Math.max(tooltipWidth / 2 + margin, left),
          windowWidth - tooltipWidth / 2 - margin,
        );

        let top, position;

        const verticalGap = 2;

        if (
          rect.bottom + tooltipHeight + verticalGap <=
          windowHeight - margin
        ) {
          top = rect.bottom + verticalGap;
          position = "bottom";
        } else {
          top = rect.top - verticalGap - tooltipHeight;
          position = "top";
        }

        return { top, left, position, tooltipWidth };
      };

      const { top, left, position, tooltipWidth } = getTooltipPosition();

      const getArrowStyles = () => {
        if (position === "bottom") {
          return {
            arrowTop: "-4px",
            arrowBottom: "auto",
          };
        } else {
          return {
            arrowTop: "auto",
            arrowBottom: "-4px",
          };
        }
      };

      const arrowStyles = getArrowStyles();

      const nameTooltipContent = (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            position: "fixed",
            top: `${top}px`,
            left: `${left}px`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="relative flex flex-col items-center">
            <div
              className="absolute w-2 h-2 bg-gray-900 dark:bg-gray-100 z-10"
              style={{
                top: arrowStyles.arrowTop,
                bottom: arrowStyles.arrowBottom,
                left: "50%",
                transform: "translateX(-50%) rotate(45deg)",
              }}
            />

            <div
              className="relative px-3 py-1.5 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-md shadow-lg"
              style={{ width: `${tooltipWidth}px` }}
            >
              <span className="block whitespace-normal break-words line-clamp-3 text-center">
                {item.name}
              </span>
            </div>
          </div>
        </div>
      );

      return createPortal(nameTooltipContent, document.body);
    };

    return (
      <div ref={containerRef}>
        <div
          onClick={handleClick}
          className={`group aspect-[3/2] relative cursor-pointer rounded-lg border transition-colors duration-300
        ${
          selected
            ? "border-[1px] border-emerald-500 dark:border-emerald-400 bg-[#e6e6e6] dark:bg-[#343140]/90"
            : "border-[1px] border-gray-200 dark:border-[#2c2934]"
        }
        hover:bg-gray-50 dark:hover:bg-[#2c2934]`}
        >
          <div
            className={`absolute top-2 left-2 ${selected ? "" : "opacity-0 group-hover:opacity-100"}`}
            onClick={handleSelect}
          >
            <div className="relative">
              <CustomCheckBox checked={selected} />
            </div>
          </div>

          <div
            className={`flex justify-center items-center h-full border-b ${
              selected
                ? "border-emerald-500 dark:border-emerald-400"
                : "border-gray-200 dark:border-[#2c2934] group-hover:border-gray-300 group-hover:dark:border-[#4a4658]"
            }`}
          >
            {item.type === "folder" ? (
              <FolderIcon className="w-14 h-14 text-yellow-500" />
            ) : (
              <FileIcon
                filename={item.name}
                url={item?.thumbnailUrl}
                size="large"
              />
            )}
          </div>

          <div className="p-2 flex items-center relative">
            <span
              onMouseEnter={handleShowTooltip}
              onMouseLeave={handleHideTooltip}
              className="text-sm text-gray-700 dark:text-gray-300 text-center truncate w-full font-medium"
            >
              {truncatedName}
            </span>

            <div className="absolute right-2">
              <button
                ref={buttonRef}
                onClick={handleMoreClick}
                className={`p-1 rounded-md transition-all duration-150 cursor-pointer ${
                  selected
                    ? "bg-gray-100 dark:bg-[#4a4658]"
                    : "opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-[#4a4658]"
                }`}
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {renderActionTooltip()}
            </div>

            {renderNameTooltip()}
          </div>
        </div>
      </div>
    );
  },
);

const ListItem: FC<ItemProps> = memo(
  ({
    item,
    onSelect,
    selected,
    onClick,
    downloadItem,
    moveToTrash,
    setIsMoveFolderModalOpen,
    renameItem,
    setShowPreview,
    setShowDetailsModal,
    tooltipPortal,
    isSmallScreen = false,
  }) => {
    const [showActionTooltip, setShowActionTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
      x: 0,
      y: 0,
      isLeft: false,
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      if (!showActionTooltip) return;

      const updateTooltipPosition = () => {
        if (buttonRef.current && showActionTooltip) {
          const rect = buttonRef.current.getBoundingClientRect();
          const spaceOnRight = window.innerWidth - rect.right;
          const tooltipWidth = 200;

          setTooltipPosition({
            x: rect.right,
            y: rect.top,
            isLeft: spaceOnRight < tooltipWidth + 20,
          });
        }
      };

      const scrollableParent = containerRef.current
        ? containerRef.current.closest(".overflow-y-auto")
        : null;

      if (scrollableParent) {
        scrollableParent.addEventListener("scroll", updateTooltipPosition, {
          passive: true,
        });
        return () => {
          scrollableParent.removeEventListener("scroll", updateTooltipPosition);
        };
      }
    }, [showActionTooltip]);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onClick(e);
      },
      [onClick],
    );

    const handleSelect = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(item.id);
      },
      [item.id, onSelect],
    );

    const handlePreview = useCallback(() => {
      setShowPreview(true);
    }, [setShowPreview]);

    const handleDownload = useCallback(() => {
      setShowActionTooltip(false);
      downloadItem(item.id);
    }, [downloadItem, item.id]);

    const handleMoveToFolder = useCallback(() => {
      setShowActionTooltip(false);
      setIsMoveFolderModalOpen(true);
    }, [setIsMoveFolderModalOpen]);

    const handleRename = useCallback(() => {
      setShowActionTooltip(false);
      renameItem(item.id);
    }, [item.id, renameItem]);

    const handleDetails = useCallback(() => {
      setShowActionTooltip(false);
      setShowDetailsModal(true);
    }, [setShowDetailsModal]);

    const handleMoveToTrash = useCallback(() => {
      setShowActionTooltip(false);
      moveToTrash();
    }, [moveToTrash]);

    const handleMoreClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          const spaceOnRight = window.innerWidth - rect.right;
          const tooltipWidth = 200;

          onSelect(item.id, true);

          requestAnimationFrame(() => {
            setTooltipPosition({
              x: rect.right,
              y: rect.top,
              isLeft: spaceOnRight < tooltipWidth + 20,
            });
            setShowActionTooltip((prev) => !prev);
          });
        }
      },
      [item.id, onSelect],
    );

    const renderActionTooltip = () => {
      if (!showActionTooltip) return null;

      const tooltipContent = (
        <ActionTooltip
          isOpen={showActionTooltip}
          setIsOpen={setShowActionTooltip}
          position={{
            x: tooltipPosition.x,
            y: tooltipPosition.y,
            isLeft: tooltipPosition.isLeft,
          }}
          selected={() => selected && onSelect(item.id)}
          buttonRef={buttonRef}
        >
          {item.type === "file" && (
            <TooltipItem icon={Eye} label="Preview" onClick={handlePreview} />
          )}
          <TooltipItem
            icon={Download}
            label="Download"
            onClick={handleDownload}
          />
          <TooltipItem
            icon={FolderPlus}
            label="Move to folder"
            onClick={handleMoveToFolder}
          />
          <TooltipItem icon={Edit} label="Rename" onClick={handleRename} />
          <TooltipItem icon={Info} label="Details" onClick={handleDetails} />
          <TooltipItem
            icon={Trash}
            label="Move to trash"
            onClick={handleMoveToTrash}
          />
        </ActionTooltip>
      );

      return tooltipPortal && showActionTooltip
        ? createPortal(tooltipContent, tooltipPortal)
        : tooltipContent;
    };

    const formattedDate = useMemo(() => {
      return new Date(item.modifiedAt * 1000)
        .toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(",", " at");
    }, [item.modifiedAt]);

    return (
      <div
        ref={containerRef}
        onClick={handleClick}
        className={`group h-14 cursor-pointer border-b border-slate-400/20 dark:border-[#343140] transition-colors duration-300
          ${selected ? "bg-[#e6e6e6] dark:bg-[#343140]/90" : ""}
          hover:bg-gray-50 dark:hover:bg-[#2c2934]`}
      >
        <div className="grid grid-cols-12 h-full items-center px-4">
          <div className="col-span-5 flex items-center">
            <div className="flex-shrink-0 mr-3" onClick={handleSelect}>
              <div
                className={`${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                <CustomCheckBox checked={selected} />
              </div>
            </div>

            <span className="mr-2 flex-shrink-0">
              {item.type === "folder" ? (
                <FolderIcon className="w-6 h-6 text-yellow-500 rounded" />
              ) : (
                <FileIcon
                  thumbnailUrl={item.thumbnailUrl}
                  filename={item.name}
                  size="small"
                />
              )}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-[500]">
              {item.name}
            </span>
          </div>

          <div className="col-span-3 pl-4">
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
              {formatBytes(item.size)}
            </span>
          </div>

          {!isSmallScreen && (
            <>
              <div className="col-span-2 pl-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
                  {formattedDate}
                </span>
              </div>

              <div className="col-span-1 flex justify-center">
                {item.isShared ? (
                  <Users className="w-4 h-4 text-sm text-gray-500 dark:text-gray-400 truncate block" />
                ) : (
                  <Lock className="w-4 h-4 text-sm text-gray-500 dark:text-gray-400 truncate block" />
                )}
              </div>
            </>
          )}

          <div className="col-span-1 flex justify-end">
            <button
              ref={buttonRef}
              onClick={handleMoreClick}
              className={`p-1.5 rounded-md transition-all duration-150 cursor-pointer ${
                selected
                  ? "bg-gray-100 dark:bg-[#4a4658]"
                  : "opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-[#4a4658]"
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            {renderActionTooltip()}
          </div>
        </div>
      </div>
    );
  },
);

// OPTIMIZED GRID VIEW
const VirtualizedGridView: React.FC<VirtualizedViewProps> = memo(
  ({
    items,
    onSelect,
    handleFolderClick,
    handleDownload,
    handleEdit,
    setIsMoveFolderModalOpen,
    user,
    setShowPreview,
    setShowDetailsModal,
    moveToTrash,
    loadMoreItems,
    hasMoreItems,
    isLoadingMore,
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const isResizing = useRef<boolean>(false);
    const [columnCount, setColumnCount] = useState(4);
    const [gapReduction, setGapReduction] = useState(0);
    const [itemSize, setItemSize] = useState(220);
    const [tooltipPortalNode, setTooltipPortalNode] =
      useState<HTMLDivElement | null>(null);
    const loadingStateRef = useRef({ hasMoreItems, isLoadingMore });
    const [isPending, startTransition] = useTransition();
    const scrollPositionRef = useRef(0);
    const scrollPercentageRef = useRef(0);
    const layoutUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      loadingStateRef.current = { hasMoreItems, isLoadingMore };
    }, [hasMoreItems, isLoadingMore]);

    useEffect(() => {
      const tooltipContainer = document.createElement("div");
      tooltipContainer.className = "tooltip-container";
      tooltipContainer.style.position = "absolute";
      tooltipContainer.style.top = "0";
      tooltipContainer.style.left = "0";
      tooltipContainer.style.width = "100%";
      tooltipContainer.style.height = "100%";
      tooltipContainer.style.pointerEvents = "none";
      tooltipContainer.style.zIndex = "9999";
      document.body.appendChild(tooltipContainer);

      setTooltipPortalNode(tooltipContainer);

      return () => {
        if (document.body.contains(tooltipContainer)) {
          document.body.removeChild(tooltipContainer);
        }
      };
    }, []);

    const rowVirtualizer = useVirtualizer({
      count: Math.ceil(items.length / columnCount),
      getScrollElement: () => parentRef.current,
      estimateSize: (index) =>
        index === 0 ? itemSize : itemSize - gapReduction,
      overscan: 10,
      measureElement: undefined, // Disable element measurement for grid items for better performance
    });

    const updateLayout = useCallback(() => {
      if (!parentRef.current) return;

      // Clear any pending timeout
      if (layoutUpdateTimeoutRef.current) {
        clearTimeout(layoutUpdateTimeoutRef.current);
        layoutUpdateTimeoutRef.current = null;
      }

      const container = parentRef.current;
      if (!container) return;

      // Save current scroll position before updates
      const saveScrollPosition = () => {
        if (container.scrollHeight > 0) {
          scrollPositionRef.current = container.scrollTop;
          scrollPercentageRef.current =
            container.scrollTop / container.scrollHeight;
        }
      };

      saveScrollPosition();

      // Temporarily disconnect observer to prevent loops
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }

      // Calculate new layout values
      const calculateLayout = () => {
        const containerWidth = container.clientWidth || 0;
        const gapSize = 4; // Reduced gap size

        let newColumnCount;
        if (containerWidth <= 640) newColumnCount = 2;
        else if (containerWidth <= 768) newColumnCount = 3;
        else if (containerWidth <= 1024) newColumnCount = 4;
        else if (containerWidth <= 1280) newColumnCount = 5;
        else if (containerWidth <= 1536) newColumnCount = 6;
        else if (containerWidth <= 1920) newColumnCount = 7;
        else if (containerWidth <= 2560) newColumnCount = 9;
        else {
          newColumnCount = Math.floor(containerWidth / 300);
          newColumnCount = Math.max(9, Math.min(12, newColumnCount));
        }

        const availableWidth = containerWidth - gapSize * (newColumnCount - 1);
        const itemWidth = Math.floor(availableWidth / newColumnCount);
        const newItemHeight = itemWidth;
        const newGapReduction = 12; // Consistent small gap reduction

        return {
          newColumnCount,
          newItemHeight,
          newGapReduction,
          hasChanged:
            newColumnCount !== columnCount ||
            newItemHeight !== itemSize ||
            newGapReduction !== gapReduction,
        };
      };

      const { newColumnCount, newItemHeight, newGapReduction, hasChanged } =
        calculateLayout();

      // Skip update if nothing changed
      if (!hasChanged) {
        // Reconnect observer and exit
        if (resizeObserverRef.current && container) {
          resizeObserverRef.current.observe(container);
        }
        return;
      }

      // Use a longer timeout to prevent loop warnings
      layoutUpdateTimeoutRef.current = setTimeout(() => {
        // Use startTransition to avoid blocking UI during state updates
        startTransition(() => {
          setColumnCount(newColumnCount);
          setItemSize(newItemHeight);
          setGapReduction(newGapReduction);
        });

        // Use nested timeouts to ensure DOM has updated before measuring
        setTimeout(() => {
          requestAnimationFrame(() => {
            // Measure after state updates are applied
            if (rowVirtualizer) {
              rowVirtualizer.measure();
            }

            // Restore scroll position in another animation frame
            requestAnimationFrame(() => {
              if (container && container.scrollHeight > 0) {
                container.scrollTop =
                  scrollPercentageRef.current * container.scrollHeight;
              }

              // Reconnect observer after all updates are complete
              if (resizeObserverRef.current && container) {
                resizeObserverRef.current.observe(container);
              }
            });
          });
        }, 10); // Additional delay after state updates

        layoutUpdateTimeoutRef.current = null;
      }, 10); // Increased timeout to prevent warnings
    }, [columnCount, itemSize, gapReduction, rowVirtualizer]);

    // Setup resize observer with reference
    useEffect(() => {
      const container = parentRef.current;
      if (!container) return;

      // Create and store the observer instance
      const resizeObserver = new ResizeObserver(
        debounce(
          () => {
            if (!isResizing.current) {
              isResizing.current = true;
              updateLayout();
              // Reset flag after a delay
              setTimeout(() => {
                isResizing.current = false;
              }, 100);
            }
          },
          100,
          { leading: true, trailing: true },
        ),
      );

      // Store reference for cleanup and disconnecting
      resizeObserverRef.current = resizeObserver;

      // Start observing
      resizeObserver.observe(container);

      // Clean up
      return () => {
        if (layoutUpdateTimeoutRef.current) {
          clearTimeout(layoutUpdateTimeoutRef.current);
        }
        resizeObserver.disconnect();
        resizeObserverRef.current = null;
      };
    }, [updateLayout]);

    const handleScroll = useCallback(() => {
      const { hasMoreItems, isLoadingMore } = loadingStateRef.current;
      if (!hasMoreItems || isLoadingMore || !parentRef.current) return;

      const container = parentRef.current;
      const scrollBottom = container.scrollTop + container.clientHeight;
      const scrollPercentage = scrollBottom / container.scrollHeight;

      if (scrollPercentage > 0.8) {
        loadMoreItems();
      }
    }, [loadMoreItems]);

    useEffect(() => {
      const container = parentRef.current;
      if (container) {
        // Use throttled version of scroll handler to avoid too many calls
        const throttledScroll = throttle(handleScroll, 150);
        container.addEventListener("scroll", throttledScroll, {
          passive: true,
        });
        return () => container.removeEventListener("scroll", throttledScroll);
      }
    }, [handleScroll]);

    return (
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto p-4 w-full h-full"
        style={{
          overflowX: "hidden",
          scrollbarWidth: "thin",
          msOverflowStyle: "-ms-autohiding-scrollbar",
        }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowStartIndex = virtualRow.index * columnCount;
            const rowItems = items.slice(
              rowStartIndex,
              rowStartIndex + columnCount,
            );

            return (
              <div
                key={virtualRow.index}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  display: "grid",
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  gap: "0.75rem",
                  marginTop:
                    virtualRow.index === 0 ? "0" : `-${gapReduction}px`,
                  willChange: "transform", // Performance optimization
                }}
                className="grid-row"
              >
                {rowItems.map((item) => (
                  <GridItem
                    key={item.id}
                    item={item}
                    selected={item.selected ?? false}
                    onSelect={onSelect}
                    onClick={(e) =>
                      item.type === "folder"
                        ? handleFolderClick(e, item)
                        : undefined
                    }
                    downloadItem={handleDownload}
                    renameItem={handleEdit}
                    setIsMoveFolderModalOpen={setIsMoveFolderModalOpen}
                    moveToTrash={moveToTrash}
                    user={user}
                    setShowPreview={setShowPreview}
                    setShowDetailsModal={setShowDetailsModal}
                    tooltipPortal={tooltipPortalNode}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {isLoadingMore && (
          <div className="flex justify-center p-4 w-full">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  },
);

// OPTIMIZED LIST VIEW
const VirtualizedListView: React.FC<VirtualizedViewProps> = memo(
  ({
    items,
    onSelect,
    handleFolderClick,
    handleDownload,
    handleEdit,
    setIsMoveFolderModalOpen,
    user,
    setShowPreview,
    setShowDetailsModal,
    moveToTrash,
    loadMoreItems,
    hasMoreItems,
    isLoadingMore,
    isSmallScreen = false,
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [tooltipPortalNode, setTooltipPortalNode] =
      useState<HTMLDivElement | null>(null);
    const loadingStateRef = useRef({ hasMoreItems, isLoadingMore });
    const scrollPositionRef = useRef(0);
    const scrollPercentageRef = useRef(0);
    const [isPending, startTransition] = useTransition();
    const measureTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      loadingStateRef.current = { hasMoreItems, isLoadingMore };
    }, [hasMoreItems, isLoadingMore]);

    useEffect(() => {
      const tooltipContainer = document.createElement("div");
      tooltipContainer.className = "tooltip-container-list";
      tooltipContainer.style.position = "absolute";
      tooltipContainer.style.top = "0";
      tooltipContainer.style.left = "0";
      tooltipContainer.style.width = "100%";
      tooltipContainer.style.height = "100%";
      tooltipContainer.style.pointerEvents = "none";
      tooltipContainer.style.zIndex = "9999";
      document.body.appendChild(tooltipContainer);

      setTooltipPortalNode(tooltipContainer);

      return () => {
        if (document.body.contains(tooltipContainer)) {
          document.body.removeChild(tooltipContainer);
        }
      };
    }, []);

    const virtualizer = useVirtualizer({
      count: items.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 56, // Fixed estimated height
      overscan: 10,
      // Only measure when absolutely necessary - this reduces layout thrashing
      measureElement: (element) => {
        return element.getBoundingClientRect().height;
      },
    });

    // Save scroll position on scroll for restoration after resizing
    useEffect(() => {
      const container = parentRef.current;
      if (!container) return;

      const saveScrollPosition = () => {
        if (container.scrollHeight > 0) {
          scrollPositionRef.current = container.scrollTop;
          scrollPercentageRef.current =
            container.scrollTop / container.scrollHeight;
        }
      };

      saveScrollPosition();
      container.addEventListener("scroll", saveScrollPosition, {
        passive: true,
      });

      return () => {
        container.removeEventListener("scroll", saveScrollPosition);
      };
    }, []);

    // Handle resize with proper scroll position restoration
    useEffect(() => {
      if (!parentRef.current || !virtualizer) return;

      const container = parentRef.current;

      const handleResize = () => {
        if (measureTimeoutRef.current) {
          clearTimeout(measureTimeoutRef.current);
        }

        // Save current scroll position before resize
        const oldScrollPercent = scrollPercentageRef.current;

        // Defer measurement to prevent layout thrashing
        measureTimeoutRef.current = setTimeout(() => {
          // Use requestAnimationFrame to ensure the DOM has updated
          requestAnimationFrame(() => {
            startTransition(() => {
              virtualizer.measure();
            });

            // Restore scroll position after layout is complete
            requestAnimationFrame(() => {
              if (container.scrollHeight > 0) {
                container.scrollTop = oldScrollPercent * container.scrollHeight;
              }
            });
          });
          measureTimeoutRef.current = null;
        }, 10);
      };

      // Debounce resize handler to minimize performance impact
      const debouncedResize = debounce(handleResize, 100, {
        leading: true,
        trailing: true,
      });

      window.addEventListener("resize", debouncedResize);
      const resizeObserver = new ResizeObserver(debouncedResize);
      resizeObserver.observe(container);

      return () => {
        if (measureTimeoutRef.current) {
          clearTimeout(measureTimeoutRef.current);
        }
        window.removeEventListener("resize", debouncedResize);
        resizeObserver.unobserve(container);
      };
    }, [virtualizer]);

    // Optimized scroll handler with throttling
    const handleScroll = useCallback(() => {
      const { hasMoreItems, isLoadingMore } = loadingStateRef.current;
      if (!hasMoreItems || isLoadingMore || !parentRef.current) return;

      const scrollElement = parentRef.current;
      const scrollBottom = scrollElement.scrollTop + scrollElement.clientHeight;
      const scrollPercentage = scrollBottom / scrollElement.scrollHeight;

      if (scrollPercentage > 0.75) {
        loadMoreItems();
      }
    }, [loadMoreItems]);

    useEffect(() => {
      const scrollElement = parentRef.current;
      if (scrollElement) {
        // Throttle scroll events to reduce performance impact
        const throttledScroll = throttle(handleScroll, 150);
        scrollElement.addEventListener("scroll", throttledScroll, {
          passive: true,
        });
        return () =>
          scrollElement.removeEventListener("scroll", throttledScroll);
      }
    }, [handleScroll]);

    // Re-measure when items change
    useEffect(() => {
      if (measureTimeoutRef.current) {
        clearTimeout(measureTimeoutRef.current);
      }

      if (virtualizer && items.length > 0) {
        measureTimeoutRef.current = setTimeout(() => {
          virtualizer.measure();
          measureTimeoutRef.current = null;
        }, 0);
      }

      return () => {
        if (measureTimeoutRef.current) {
          clearTimeout(measureTimeoutRef.current);
        }
      };
    }, [items.length, virtualizer]);

    return (
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto w-full h-full pb-5"
        style={{
          overflowX: "hidden",
          scrollbarWidth: "thin",
          msOverflowStyle: "-ms-autohiding-scrollbar",
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
            paddingBottom: "60px",
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            if (!item) return null;

            return (
              <div
                key={virtualItem.index}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                  willChange: "transform", // Performance optimization
                }}
              >
                <ListItem
                  key={item.id}
                  item={item}
                  selected={item.selected ?? false}
                  onSelect={onSelect}
                  onClick={(e) =>
                    item.type === "folder"
                      ? handleFolderClick(e, item)
                      : undefined
                  }
                  downloadItem={handleDownload}
                  renameItem={handleEdit}
                  setIsMoveFolderModalOpen={setIsMoveFolderModalOpen}
                  moveToTrash={moveToTrash}
                  user={user}
                  setShowPreview={setShowPreview}
                  setShowDetailsModal={setShowDetailsModal}
                  tooltipPortal={tooltipPortalNode}
                  isSmallScreen={isSmallScreen}
                />
              </div>
            );
          })}
        </div>

        {isLoadingMore && (
          <div className="flex justify-center p-4 w-full">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  },
);

// Utility functions required by the components
const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number,
  options = { leading: false, trailing: true },
): ((...args: Parameters<F>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined = undefined;

  return function (this: any, ...args: Parameters<F>) {
    const context = this;

    const execute = () => {
      func.apply(context, args);
      timeoutId = undefined;
    };

    const shouldCallLeading = options.leading && timeoutId === undefined;

    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }

    if (shouldCallLeading) {
      execute();
    }

    if (options.trailing) {
      timeoutId = setTimeout(execute, waitFor);
    }
  };
};

const throttle = <F extends (...args: any[]) => any>(
  func: F,
  limit: number,
): ((...args: Parameters<F>) => void) => {
  let inThrottle = false;

  return function (this: any, ...args: Parameters<F>) {
    const context = this;

    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
};

const LoadingSkeleton: React.FC<{
  isGridView: boolean;
  isSmallScreen: boolean;
}> = memo(({ isGridView, isSmallScreen }) => {
  return isGridView ? (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4">
      {Array.from({ length: 24 }).map((_, index) => (
        <div
          key={index}
          className="aspect-[3/2] border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden animate-pulse"
        >
          <div className="h-[70%] bg-[#e6e6e6] dark:bg-[#343140]/90 flex items-center justify-center">
            <div className="w-14 h-14 rounded-md bg-[#d1d1d1] dark:bg-[#4a4658]"></div>
          </div>

          <div className="p-2 flex items-center justify-between">
            <div className="h-4 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded w-2/3"></div>
            <div className="w-6 h-6 rounded-full bg-[#e6e6e6] dark:bg-[#343140]/90"></div>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="flex flex-col">
      {Array.from({ length: 20 }).map((_, index) => (
        <div
          key={index}
          className="h-14 border-b border-gray-200 dark:border-gray-800 animate-pulse"
        >
          <div className="grid grid-cols-12 h-full items-center px-4 gap-1">
            <div className="col-span-5 flex items-center">
              <div className="w-4 h-4 mr-3 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded" />
              <div className="w-6 h-6 mr-2 flex-shrink-0 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded" />
              <div className="h-4 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded w-3/4" />
            </div>

            <div className="col-span-3">
              <div className="h-4 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded w-full" />
            </div>

            {!isSmallScreen && (
              <div className="col-span-2">
                <div className="h-4 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded w-full" />
              </div>
            )}

            <div className="col-span-1 text-right">
              <div className="h-4 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded ml-auto w-3/4" />
            </div>

            <div className="col-span-1 flex justify-end">
              <div className="w-6 h-6 bg-[#e6e6e6] dark:bg-[#343140]/90 rounded-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
});

const PathNavigator: React.FC<{
  breadcrumbs: BreadcrumbItem[];
  isLoading: boolean;
  navigateTo: (id: string) => void;
}> = memo(({ breadcrumbs, isLoading, navigateTo }) => {
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [hoverTooltip, setHoverTooltip] = useState<{
    name: string;
    position: { top: number; left: number };
  } | null>(null);
  const ellipsisRef = useRef<HTMLButtonElement>(null);
  const ellipsisMenuRef = useRef<HTMLDivElement>(null);

  // Get visible breadcrumbs based on available space
  const getVisibleBreadcrumbs = useCallback(() => {
    if (breadcrumbs.length <= 3) {
      return breadcrumbs;
    }

    return [
      breadcrumbs[0],
      { id: "ellipsis", name: "..." },
      breadcrumbs[breadcrumbs.length - 1],
    ];
  }, [breadcrumbs]);

  // Get hidden breadcrumbs to show in ellipsis menu
  const getHiddenBreadcrumbs = useCallback(() => {
    if (breadcrumbs.length <= 3) return [];
    return breadcrumbs.slice(1, breadcrumbs.length - 1);
  }, [breadcrumbs]);

  // Calculate max length based on screen size
  const getMaxLength = useCallback(() => {
    if (window.innerWidth < 640) return 10; // Small screens
    if (window.innerWidth < 1024) return 15; // Medium screens
    return 20; // Large screens
  }, []);

  // Truncate text by word count and character length
  const truncateText = useCallback(
    (text: string, maxWords = 10, maxChars = getMaxLength()) => {
      if (text === "...") return text;

      // Split by words and limit count
      const words = text.split(" ");
      const limitedWords =
        words.length > maxWords ? words.slice(0, maxWords) : words;
      const joinedText = limitedWords.join(" ");

      // If still too long by characters, truncate further
      if (joinedText.length > maxChars) {
        return joinedText.slice(0, maxChars) + "...";
      }

      // Add ellipsis if we truncated words
      return words.length > maxWords ? joinedText + "..." : joinedText;
    },
    [getMaxLength],
  );

  // Handle direct navigation with id
  const handleNavigate = useCallback(
    (id: string, e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();

      // Close all menus and tooltips first
      setShowEllipsisMenu(false);
      setHoverTooltip(null);

      // Wait for state update to complete before navigating
      setTimeout(() => {
        navigateTo(id);
      }, 10);
    },
    [navigateTo],
  );

  // Handle ellipsis click
  const handleEllipsisClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowEllipsisMenu((prev) => !prev);
  }, []);

  // Handle showing tooltip on hover
  const handleShowTooltip = useCallback((name: string, e: React.MouseEvent) => {
    const element = e.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();

    setHoverTooltip({
      name,
      position: {
        top: rect.bottom,
        left: rect.left + rect.width / 2,
      },
    });
  }, []);

  // Close tooltip
  const handleHideTooltip = useCallback(() => {
    setHoverTooltip(null);
  }, []);

  // Close ellipsis menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showEllipsisMenu &&
        ellipsisRef.current &&
        ellipsisMenuRef.current &&
        !ellipsisRef.current.contains(e.target as Node) &&
        !ellipsisMenuRef.current.contains(e.target as Node)
      ) {
        setShowEllipsisMenu(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showEllipsisMenu]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowEllipsisMenu(false);
        setHoverTooltip(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  if (isLoading) {
    return (
      <div
        className="flex items-center h-6"
        aria-label="Loading breadcrumb navigation"
      >
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mr-2"></div>
        <span className="sr-only">Loading navigation</span>
      </div>
    );
  }

  const visibleBreadcrumbs = getVisibleBreadcrumbs();
  const hiddenBreadcrumbs = getHiddenBreadcrumbs();

  return (
    <nav
      aria-label="Breadcrumb navigation"
      className="flex items-center text-sm relative"
    >
      {visibleBreadcrumbs.map((folder, index) => {
        const isFirst = index === 0;
        const isLast = index === visibleBreadcrumbs.length - 1;
        const isEllipsis = folder.name === "...";

        // Determine if we need to show tooltip
        const fullText = folder.name;
        const displayText = isEllipsis ? "..." : truncateText(folder.name);
        const needsTooltip = !isEllipsis && fullText !== displayText;

        return (
          <React.Fragment key={folder.id}>
            {index > 0 && (
              <span
                className="text-gray-400 flex-shrink-0 mx-0.5"
                aria-hidden="true"
              >
                <ChevronRight className="w-4 h-4" />
              </span>
            )}

            {isEllipsis ? (
              <button
                ref={ellipsisRef}
                type="button"
                className="px-2 py-1 cursor-pointer flex-shrink-0 hover:bg-gray-100 dark:hover:bg-[#2c2934] rounded transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                onClick={handleEllipsisClick}
                aria-expanded={showEllipsisMenu}
                aria-haspopup="true"
                aria-label="Show hidden path items"
              >
                <span className="text-gray-500 dark:text-gray-400">...</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => handleNavigate(folder.id, e)}
                className={`px-2 py-1 hover:bg-gray-100 dark:hover:bg-[#2c2934] rounded transition-colors duration-150 text-gray-700 dark:text-gray-100 ${
                  (isFirst && breadcrumbs.length === 1) || isLast
                    ? "font-semibold"
                    : "font-normal"
                } min-w-[1rem] max-w-[5rem] sm:max-w-[8rem] md:max-w-[10rem] flex-shrink-0 relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400`}
                onMouseEnter={
                  needsTooltip
                    ? (e) => handleShowTooltip(fullText, e)
                    : undefined
                }
                onMouseLeave={needsTooltip ? handleHideTooltip : undefined}
                aria-current={isLast ? "location" : undefined}
              >
                <span className="truncate block">{displayText}</span>
              </button>
            )}
          </React.Fragment>
        );
      })}

      {/* Ellipsis dropdown menu */}
      {showEllipsisMenu &&
        ellipsisRef.current &&
        createPortal(
          <div
            ref={ellipsisMenuRef}
            className="fixed bg-white dark:bg-[#040405] rounded-lg shadow-lg border border-gray-200 dark:border-[#2c2934] z-50"
            style={{
              top: ellipsisRef.current.getBoundingClientRect().bottom + 5,
              left:
                ellipsisRef.current.getBoundingClientRect().left +
                ellipsisRef.current.offsetWidth / 2,
              transform: "translateX(-50%)",
              maxWidth: "240px",
              width: "100%",
              maxHeight: "70vh",
              overflowY: "auto",
            }}
            role="menu"
            aria-orientation="vertical"
          >
            <div className="divide-y divide-gray-200 dark:divide-[#2c2934]">
              {hiddenBreadcrumbs.map((folder) => (
                <button
                  key={folder.id}
                  className="w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2934] flex items-center transition-colors duration-150 cursor-pointer text-left focus:outline-none focus:bg-gray-50 dark:focus:bg-[#2c2934]"
                  onClick={(e) => handleNavigate(folder.id, e)}
                  role="menuitem"
                >
                  <span className="flex-1 truncate" title={folder.name}>
                    {truncateText(folder.name, 7, 30)}
                  </span>
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}

      {/* Hover tooltip */}
      {hoverTooltip &&
        createPortal(
          <div
            className="fixed bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-md shadow-lg px-3 py-1.5 z-50 pointer-events-none"
            style={{
              top: `${hoverTooltip.position.top + 5}px`,
              left: `${hoverTooltip.position.left}px`,
              transform: "translateX(-50%)",
              maxWidth: "240px",
            }}
            role="tooltip"
          >
            <div className="relative">
              <div className="absolute w-2 h-2 bg-gray-900 dark:bg-gray-100 transform rotate-45 -top-2 left-1/2 -translate-x-1/2" />
              <div className="text-sm text-center whitespace-normal break-words">
                {hoverTooltip.name}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </nav>
  );
});

const drivePageReducer = (
  state: DrivePageState,
  action: DrivePageAction,
): DrivePageState => {
  switch (action.type) {
    case "SET_SELECTION":
      return {
        ...state,
        selectedCount: action.count,
        selectedItems: action.items,
      };
    case "SET_VIEW_MODE":
      return { ...state, isGridView: action.isGrid };
    case "SET_SORT":
      return {
        ...state,
        sortBy: action.sortBy,
        sortOrder:
          action.sortOrder ||
          (state.sortBy === action.sortBy
            ? state.sortOrder === "asc"
              ? "desc"
              : "asc"
            : "asc"),
      };
    case "SET_MODAL":
      if (action.show === false) {
        // When closing modal, reset all modal-related state
        return {
          ...state,
          showModal: false,
          inputValue: "",
          isProcessing: false,
          selectedItemId: null,
        };
      } else {
        // When opening modal, set specific values
        return {
          ...state,
          showModal: true,
          modalMode: action.mode !== undefined ? action.mode : state.modalMode,
          inputValue:
            action.inputValue !== undefined
              ? action.inputValue
              : state.inputValue,
        };
      }
    case "SET_DRAG_STATE":
      return {
        ...state,
        isDraggingOver: action.isDragging,
        isExternalDrag: action.isExternal,
      };
    case "SET_TOAST":
      return {
        ...state,
        showToast: action.show,
        toastMessage: action.message || state.toastMessage,
      };
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.isProcessing };
    case "SET_TRANSFER_HANDLER":
      return { ...state, showTransferHandler: action.show };
    case "SET_MOVE_FOLDER_MODAL":
      return { ...state, isMoveFolderModalOpen: action.show };
    case "SET_PREVIEW":
      return {
        ...state,
        showPreview: action.show,
        currentPreviewItem:
          action.item !== undefined ? action.item : state.currentPreviewItem,
        currentIndex:
          action.index !== undefined ? action.index : state.currentIndex,
      };
    case "SET_DETAILS_MODAL":
      return { ...state, showDetailsModal: action.show };
    case "SET_SELECTED_ITEM_ID":
      return { ...state, selectedItemId: action.id };
    case "SET_SHOWING_EMPTY":
      return { ...state, showingEmpty: action.showing };
    case "SET_SMALL_SCREEN":
      return { ...state, isSmallScreen: action.isSmall };
    default:
      return state;
  }
};

const DrivePage: React.FC = () => {
  const [state, dispatch] = useReducer(drivePageReducer, {
    selectedCount: 0,
    selectedItems: [],
    isGridView: true,
    sortBy: "name",
    sortOrder: "asc",
    showModal: false,
    modalMode: "new",
    inputValue: "",
    isDraggingOver: false,
    isExternalDrag: false,
    showToast: false,
    toastMessage: { type: "success", text: "" },
    isProcessing: false,
    showTransferHandler: false,
    isMoveFolderModalOpen: false,
    showPreview: false,
    currentIndex: 0,
    currentPreviewItem: null,
    showDetailsModal: false,
    selectedItemId: null,
    showingEmpty: false,
    isSmallScreen: false,
  });

  const {
    selectedCount,
    selectedItems,
    isGridView,
    sortBy,
    sortOrder,
    showModal,
    modalMode,
    inputValue,
    isDraggingOver,
    isExternalDrag,
    showToast,
    toastMessage,
    isProcessing,
    showTransferHandler,
    isMoveFolderModalOpen,
    showPreview,
    currentIndex,
    currentPreviewItem,
    showDetailsModal,
    selectedItemId,
    showingEmpty,
    isSmallScreen,
  } = state;

  const [items, setItems] = useState<DriveItem[]>([]);

  const isInternalDragging = useRef(false);
  const transferHandlerRef = useRef<{
    uploadFolder: (folderPath: string) => void;
    uploadFiles: (filePaths: string[]) => void;
  }>(null);
  const hasInitialized = useRef(false);
  const listViewRef = useRef<HTMLDivElement>(null);

  const eventDependenciesRef = useRef({
    handleFileSelection: null as (() => Promise<void>) | null,
    handleFolderSelection: null as (() => Promise<void>) | null,
    handleDroppedFiles: null as ((paths: string[]) => Promise<void>) | null,
  });

  const eventManager = useTauriEventListeners();
  const params = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    isLoading,
    isInitialized,
    folderItems,
    breadcrumbs,
    hasMoreItems,
    isLoadingMore,
    getRootFolderId,
    getRootShareId,
    currentFolder,
    getFolder,
    actions: {
      navigateTo,
      createFolder,
      loadMoreItems,
      updateFolderName,
      updateFileName,
      moveItems,
      moveToTrash,
    },
  } = useDriveCache();

  const { shareId, folderId } = params;

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      dispatch({
        type: "SET_SMALL_SCREEN",
        isSmall: window.innerWidth < 768,
      });
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, []);

  // Helper functions for modal state management
  const openNewFolderModal = () => {
    dispatch({
      type: "SET_MODAL",
      show: true,
      mode: "new",
      inputValue: "",
    });
  };

  const openEditModal = (item: DriveItem) => {
    dispatch({
      type: "SET_MODAL",
      show: true,
      mode: "edit",
      inputValue: item.name,
    });
    dispatch({
      type: "SET_SELECTED_ITEM_ID",
      id: item.id,
    });
  };

  const closeModal = () => {
    dispatch({
      type: "SET_MODAL",
      show: false,
    });
  };

  const setModalInput = (value: string) => {
    dispatch({
      type: "SET_MODAL",
      show: true,
      inputValue: value,
    });
  };

  // Initialize on component mount
  useEffect(() => {
    if (isInitialized && !isLoading && !hasInitialized.current) {
      hasInitialized.current = true;

      if (folderId) {
        navigateTo(folderId);
      } else if (shareId) {
        const rootId = getRootFolderId();
        if (rootId) {
          navigateTo(rootId);
        }
      }
    }
  }, [
    isInitialized,
    isLoading,
    folderId,
    shareId,
    navigateTo,
    getRootFolderId,
  ]);

  // Handle empty state
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    if (!isLoading && items.length === 0 && folderItems.length === 0) {
      timer = setTimeout(() => {
        dispatch({ type: "SET_SHOWING_EMPTY", showing: true });
      }, 500);
    } else {
      dispatch({ type: "SET_SHOWING_EMPTY", showing: false });
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isLoading, items.length, folderItems.length]);

  // Update items when folder content changes
  useEffect(() => {
    if (folderItems.length > 0 || !isLoading) {
      const mappedItems = folderItems.map((item) => ({
        ...item,
        type: item.type === "share" ? "folder" : item.type,
        isShared: item.type === "share" || item.isShared,
      })) as DriveItem[];
      setItems(mappedItems);
    }
  }, [isLoading, folderItems]);

  const ensureTransferHandler = useCallback(
    (
      callback: (handler: {
        uploadFolder: (folderPath: string) => void;
        uploadFiles: (filePaths: string[]) => void;
      }) => void,
    ) => {
      dispatch({ type: "SET_TRANSFER_HANDLER", show: true });

      setTimeout(() => {
        if (!transferHandlerRef.current) {
          dispatch({
            type: "SET_TOAST",
            show: true,
            message: {
              type: "error",
              text: "Upload handler is not ready. Please try again.",
            },
          });
          return;
        }

        callback(transferHandlerRef.current);
      }, 300);
    },
    [],
  );

  const handleFolderSelection = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
        title: "Select folders to upload",
      });

      if (!selected) {
        return;
      }

      ensureTransferHandler((handler) => {
        if (Array.isArray(selected)) {
          selected.forEach((folderPath) => {
            handler.uploadFolder(folderPath);
          });
        } else {
          handler.uploadFolder(selected);
        }
      });
    } catch (error) {
      dispatch({
        type: "SET_TOAST",
        show: true,
        message: {
          type: "error",
          text: `Error selecting folder: ${error}`,
        },
      });
    }
  }, [ensureTransferHandler]);

  const handleDroppedFiles = useCallback(
    async (filePaths: string[]) => {
      if (!filePaths?.length) return;

      dispatch({
        type: "SET_DRAG_STATE",
        isDragging: false,
        isExternal: false,
      });

      try {
        const fileResults = await Promise.all(
          filePaths.map((path) =>
            invoke("check_if_directory", { path })
              .then((isDir) => ({ path, isDir }))
              .catch(() => ({ path, isDir: false })),
          ),
        );

        const files = fileResults
          .filter((item) => !item.isDir)
          .map((item) => item.path);
        const folders = fileResults
          .filter((item) => item.isDir)
          .map((item) => item.path);

        ensureTransferHandler((handler) => {
          if (folders.length) {
            folders.forEach((folder) => handler.uploadFolder(folder));
          }

          if (files.length) {
            handler.uploadFiles(files);
          }
        });
      } catch (error) {
        console.error("Error processing dropped files:", error);

        dispatch({
          type: "SET_TOAST",
          show: true,
          message: {
            type: "error",
            text: `Error processing dropped files: ${error}`,
          },
        });
      }
    },
    [ensureTransferHandler],
  );

  const handleFileSelection = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        title: "Select files to upload",
      });

      if (!selected) {
        return;
      }

      const filePaths = Array.isArray(selected) ? selected : [selected];

      ensureTransferHandler((handler) => {
        handler.uploadFiles(filePaths);
      });
    } catch (error) {
      dispatch({
        type: "SET_TOAST",
        show: true,
        message: {
          type: "error",
          text: `Error selecting files: ${error}`,
        },
      });
    }
  }, [ensureTransferHandler]);

  useEffect(() => {
    eventDependenciesRef.current = {
      handleFileSelection,
      handleFolderSelection,
      handleDroppedFiles,
    };
  }, [handleFileSelection, handleFolderSelection, handleDroppedFiles]);

  const handleFileEvent = useCallback((event: any) => {
    switch (event.payload) {
      case "new-folder":
        openNewFolderModal();
        break;
    }
  }, []);

  const handleCloudEvent = useCallback(async (event: any) => {
    const { handleFileSelection, handleFolderSelection } =
      eventDependenciesRef.current;
    if (!handleFileSelection || !handleFolderSelection) return;

    switch (event.payload) {
      case "upload-folder":
        await handleFolderSelection();
        break;
      case "upload-file":
        await handleFileSelection();
        break;
    }
  }, []);

  const handleDragDrop = useCallback((event: any) => {
    const { handleDroppedFiles } = eventDependenciesRef.current;
    if (!handleDroppedFiles) return;

    if (!isInternalDragging.current && event.payload?.paths?.length > 0) {
      handleDroppedFiles(event.payload.paths);
    }

    dispatch({
      type: "SET_DRAG_STATE",
      isDragging: false,
      isExternal: false,
    });
  }, []);

  const handleDragEnter = useCallback(() => {
    if (isInternalDragging.current) return;

    dispatch({
      type: "SET_DRAG_STATE",
      isDragging: true,
      isExternal: true,
    });
  }, []);

  const handleDragOver = useCallback(() => {
    if (isInternalDragging.current) return;

    dispatch({
      type: "SET_DRAG_STATE",
      isDragging: true,
      isExternal: true,
    });
  }, []);

  const handleDragLeave = useCallback(() => {
    if (isInternalDragging.current) return;

    dispatch({
      type: "SET_DRAG_STATE",
      isDragging: false,
      isExternal: false,
    });
  }, []);

  useEffect(() => {
    const cleanupFunctions: Array<() => void> = [];

    const setupListeners = async () => {
      try {
        const fileCleanup = await eventManager.registerListener(
          "fileEvent",
          "file-event",
          handleFileEvent,
        );
        cleanupFunctions.push(fileCleanup);

        const cloudCleanup = await eventManager.registerListener(
          "cloudEvent",
          "cloud-event",
          handleCloudEvent,
        );
        cleanupFunctions.push(cloudCleanup);

        const dragDropCleanup = await eventManager.registerListener(
          "dragDrop",
          TauriEvent.DRAG_DROP,
          handleDragDrop,
        );
        cleanupFunctions.push(dragDropCleanup);

        const dragEnterCleanup = await eventManager.registerListener(
          "dragEnter",
          TauriEvent.DRAG_ENTER,
          handleDragEnter,
        );
        cleanupFunctions.push(dragEnterCleanup);

        const dragOverCleanup = await eventManager.registerListener(
          "dragOver",
          TauriEvent.DRAG_OVER,
          handleDragOver,
        );
        cleanupFunctions.push(dragOverCleanup);

        const dragLeaveCleanup = await eventManager.registerListener(
          "dragLeave",
          TauriEvent.DRAG_LEAVE,
          handleDragLeave,
        );
        cleanupFunctions.push(dragLeaveCleanup);
      } catch (error) {
        console.error("Error setting up event listeners:", error);
      }
    };

    setupListeners();

    return () => {
      cleanupFunctions.forEach((cleanup) => {
        if (cleanup) cleanup();
      });
    };
  }, [
    eventManager,
    handleFileEvent,
    handleCloudEvent,
    handleDragDrop,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
  ]);

  const scrollToTop = useCallback(() => {
    if (listViewRef.current) {
      listViewRef.current.scrollTo({
        top: 0,
        behavior: "auto",
      });
    }
  }, []);

  const handleFolderClick = useCallback(
    (event: React.MouseEvent, folder: DriveItem) => {
      if (event.detail === 2 && !event.defaultPrevented) {
        event.preventDefault();

        const rootShareId = getRootShareId();
        if (rootShareId) {
          const rootId = getRootFolderId();
          const newPath =
            folder.id === rootId
              ? `/u/${rootShareId}`
              : `/u/${rootShareId}/folders/${folder.id}`;

          // Navigate to the new path
          navigate(newPath);
          navigateTo(folder.id);

          // Reset selection state after navigation
          handleSelect("");

          // Scroll to top of the content
          scrollToTop();
        }
      } else if (event.detail === 1 && !event.defaultPrevented) {
        event.preventDefault();
        handleSelect(folder.id);
      }
    },
    [getRootShareId, getRootFolderId, navigate, navigateTo, scrollToTop],
  );

  const handleSort = useCallback(
    (criteria: "created" | "name" | "size" | "modified") => {
      dispatch({
        type: "SET_SORT",
        sortBy: criteria,
        sortOrder:
          sortBy === criteria ? (sortOrder === "asc" ? "desc" : "asc") : "asc",
      });
    },
    [sortBy, sortOrder],
  );

  const sortedItems = useMemo(() => {
    const multiplier = sortOrder === "asc" ? 1 : -1;

    return [...items].sort((a, b) => {
      // // Always put folders first
      // if (a.type === "folder" && b.type !== "folder") return -1 * multiplier;
      // if (a.type !== "folder" && b.type === "folder") return 1 * multiplier;

      switch (sortBy) {
        case "created":
          return multiplier * (a.createdAt - b.createdAt);
        case "name":
          return multiplier * a.name.localeCompare(b.name);
        case "size":
          return multiplier * (a.size - b.size);
        case "modified":
          return multiplier * (a.modifiedAt - b.modifiedAt);
        default:
          return multiplier * a.name.localeCompare(b.name);
      }
    });
  }, [items, sortBy, sortOrder]);

  const handleSelect = useCallback((id: string, forceSingle = false) => {
    if (!id) {
      setItems((prevItems) =>
        prevItems.map((item) => ({ ...item, selected: false })),
      );

      dispatch({
        type: "SET_SELECTION",
        count: 0,
        items: [],
      });

      return;
    }

    setItems((prevItems) => {
      const selectionMap = new Map();
      let newSelectedCount = 0;

      const updatedItems = prevItems.map((item) => {
        const newSelected =
          item.id === id
            ? forceSingle
              ? true
              : !item.selected
            : forceSingle
              ? false
              : item.selected;

        if (newSelected) {
          selectionMap.set(item.id, {
            id: item.id,
            name: item.name,
            type: item.type,
            size: item.size,
          });
          newSelectedCount++;
        }

        return { ...item, selected: newSelected };
      });

      dispatch({
        type: "SET_SELECTION",
        count: newSelectedCount,
        items: Array.from(selectionMap.values()),
      });

      return updatedItems;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allSelected =
      items.length > 0 && items.every((item) => item.selected);

    setItems((prevItems) =>
      prevItems.map((item) => ({ ...item, selected: !allSelected })),
    );

    if (!allSelected) {
      dispatch({
        type: "SET_SELECTION",
        count: items.length,
        items: items.map((item) => ({
          id: item.id,
          name: item.name,
          type: item.type,
          size: item.size,
        })),
      });
    } else {
      dispatch({
        type: "SET_SELECTION",
        count: 0,
        items: [],
      });
    }
  }, [items]);

  const handleEdit = useCallback(() => {
    const selectedItem = items.find((item) => item.selected);
    if (selectedItem) {
      openEditModal(selectedItem);
    }
  }, [items]);

  // async function create500Folders(
  //   currentFolderId: string,
  //   user?: { email?: string },
  // ) {
  //   const email = user?.email || "";

  //   for (let i = 0; i < 200; i++) {
  //     const timestamp = Date.now();
  //     const trimmedValue = `Folder_${timestamp}_${i}`;
  //     await createFolder(currentFolderId, trimmedValue, email);
  //   }
  // }

  // const x = async () => {
  //   const currentFolderId =
  //     breadcrumbs[breadcrumbs.length - 1]?.id || getRootFolderId();
  //   await create500Folders(currentFolderId, { email: user?.email }); // ✅ FIXED
  // };

  // useEffect(() => {
  //   x();
  // }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = inputValue.trim();

    // Early return for empty input
    if (!trimmedValue) return;

    dispatch({ type: "SET_PROCESSING", isProcessing: true });

    try {
      // Handle edit mode
      if (modalMode === "edit" && selectedItemId) {
        await handleEditOperation(selectedItemId, trimmedValue);
        return;
      }

      // Handle new folder mode
      if (modalMode === "new") {
        await handleNewFolderOperation(trimmedValue);
      }
    } catch (error) {
      showErrorToast(error as ApiError);
    } finally {
      closeModal();
      // Reset selection for new mode operations
      if (modalMode === "new") {
        handleSelect("");
      }
    }
  };

  // Helper functions (defined outside or inside the component)
  const handleEditOperation = async (
    selectedItemId: string,
    trimmedValue: string,
  ) => {
    const item = items.find((item) => item.id === selectedItemId);

    if (!item) {
      throw new Error("Item not found");
    }

    if (item.name === trimmedValue) {
      throw new Error(
        `The ${item.type} cannot be updated because the new name must be different from the current name.`,
      );
    }

    // Update folder or file based on type
    if (item.type === "folder") {
      await updateFolderName(String(selectedItemId), trimmedValue);
    } else {
      await updateFileName(String(selectedItemId), trimmedValue);
    }

    showSuccessToast(`The ${item.type} has been renamed to "${trimmedValue}"`);
    handleSelect("");
  };

  const handleNewFolderOperation = async (trimmedValue: string) => {
    const currentFolderId =
      breadcrumbs[breadcrumbs.length - 1]?.id || getRootFolderId();

    if (trimmedValue.length > 255) {
      throw new Error("Name must be 255 characters long at most.");
    }

    if (!currentFolderId) {
      throw new Error("Cannot create folder without a parent folder.");
    }

    await createFolder(currentFolderId, trimmedValue, user?.email || "");
    showSuccessToast(
      `A new folder with name "${trimmedValue}" has been added to your drive.`,
    );
  };

  const showSuccessToast = (text: string) => {
    dispatch({
      type: "SET_TOAST",
      show: true,
      message: { type: "success", text },
    });
  };

  const showErrorToast = (error: ApiError) => {
    dispatch({
      type: "SET_TOAST",
      show: true,
      message: { type: "error", text: error.message },
    });
  };

  const fileItems = useMemo(() => {
    return sortedItems?.filter((item) => item.type === "file") || [];
  }, [sortedItems]);

  useEffect(() => {
    if (showPreview && selectedItems.length > 0) {
      const index = fileItems.findIndex(
        (file) => file.id === selectedItems[0]?.id,
      );

      dispatch({
        type: "SET_PREVIEW",
        show: true,
        index: index >= 0 ? index : 0,
        item: index >= 0 ? fileItems[index] : null,
      });
    }
  }, [showPreview, fileItems, selectedItems]);

  const handlePrevItem = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      dispatch({
        type: "SET_PREVIEW",
        show: true,
        index: newIndex,
        item: fileItems[newIndex],
      });
    }
  }, [currentIndex, fileItems]);

  const handleNextItem = useCallback(() => {
    if (currentIndex < fileItems.length - 1) {
      const newIndex = currentIndex + 1;
      dispatch({
        type: "SET_PREVIEW",
        show: true,
        index: newIndex,
        item: fileItems[newIndex],
      });
    }
  }, [currentIndex, fileItems]);

  const handleMoveToTrash = useCallback(async () => {
    if (selectedItems.length === 0) return;
    try {
      const itemIds = selectedItems.map((item) => item.id);

      const itemTypes = selectedItems.reduce<Record<string, "folder" | "file">>(
        (types, item) => {
          types[item.id] = item.type as "folder" | "file";
          return types;
        },
        {},
      );

      const success = await moveToTrash(
        String(currentFolder?.id),
        itemIds,
        itemTypes,
      );
      if (success) {
        dispatch({
          type: "SET_TOAST",
          show: true,
          message: {
            type: "success",
            text: `Moved ${selectedItems.length} ${
              selectedItems.length === 1 ? "item" : "items"
            } to trash.`,
          },
        });
        handleSelect("");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      dispatch({
        type: "SET_TOAST",
        show: true,
        message: {
          type: "error",
          text: `Error: ${errorMessage}`,
        },
      });
    }
  }, [selectedItems, moveToTrash, handleSelect]);

  // const handleMoveToTrash = useCallback(async () => {
  //   if (selectedItems.length === 0) return;
  //   try {
  //     const movePromises = selectedItems.map((item) =>
  //       moveToTrash(item.id, item.type as "folder" | "file"),
  //     );

  //     await Promise.all(movePromises);

  //     dispatch({
  //       type: "SET_TOAST",
  //       show: true,
  //       message: {
  //         type: "success",
  //         text: `Moved ${selectedItems.length} ${
  //           selectedItems.length === 1 ? "item" : "items"
  //         } to trash.`,
  //       },
  //     });

  //     handleSelect("");
  //   } catch (error) {
  //     const errorMessage = error as ApiError;
  //     dispatch({
  //       type: "SET_TOAST",
  //       show: true,
  //       message: {
  //         type: "error",
  //         text: errorMessage.message,
  //       },
  //     });
  //   }
  // }, [selectedItems, moveToTrash, handleSelect]);

  const handleDownload = useCallback(
    (id?: string) => {
      const itemId =
        id || (selectedItems.length > 0 ? selectedItems[0].id : null);
      if (!itemId) return;

      dispatch({
        type: "SET_TOAST",
        show: true,
        message: {
          type: "success",
          text: `Downloaded ${selectedItems.length} ${
            selectedItems.length === 1 ? "item" : "items"
          }.`,
        },
      });

      handleSelect("");
    },
    [selectedItems, handleSelect],
  );

  const handleMoveItems = useCallback(
    async (selectedFolderItem: any, initialSelectedItems: string[]) => {
      if (!selectedFolderItem || !shareId || initialSelectedItems.length === 0)
        return;

      try {
        // Use moveItems function for multiple items
        await moveItems(initialSelectedItems, selectedFolderItem.id);

        // Show success message based on number of items moved
        const itemCount = initialSelectedItems.length;
        const itemType =
          itemCount === 1
            ? getFolder(initialSelectedItems[0])
              ? "Folder"
              : "File"
            : "Items";

        dispatch({
          type: "SET_TOAST",
          show: true,
          message: {
            type: "success",
            text: `${initialSelectedItems.length} ${itemType} moved successfully`,
          },
        });

        // Reset selection after move
        handleSelect("");

        // Close the modal
        dispatch({ type: "SET_MOVE_FOLDER_MODAL", show: false });
      } catch (error) {
        const errorMessage = error as ApiError;
        dispatch({
          type: "SET_TOAST",
          show: true,
          message: {
            type: "error",
            text: errorMessage.message || "Failed to move items",
          },
        });
      }
    },
    [shareId, moveItems, handleSelect, getFolder, dispatch],
  );

  const renderListHeader = () => {
    return (
      <div className="border-b border-slate-400/20 dark:border-[#343140]">
        <div className="grid grid-cols-12 h-12 items-center px-4">
          {selectedCount > 0 ? (
            <>
              <div className="col-span-5 flex items-center">
                <div className="flex-shrink-0 mr-3">
                  <CustomCheckBox
                    checked={selectedCount === items.length && items.length > 0}
                    onChange={handleSelectAll}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {selectedCount} selected
                </span>
              </div>
              <div className="col-span-7"></div>
            </>
          ) : (
            <>
              <div className="col-span-5 flex items-center">
                <div className="flex-shrink-0 mr-2">
                  <CustomCheckBox checked={false} onChange={handleSelectAll} />
                </div>
                <button
                  onClick={() => handleSort("name")}
                  className="text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer px-2 py-1.5 flex items-center"
                >
                  Name
                  {sortBy === "name" && (
                    <ArrowUp
                      className={`w-4 h-4 ml-1.5 transform ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="col-span-3 text-right pl-2">
                <button
                  onClick={() => handleSort("size")}
                  className="text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer px-2 py-1.5 flex items-center pr-2"
                >
                  Size
                  {sortBy === "size" && (
                    <ArrowUp
                      className={`w-4 h-4 ml-1.5 transform ${
                        sortOrder === "desc" ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>
              </div>

              {!isSmallScreen && (
                <>
                  <div className="col-span-2 text-right">
                    <button
                      onClick={() => handleSort("modified")}
                      className="text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer px-2 py-1.5 flex items-center pr-3"
                    >
                      Modified
                      {sortBy === "modified" && (
                        <ArrowUp
                          className={`w-4 h-4 ml-1.5 transform ${
                            sortOrder === "desc" ? "rotate-180" : ""
                          }`}
                        />
                      )}
                    </button>
                  </div>

                  <div className="col-span-1 text-center">
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      Shared
                    </div>
                  </div>
                </>
              )}

              <div className="col-span-1"></div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex justify-between items-center p-2 border-b border-slate-400/20 dark:border-[#343140]">
        <PathNavigator
          breadcrumbs={breadcrumbs}
          isLoading={isLoading}
          navigateTo={(id) => {
            navigateTo(id);
            handleSelect("");
            scrollToTop();
          }}
        />
        <div className="flex items-center">
          {selectedCount === 0 ? (
            <div className="flex items-center">
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={openNewFolderModal}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                    <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                      Create new folder
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-px h-6 bg-slate-400/20 dark:bg-[#343140] mx-4" />

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={handleFolderSelection}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                  >
                    <FolderUp className="w-4 h-4" />
                  </button>
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                    <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                      Upload Folder
                    </div>
                  </div>
                </div>

                <div className="relative group">
                  <button
                    onClick={handleFileSelection}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                  >
                    <FileUp className="w-4 h-4" />
                  </button>
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                    <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                      Upload File
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center">
              <div className="flex items-center gap-2">
                {selectedCount === 1 && selectedItems[0].type === "file" && (
                  <div className="relative group">
                    <button
                      onClick={() =>
                        dispatch({ type: "SET_PREVIEW", show: true })
                      }
                      className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                    >
                      <EyeIcon className="w-4 h-4" />
                    </button>
                    <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                      <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                        Preview
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative group">
                  <button
                    onClick={() => handleDownload()}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                    <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                      Download
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-px h-6 bg-slate-400/20 dark:bg-[#343140] mx-4" />

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={() =>
                      dispatch({
                        type: "SET_MOVE_FOLDER_MODAL",
                        show: true,
                      })
                    }
                    className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                  >
                    <Move className="w-4 h-4" />
                  </button>
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                    <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                      Move to folder
                    </div>
                  </div>
                </div>
                {selectedCount === 1 && (
                  <>
                    <div className="relative group">
                      <button
                        onClick={handleEdit}
                        className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                        <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                          Rename
                        </div>
                      </div>
                    </div>

                    <div className="relative group">
                      <button
                        onClick={() =>
                          dispatch({ type: "SET_DETAILS_MODAL", show: true })
                        }
                        className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                        <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                          Details
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="w-px h-6 bg-slate-400/20 dark:bg-[#343140] mx-4" />

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={handleMoveToTrash}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
                  >
                    <Trash className="w-4 h-4 text-red-500" />
                  </button>
                  <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black dark:bg-white rotate-45" />
                    <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                      Move to trash
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="w-px h-6 bg-slate-400/20 dark:bg-[#343140] mx-4" />

          <div className="relative group">
            <button
              onClick={() =>
                dispatch({
                  type: "SET_VIEW_MODE",
                  isGrid: !isGridView,
                })
              }
              className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
            >
              {isGridView ? (
                <List className="w-4 h-4" />
              ) : (
                <LayoutGrid className="w-4 h-4" />
              )}
            </button>
            <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 right-0 z-50 pointer-events-none">
              <div className="absolute -top-1 right-6 w-2 h-2 bg-black dark:bg-white rotate-45" />
              <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
                Change Layout
              </div>
            </div>
          </div>
        </div>
      </header>

      {items.length > 0 && (
        <div className="sticky top-0 z-10 bg-white dark:bg-[#040405]">
          {isGridView ? (
            <div className="flex items-center px-4 py-2 border-b border-slate-400/20 dark:border-[#343140]">
              <div className="flex items-center space-x-2">
                <div className="flex items-center py-1.5">
                  <CustomCheckBox
                    checked={
                      items.length > 0 && items.every((item) => item.selected)
                    }
                    onChange={handleSelectAll}
                  />
                  <span
                    className={`${selectedCount && "px-3"} text-sm font-bold text-gray-700 dark:text-gray-300`}
                  >
                    {selectedCount > 0 && `${selectedCount} selected`}
                  </span>
                </div>
                {selectedCount === 0 && (
                  <div className="flex items-center">
                    {["name", "size", "modified"].map((criteria) => (
                      <button
                        key={criteria}
                        onClick={() =>
                          handleSort(criteria as "name" | "size" | "modified")
                        }
                        className="flex items-center gap-1.5 text-sm font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2c2934] px-2 py-1.5 rounded cursor-pointer"
                      >
                        {criteria.charAt(0).toUpperCase() + criteria.slice(1)}
                        {sortBy === criteria && (
                          <ArrowUp
                            className={`w-4 h-4 transform ${
                              sortOrder === "desc" ? "rotate-180" : ""
                            }`}
                          />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            renderListHeader()
          )}
        </div>
      )}

      <div className="flex-1 pb-5 overflow-hidden relative" ref={listViewRef}>
        {isDraggingOver && isExternalDrag && !isInternalDragging.current && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-100/50 dark:bg-[#0e0d12]/80 z-50 animate-in fade-in duration-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="max-w-lg w-full mx-4 animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-white dark:bg-gray-800 border-2 border-dashed border-emerald-400 dark:border-emerald-500/50 rounded-xl p-8 shadow-lg transform transition-transform duration-200 hover:scale-[1.02]">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                      <div className="w-20 h-20 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center ring-4 ring-emerald-500/10 dark:ring-emerald-500/5">
                        <Upload className="w-10 h-10 text-emerald-500" />
                      </div>
                      <div className="absolute -right-3 -bottom-3 w-10 h-10 bg-gray-800 dark:bg-gray-900 rounded-lg shadow-lg flex items-center justify-center transform rotate-12">
                        <div className="w-5 h-5 border-2 border-emerald-400 dark:border-emerald-500 rounded-md" />
                      </div>
                    </div>
                    <div className="text-center space-y-2">
                      <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">
                        Drop to upload
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Your files will be encrypted and uploaded securely to
                        your drive.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingSkeleton
            isGridView={isGridView}
            isSmallScreen={isSmallScreen}
          />
        ) : items.length === 0 ? (
          showingEmpty ? (
            <EmptyState />
          ) : (
            <LoadingSkeleton
              isGridView={isGridView}
              isSmallScreen={isSmallScreen}
            />
          )
        ) : isGridView ? (
          <VirtualizedGridView
            items={sortedItems}
            onSelect={handleSelect}
            handleFolderClick={handleFolderClick}
            handleDownload={handleDownload}
            handleEdit={handleEdit}
            setIsMoveFolderModalOpen={() =>
              dispatch({ type: "SET_MOVE_FOLDER_MODAL", show: true })
            }
            setShowPreview={() => dispatch({ type: "SET_PREVIEW", show: true })}
            setShowDetailsModal={() =>
              dispatch({ type: "SET_DETAILS_MODAL", show: true })
            }
            moveToTrash={handleMoveToTrash}
            user={user as User}
            loadMoreItems={loadMoreItems}
            hasMoreItems={hasMoreItems}
            isLoadingMore={isLoadingMore}
          />
        ) : (
          <VirtualizedListView
            items={sortedItems}
            onSelect={handleSelect}
            handleFolderClick={handleFolderClick}
            handleDownload={handleDownload}
            handleEdit={handleEdit}
            setIsMoveFolderModalOpen={() =>
              dispatch({ type: "SET_MOVE_FOLDER_MODAL", show: true })
            }
            setShowPreview={() => dispatch({ type: "SET_PREVIEW", show: true })}
            setShowDetailsModal={() =>
              dispatch({ type: "SET_DETAILS_MODAL", show: true })
            }
            moveToTrash={handleMoveToTrash}
            user={user as User}
            loadMoreItems={loadMoreItems}
            hasMoreItems={hasMoreItems}
            isLoadingMore={isLoadingMore}
            isSmallScreen={isSmallScreen}
          />
        )}
      </div>

      {showDetailsModal && selectedItems.length > 0 && (
        <FileDetailsModal
          isOpen={showDetailsModal}
          onClose={() => {
            dispatch({ type: "SET_DETAILS_MODAL", show: false });
          }}
          item={sortedItems.find((item) => item.id === selectedItems[0]?.id)}
          formatFileSize={formatBytes}
        />
      )}

      {showPreview && (
        <Preview
          isOpen={showPreview}
          onClose={() => {
            dispatch({
              type: "SET_PREVIEW",
              show: false,
              item: null,
            });
          }}
          nextItem={handleNextItem}
          prevItem={handlePrevItem}
          currentItem={currentPreviewItem || selectedItems[0]}
          hasNext={currentIndex < fileItems.length - 1}
          hasPrev={currentIndex > 0}
          formatFileSize={formatBytes}
          currentIndex={currentIndex}
          totalItems={fileItems.length}
        />
      )}

      {isMoveFolderModalOpen && (
        <FolderBrowserModal
          isOpen={isMoveFolderModalOpen}
          onClose={() => {
            dispatch({ type: "SET_MOVE_FOLDER_MODAL", show: false });
            // Don't reset selection on close, only after successful operation
          }}
          initialSelectedItems={selectedItems.map((item) => item.id)}
          onSelect={(selectedFolderItem, initialSelectedItems) => {
            handleMoveItems(selectedFolderItem, initialSelectedItems);
          }}
          onError={(message: string) => {
            dispatch({
              type: "SET_TOAST",
              show: true,
              message: {
                type: "error",
                text: message,
              },
            });
          }}
          title="Move items"
          description={`Select a destination folder for ${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""}`}
          confirmButtonText="Move here"
        />
      )}

      {showModal && (
        <Dialog
          showModal={showModal}
          modalMode={modalMode}
          inputValue={inputValue}
          setInputValue={setModalInput}
          setShowModal={(show) => {
            if (!show) closeModal();
          }}
          handleCreateSubmit={handleCreateSubmit}
          isProcessing={isProcessing}
        />
      )}

      {showTransferHandler && (
        <TransferHandler
          ref={transferHandlerRef}
          isVisible={showTransferHandler}
          onClose={() => {
            dispatch({ type: "SET_TRANSFER_HANDLER", show: false });
          }}
        />
      )}

      {showToast && (
        <Toast
          toastMessage={toastMessage}
          setToastMessage={(message) =>
            dispatch({
              type: "SET_TOAST",
              show: true,
              message,
            })
          }
          setShowToast={(show) => dispatch({ type: "SET_TOAST", show })}
          showUndo={false}
          onUndo={() => {}}
        />
      )}
    </div>
  );
};

export default DrivePage;
