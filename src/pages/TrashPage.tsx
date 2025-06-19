import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useTransition,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  LayoutGrid,
  List,
  ArrowUp,
  ArrowDown,
  CircleX,
  Redo2,
  Info,
  Trash,
  MoreVertical,
} from "lucide-react";
import { createPortal } from "react-dom";
import useDriveCache from "../context/DriveManager";
import { FileIcon, FolderIcon } from "../utils/utils";
import { ActionTooltip, TooltipItem } from "../components/Home/ActionToolTip";
import Toast from "../components/Toast";
import { FileDetailsModal } from "../components/Home/Preview";
import { EmptyState } from "../components/EmptyState";
import ActionDialog from "../components/Trash/ActionDialog";
import { CustomCheckBox } from "../components/CustomCheckBox";

// Types
type SortField = "name" | "size" | "deletedAt" | "location";
type SortDirection = "asc" | "desc";
type ActionMode = "single" | "batch";

interface TrashItem {
  id: string;
  name: string;
  type: "folder" | "file";
  size: number;
  deletedAt: number;
  location: string;
  parentId: string;
  original: any;
  selected?: boolean;
}

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface Position {
  x: number;
  y: number;
  isLeft: boolean;
}

interface ItemProps {
  item: TrashItem;
  selected: boolean;
  onSelect: (id: string, forceSingle?: boolean) => void;
  onRestore: (id: string) => void;
  setShowDetailsModal: (show: boolean) => void;
  setShowDeleteModal: (show: boolean) => void;
  tooltipPortal: HTMLDivElement | null;
  isSmallScreen?: boolean;
}

interface VirtualizedViewProps {
  items: TrashItem[];
  onSelect: (id: string, forceSingle?: boolean) => void;
  onRestore: (id: string) => void;
  setShowDetailsModal: (show: boolean) => void;
  setShowDeleteModal: (show: boolean) => void;
  loadMoreItems: () => void;
  hasMoreItems: boolean;
  isLoadingMore: boolean;
  isSmallScreen: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0.00 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
};

const truncateCache = new Map<string, string>();

const getTruncatedName = (filename: string, threshold = 15): string => {
  if (filename.length <= threshold) return filename;
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1 || dotIndex < threshold - 3) {
    return filename.substring(0, threshold - 3) + "...";
  }
  const base = filename.substring(0, dotIndex);
  const ext = filename.substring(dotIndex);
  const maxBaseLength = threshold - ext.length - 3;
  if (maxBaseLength <= 0) return filename;
  return base.substring(0, maxBaseLength) + "..." + ext;
};

const getCachedTruncatedName = (filename: string, threshold = 15): string => {
  const cacheKey = `${filename}-${threshold}`;
  if (truncateCache.has(cacheKey)) {
    return truncateCache.get(cacheKey)!;
  }
  const result = getTruncatedName(filename, threshold);
  truncateCache.set(cacheKey, result);
  return result;
};

const SortableHeader: React.FC<{
  label: string;
  field: SortField;
  sortConfig?: SortConfig;
  onSort?: (field: SortField) => void;
  className?: string;
  align?: "left" | "right";
}> = memo(({ label, field, sortConfig, onSort, className, align = "left" }) => {
  const isCurrentSort = sortConfig?.field === field;

  return (
    <div className={className || ""}>
      <button
        onClick={() => onSort && onSort(field)}
        className={`group flex items-center px-2 py-1.5 ${
          align === "right" ? "ml-auto" : ""
        } ${sortConfig && "rounded hover:bg-gray-50 dark:hover:bg-[#2c2934] cursor-pointer"}`}
      >
        <span
          className={`text-sm font-semibold text-gray-700 dark:text-gray-300`}
        >
          {label}
        </span>
        {isCurrentSort && (
          <div className="w-4 h-4 ml-1.5 flex items-center">
            {sortConfig.direction === "asc" ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </div>
        )}
      </button>
    </div>
  );
});

const TrashGridItem: React.FC<ItemProps> = memo(
  ({
    item,
    selected,
    onSelect,
    onRestore,
    setShowDetailsModal,
    setShowDeleteModal,
    tooltipPortal,
  }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const [showActionTooltip, setShowActionTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<Position>({
      x: 0,
      y: 0,
      isLeft: false,
    });
    const containerRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const TRUNCATE_THRESHOLD = 15;
    const truncatedName = useMemo(
      () => getCachedTruncatedName(item.name, TRUNCATE_THRESHOLD),
      [item.name],
    );
    const shouldShowTooltip = truncatedName !== item.name;

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

      updateTooltipPosition();
      window.addEventListener("resize", updateTooltipPosition);

      return () => {
        window.removeEventListener("resize", updateTooltipPosition);
      };
    }, [showActionTooltip]);

    const handleActionClick = useCallback(
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

    const handleSelect = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(item.id);
      },
      [item.id, onSelect],
    );

    const handleRestore = useCallback(() => {
      setShowActionTooltip(false);
      onRestore(item.id);
    }, [item.id, onRestore]);

    const handleDetails = useCallback(() => {
      setShowActionTooltip(false);
      setShowDetailsModal(true);
    }, [setShowDetailsModal]);

    const handleDelete = useCallback(() => {
      setShowActionTooltip(false);
      setShowDeleteModal(true);
    }, [setShowDeleteModal]);

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
          <TooltipItem icon={Info} label="Details" onClick={handleDetails} />
          <TooltipItem
            icon={Redo2}
            label="Restore from trash"
            onClick={handleRestore}
          />
          <TooltipItem
            icon={Trash}
            label="Delete Permanently"
            onClick={handleDelete}
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
        const charWidth = 7;
        const minWidth = 120;
        const maxWidth = 280;
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
      const arrowStyles =
        position === "bottom"
          ? { arrowTop: "-4px", arrowBottom: "auto" }
          : { arrowTop: "auto", arrowBottom: "-4px" };

      const tooltipContent = (
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

      return createPortal(tooltipContent, document.body);
    };

    return (
      <div
        ref={containerRef}
        onClick={() => onSelect(item.id)}
        className={`group aspect-[3/2] relative cursor-pointer rounded-lg border transition-colors duration-300
      ${
        selected
          ? "border-[1px] border-emerald-500 dark:border-emerald-400 bg-[#e6e6e6] dark:bg-[#343140]/90"
          : "border-[1px] border-gray-200 dark:border-[#2c2934]"
      }
      hover:bg-gray-50 dark:hover:bg-[#2c2934]`}
      >
        <div
          className={`absolute top-2 left-2 ${
            selected ? "" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={handleSelect}
        >
          <CustomCheckBox checked={selected} />
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
              url={item.thumbnail?.blobURL}
              size="large"
            />
          )}
        </div>

        <div className="p-2 flex items-center relative">
          <span
            onMouseEnter={() => shouldShowTooltip && setShowTooltip(true)}
            onMouseLeave={() => shouldShowTooltip && setShowTooltip(false)}
            className="text-sm text-gray-700 dark:text-gray-300 text-center truncate w-full font-medium"
          >
            {truncatedName}
          </span>

          <div className="absolute right-2">
            <button
              ref={buttonRef}
              onClick={handleActionClick}
              className={`p-1 rounded-md transition-all duration-150 cursor-pointer ${
                selected
                  ? "bg-gray-100 dark:bg-[#4a4658]"
                  : "opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-[#4a4658]"
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
          {renderActionTooltip()}
          {renderNameTooltip()}
        </div>
      </div>
    );
  },
);

const TrashListItem: React.FC<ItemProps> = memo(
  ({
    item,
    selected,
    onSelect,
    onRestore,
    setShowDetailsModal,
    setShowDeleteModal,
    tooltipPortal,
    isSmallScreen = false,
  }) => {
    const [showActionTooltip, setShowActionTooltip] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState<Position>({
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

      updateTooltipPosition();
      window.addEventListener("resize", updateTooltipPosition);

      return () => {
        window.removeEventListener("resize", updateTooltipPosition);
      };
    }, [showActionTooltip]);

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(item.id);
      },
      [item.id, onSelect],
    );

    const handleSelect = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(item.id);
      },
      [item.id, onSelect],
    );

    const handleRestore = useCallback(() => {
      setShowActionTooltip(false);
      onRestore(item.id);
    }, [item.id, onRestore]);

    const handleDetails = useCallback(() => {
      setShowActionTooltip(false);
      setShowDetailsModal(true);
    }, [setShowDetailsModal]);

    const handleDelete = useCallback(() => {
      setShowActionTooltip(false);
      setShowDeleteModal(true);
    }, [setShowDeleteModal]);

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
          <TooltipItem icon={Info} label="Details" onClick={handleDetails} />
          <TooltipItem
            icon={Redo2}
            label="Restore from trash"
            onClick={handleRestore}
          />
          <TooltipItem
            icon={Trash}
            label="Delete Permanently"
            onClick={handleDelete}
          />
        </ActionTooltip>
      );

      return tooltipPortal && showActionTooltip
        ? createPortal(tooltipContent, tooltipPortal)
        : tooltipContent;
    };

    const formattedDate = useMemo(() => {
      return new Date(item.deletedAt * 1000)
        .toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(",", " at");
    }, [item.deletedAt]);

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
                <FileIcon filename={item.name} size="small" />
              )}
            </span>
            <span className="text-sm text-gray-700 dark:text-gray-300 truncate font-[500]">
              {item.name}
            </span>
          </div>

          <div className="col-span-3 pl-4">
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
              {item.path}
            </span>
          </div>

          {!isSmallScreen && (
            <div className="col-span-2 pl-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
                {formattedDate}
              </span>
            </div>
          )}

          <div className="col-span-1 pl-2 text-right">
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate block">
              {formatFileSize(item.size)}
            </span>
          </div>

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

const createTooltipPortal = (): HTMLDivElement => {
  const existingContainer = document.querySelector(".tooltip-container");
  if (existingContainer && existingContainer.parentNode) {
    existingContainer.parentNode.removeChild(existingContainer);
  }

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
  return tooltipContainer;
};

// GRID VIEW FIX
const VirtualizedGridView: React.FC<VirtualizedViewProps> = memo(
  ({
    items,
    onSelect,
    onRestore,
    setShowDetailsModal,
    setShowDeleteModal,
    loadMoreItems,
    hasMoreItems,
    isLoadingMore,
  }) => {
    const parentRef = useRef<HTMLDivElement>(null);
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
      const tooltipContainer = createTooltipPortal();
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

    useEffect(() => {
      if (!parentRef.current) return;

      const container = parentRef.current;
      const saveScrollPosition = () => {
        if (container.scrollHeight > 0) {
          scrollPositionRef.current = container.scrollTop;
          scrollPercentageRef.current =
            container.scrollTop / container.scrollHeight;
        }
      };

      const updateLayout = () => {
        if (layoutUpdateTimeoutRef.current) {
          clearTimeout(layoutUpdateTimeoutRef.current);
        }

        const containerWidth = container.clientWidth || 0;
        const gapSize = 12;

        let newColumnCount;
        if (containerWidth <= 640) newColumnCount = 2;
        else if (containerWidth <= 768) newColumnCount = 3;
        else if (containerWidth <= 1024) newColumnCount = 4;
        else if (containerWidth <= 1280) newColumnCount = 5;
        else if (containerWidth <= 1536) newColumnCount = 6;
        else {
          newColumnCount = Math.floor(containerWidth / 260);
          newColumnCount = Math.max(6, Math.min(12, newColumnCount));
        }

        const availableWidth = containerWidth - gapSize * (newColumnCount - 1);
        const itemWidth = Math.floor(availableWidth / newColumnCount);
        const newItemHeight = itemWidth;
        // Use fixed gapReduction value to prevent animation errors
        const newGapReduction = Math.max(0, Math.floor(gapSize * 0.5));

        // Skip update if nothing changed
        if (
          newColumnCount === columnCount &&
          newItemHeight === itemSize &&
          gapReduction === gapReduction
        ) {
          return;
        }

        // Save current scroll position and percentage before updates
        saveScrollPosition();

        // Use startTransition to prevent UI freeze during state updates
        startTransition(() => {
          setColumnCount(newColumnCount);
          setItemSize(newItemHeight);
          setGapReduction(newGapReduction);
        });

        // Use RAF to ensure the DOM has updated before measuring
        layoutUpdateTimeoutRef.current = setTimeout(() => {
          requestAnimationFrame(() => {
            rowVirtualizer.measure();

            // Use exact positioning without snap adjustment to prevent animation errors
            requestAnimationFrame(() => {
              if (container.scrollHeight > 0) {
                container.scrollTop =
                  scrollPercentageRef.current * container.scrollHeight;
              }
            });
          });
          layoutUpdateTimeoutRef.current = null;
        }, 10);
      };

      const debouncedHandleResize = debounce(
        () => {
          updateLayout();
        },
        100,
        { leading: true, trailing: true },
      );

      // Save initial position and set up listeners
      saveScrollPosition();
      container.addEventListener("scroll", saveScrollPosition, {
        passive: true,
      });

      // Initial layout setup
      updateLayout();

      // Set up resize observers
      const resizeObserver = new ResizeObserver(debouncedHandleResize);
      resizeObserver.observe(container);
      window.addEventListener("resize", debouncedHandleResize);

      return () => {
        if (layoutUpdateTimeoutRef.current) {
          clearTimeout(layoutUpdateTimeoutRef.current);
        }
        container.removeEventListener("scroll", saveScrollPosition);
        resizeObserver.unobserve(container);
        window.removeEventListener("resize", debouncedHandleResize);
      };
    }, [rowVirtualizer, columnCount, itemSize, gapReduction]);

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
        className="flex-1 overflow-y-auto p-5 w-full h-full"
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
                  <TrashGridItem
                    key={item.id}
                    item={item}
                    selected={item.selected ?? false}
                    onSelect={onSelect}
                    onRestore={onRestore}
                    setShowDetailsModal={setShowDetailsModal}
                    setShowDeleteModal={setShowDeleteModal}
                    tooltipPortal={tooltipPortalNode}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {isLoadingMore && (
          <div className="flex justify-center py-8 w-full">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    );
  },
);

// LIST VIEW FIX
const VirtualizedListView: React.FC<VirtualizedViewProps> = memo(
  ({
    items,
    onSelect,
    onRestore,
    setShowDetailsModal,
    setShowDeleteModal,
    loadMoreItems,
    hasMoreItems,
    isLoadingMore,
    isSmallScreen,
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
      const existingContainer = document.querySelector(
        ".tooltip-container-list",
      );
      if (existingContainer && existingContainer.parentNode) {
        existingContainer.parentNode.removeChild(existingContainer);
      }

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
        className="flex-1 overflow-y-auto w-full h-full pb-10"
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
                <TrashListItem
                  key={item.id}
                  item={item}
                  selected={item.selected ?? false}
                  onSelect={onSelect}
                  onRestore={onRestore}
                  setShowDetailsModal={setShowDetailsModal}
                  setShowDeleteModal={setShowDeleteModal}
                  tooltipPortal={tooltipPortalNode}
                  isSmallScreen={isSmallScreen}
                />
              </div>
            );
          })}
        </div>

        {isLoadingMore && (
          <div className="flex justify-center py-8 w-full">
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

const ButtonWithTooltip: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  tooltip: string;
}> = memo(({ onClick, icon, tooltip }) => {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState("center");

  useEffect(() => {
    const updatePosition = () => {
      if (!buttonRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const rightSpace = window.innerWidth - rect.right;
      const leftSpace = rect.left;

      // If right space is limited, align to the right
      if (rightSpace < 80) {
        setTooltipPosition("right");
      } else if (leftSpace < 80) {
        setTooltipPosition("left");
      } else {
        setTooltipPosition("center");
      }
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, []);

  return (
    <div className="relative group" ref={buttonRef}>
      <button
        onClick={onClick}
        className="p-2 hover:bg-gray-50 dark:hover:bg-[#2c2934] rounded cursor-pointer transition-colors duration-200"
      >
        {icon}
      </button>
      <div
        className={`absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-max -bottom-10 z-50 pointer-events-none
        ${tooltipPosition === "center" ? "left-1/2 transform -translate-x-1/2" : ""}
        ${tooltipPosition === "right" ? "right-0" : ""}
        ${tooltipPosition === "left" ? "left-0" : ""}`}
      >
        <div
          className={`absolute -top-1 w-2 h-2 bg-black dark:bg-white rotate-45
          ${tooltipPosition === "center" ? "left-1/2 -translate-x-1/2" : ""}
          ${tooltipPosition === "right" ? "right-6" : ""}
          ${tooltipPosition === "left" ? "left-6" : ""}`}
        />
        <div className="relative px-2 py-1 bg-black dark:bg-white text-white dark:text-black font-[400] text-sm rounded">
          {tooltip}
        </div>
      </div>
    </div>
  );
});

const TrashPage: React.FC = () => {
  const driveCache = useDriveCache();
  const [isGridView, setIsGridView] = useState<boolean>(true);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "name",
    direction: "asc",
  });
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRestoring, setIsRestoring] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    type: "success",
    text: "",
  });
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deleteMode, setDeleteMode] = useState<ActionMode>("single");
  const [isDeleteProcessing, setIsDeleteProcessing] = useState<boolean>(false);

  // State for restore operation
  const [showRestoreModal, setShowRestoreModal] = useState<boolean>(false);
  const [restoreMode, setRestoreMode] = useState<ActionMode>("single");
  const [isRestoreProcessing, setIsRestoreProcessing] =
    useState<boolean>(false);

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMoreItems, setHasMoreItems] = useState<boolean>(false);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const hasInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsSmallScreen(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);

    return () => {
      window.removeEventListener("resize", checkScreenSize);
    };
  }, []);

  const updateTrashItems = useCallback(() => {
    const trashedItems = driveCache.getTrashedItems(true, true);

    const formattedItems = trashedItems.map((item) => {
      return {
        ...item.item,
        selected: selectedItems.includes(item.id),
      };
    });

    setTrashItems(formattedItems);
  }, [driveCache, selectedItems]);

  useEffect(() => {
    updateTrashItems();
  }, [driveCache.updateCounter, updateTrashItems]);

  useEffect(() => {
    const initializeTrash = async () => {
      if (hasInitializedRef.current) return;

      setIsLoading(true);

      try {
        if (driveCache.isInitialized) {
          const result = await driveCache.actions.loadTrashContents(1, 50);
          if (result?.hasMore) {
            setHasMoreItems(true);
          }

          hasInitializedRef.current = true;
        }
      } catch (error) {
        setToastMessage({
          type: "error",
          text: "Failed to load trash items",
        });
        setShowToast(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeTrash();
  }, [driveCache.isInitialized]);

  const loadMoreItems = useCallback(async () => {
    if (isLoadingMore || !hasMoreItems) return;

    setIsLoadingMore(true);
    try {
      const result = await driveCache.actions.loadMoreTrashItems();
      if (result) {
        // updateTrashItems();
        setHasMoreItems(driveCache.actions.hasMoreTrashItems);
      }
    } catch (error) {
      console.error("Error loading more items:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMoreItems, driveCache, updateTrashItems]);

  const handleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const sortedItems = useMemo(() => {
    return [...trashItems]
      .sort((a, b) => {
        const multiplier = sortConfig.direction === "asc" ? 1 : -1;

        switch (sortConfig.field) {
          case "name":
            return (
              multiplier *
              a.name.toLowerCase().localeCompare(b.name.toLowerCase())
            );
          case "size":
            return multiplier * (a.size - b.size);
          case "deletedAt":
            return multiplier * (a.deletedAt - b.deletedAt);
          default:
            return 0;
        }
      })
      .map((item) => ({
        ...item,
        selected: selectedItems.includes(item.id),
      }));
  }, [trashItems, sortConfig, selectedItems]);

  const handleSelectItem = useCallback(
    (itemId: string, forceSingle: boolean = false) => {
      setSelectedItems((prev) => {
        if (forceSingle) {
          return [itemId];
        } else {
          if (prev.includes(itemId)) {
            return prev.filter((id) => id !== itemId);
          } else {
            return [...prev, itemId];
          }
        }
      });
    },
    [],
  );

  const handleSelectAll = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSelectedItems(
        event.target.checked ? trashItems.map((item) => item.id) : [],
      );
    },
    [trashItems],
  );

  const handleRestore = useCallback(async () => {
    if (selectedItems.length === 0 || isRestoring) return;

    setIsRestoring(true);
    setShowRestoreModal(false);

    try {
      // Call the batch restore function with the IDs
      const success = await driveCache.actions.restoreFromTrash(selectedItems);

      if (success) {
        setTrashItems((prev) =>
          prev.filter((item) => !selectedItems.includes(item.id)),
        );
        setSelectedItems([]);
        setToastMessage({
          type: "success",
          text: `Restored ${
            selectedItems.length > 1
              ? selectedItems.length + " items"
              : "1 item"
          }`,
        });
        setShowToast(true);
      } else {
        throw new Error("Restore operation failed");
      }
    } catch (error) {
      const errorResponse = error as ApiError;
      setToastMessage({
        type: "error",
        text: `${errorResponse.message}`,
      });
      setShowToast(true);
    } finally {
      setIsRestoring(false);
    }
  }, [selectedItems, driveCache.actions, isRestoring]);

  const handleEmptyTrashClick = useCallback(() => {
    if (trashItems.length === 0) {
      setToastMessage({
        type: "success",
        text: "Trash is already empty.",
      });
      setShowToast(true);
      return;
    }
    const allItemIds = trashItems.map((item) => item.id);
    setSelectedItems(allItemIds);

    setDeleteMode("batch");
    setShowDeleteModal(true);
  }, [trashItems]);

  const handleDelete = useCallback(async () => {
    if (selectedItems.length === 0) return;

    try {
      let successCount = 0;
      let failCount = 0;
      const successfullyDeletedIds = new Set<string>();

      for (const itemId of selectedItems) {
        try {
          const item = trashItems.find((item) => item.id === itemId);
          if (!item) continue;

          const itemType = item.type as "folder" | "file";

          const result = await driveCache.actions.permanentlyDelete(
            itemId,
            itemType,
          );

          if (result) {
            successfullyDeletedIds.add(itemId);
            successCount++;
          } else {
            failCount++;
          }
        } catch (error) {
          failCount++;
        }
      }

      if (successCount > 0) {
        setTrashItems((currentItems) =>
          currentItems.filter((item) => !successfullyDeletedIds.has(item.id)),
        );

        setSelectedItems((currentSelected) =>
          currentSelected.filter((id) => !successfullyDeletedIds.has(id)),
        );
      }

      if (successCount > 0) {
        setToastMessage({
          type: failCount === 0 ? "success" : "error",
          text:
            failCount === 0
              ? `Deleted ${successCount} item${successCount > 1 ? "s" : ""}`
              : `Deleted ${successCount}, failed ${failCount}`,
        });
        setShowToast(true);
      }
    } catch (error) {
      console.error("Delete failed:", error);
      setToastMessage({
        type: "error",
        text: "Delete failed: " + (error as Error).message,
      });
      setShowToast(true);
    } finally {
      setShowDeleteModal(false);
    }
  }, [selectedItems, trashItems, driveCache.actions]);

  const renderListHeader = () => {
    return (
      <div className="border-b border-slate-400/20 dark:border-[#343140]">
        <div className="grid grid-cols-12 h-12 items-center px-4">
          {selectedItems.length > 0 ? (
            <>
              <div className="col-span-5 flex items-center">
                <div className="flex-shrink-0 mr-3">
                  <CustomCheckBox
                    checked={
                      selectedItems.length === trashItems.length &&
                      trashItems.length > 0
                    }
                    onChange={handleSelectAll}
                  />
                </div>
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                  {selectedItems.length} selected
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
                <SortableHeader
                  label="Name"
                  field="name"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                />
              </div>

              <div className="col-span-3 pl-2">
                <SortableHeader label="Location" field="location" />
              </div>

              {!isSmallScreen && (
                <div className="col-span-2">
                  <SortableHeader
                    label="Deleted"
                    field="deletedAt"
                    sortConfig={sortConfig}
                    onSort={handleSort}
                  />
                </div>
              )}

              <div className="col-span-1 text-right">
                <SortableHeader
                  label="Size"
                  field="size"
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  align="right"
                />
              </div>

              <div className="col-span-1"></div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="flex justify-between items-center px-4 py-1.5 border-b border-slate-400/20 dark:border-[#343140]">
        <h1 className="text-sm font-bold text-gray-800 dark:text-gray-200">
          Trash
        </h1>

        <div className="flex items-center gap-4">
          {selectedItems.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <ButtonWithTooltip
                  onClick={() => {
                    setRestoreMode(
                      selectedItems.length === 1 ? "single" : "batch",
                    );
                    setShowRestoreModal(true);
                  }}
                  icon={<Redo2 className="w-4 h-4" />}
                  tooltip="Restore from trash"
                />
                <ButtonWithTooltip
                  onClick={() => {
                    setDeleteMode(
                      selectedItems.length === 1 ? "single" : "batch",
                    );
                    setShowDeleteModal(true);
                  }}
                  icon={<CircleX className="w-4 h-4" />}
                  tooltip="Delete Permanently"
                />
              </div>
              <div className="w-px h-6 bg-slate-400/20 dark:bg-[#343140]" />

              <div className="flex items-center gap-2">
                <ButtonWithTooltip
                  onClick={() => setShowDetailsModal(true)}
                  icon={<Info className="w-4 h-4" />}
                  tooltip="Details"
                />
              </div>
            </>
          )}

          <ButtonWithTooltip
            onClick={() => setIsGridView(!isGridView)}
            icon={
              isGridView ? (
                <List className="w-5 h-5" />
              ) : (
                <LayoutGrid className="w-5 h-5" />
              )
            }
            tooltip="Change Layout"
          />
        </div>
      </header>

      {!isLoading && hasInitializedRef.current && (
        <div className="p-4 text-sm bg-gray-100/50 dark:bg-gray-900/50 text-gray-800 dark:text-gray-100 border-b border-slate-400/20 dark:border-[#343140]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-gray-600 dark:text-gray-300">
              Items in the trash will stay here until you delete them
              permanently
            </p>
            <button
              onClick={handleEmptyTrashClick}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors duration-200 shrink-0 cursor-pointer"
            >
              <Trash className="w-4 h-4 mr-2" />
              Empty trash
            </button>
          </div>
        </div>
      )}

      {trashItems.length > 0 && (
        <div className="sticky top-0 z-10">
          {isGridView ? (
            <div className="flex items-center px-4 py-2 border-b border-slate-400/20 dark:border-[#343140]">
              <div className="flex-shrink-0">
                <CustomCheckBox
                  checked={
                    selectedItems.length === trashItems.length &&
                    trashItems.length > 0
                  }
                  onChange={handleSelectAll}
                />
              </div>
              <div
                className={`flex gap-2 ${selectedItems.length > 0 ? "ml-3" : "ml-2"}`}
              >
                {selectedItems.length > 0 ? (
                  <span className="text-sm font-bold text-gray-700 dark:text-gray-300 py-1.5">
                    {selectedItems.length} selected
                  </span>
                ) : (
                  <>
                    <SortableHeader
                      label="Name"
                      field="name"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Size"
                      field="size"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Deleted"
                      field="deletedAt"
                      sortConfig={sortConfig}
                      onSort={handleSort}
                    />
                  </>
                )}
              </div>
            </div>
          ) : (
            renderListHeader()
          )}
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton
          isGridView={isGridView}
          isSmallScreen={isSmallScreen}
        />
      ) : hasInitializedRef.current && trashItems.length === 0 ? (
        <EmptyState isTrash={true} />
      ) : isGridView ? (
        <VirtualizedGridView
          items={sortedItems}
          onSelect={handleSelectItem}
          onRestore={handleRestore}
          setShowDetailsModal={setShowDetailsModal}
          setShowDeleteModal={setShowDeleteModal}
          loadMoreItems={loadMoreItems}
          hasMoreItems={hasMoreItems}
          isLoadingMore={isLoadingMore}
          isSmallScreen={isSmallScreen}
        />
      ) : (
        <VirtualizedListView
          items={sortedItems}
          onSelect={handleSelectItem}
          onRestore={handleRestore}
          setShowDetailsModal={setShowDetailsModal}
          setShowDeleteModal={setShowDeleteModal}
          loadMoreItems={loadMoreItems}
          hasMoreItems={hasMoreItems}
          isLoadingMore={isLoadingMore}
          isSmallScreen={isSmallScreen}
        />
      )}

      {showToast && (
        <Toast
          toastMessage={toastMessage}
          setToastMessage={setToastMessage}
          setShowToast={setShowToast}
        />
      )}

      {showDetailsModal && selectedItems.length === 1 && (
        <FileDetailsModal
          isOpen={showDetailsModal}
          item={trashItems.find((item) => item.id === selectedItems[0])}
          onClose={() => setShowDetailsModal(false)}
          formatFileSize={formatFileSize}
        />
      )}

      {showDeleteModal && (
        <ActionDialog
          showModal={showDeleteModal}
          mode={deleteMode}
          setMode={setDeleteMode}
          selectedItemsCount={selectedItems.length}
          filename={
            deleteMode === "single"
              ? trashItems.find((item) => item.id === selectedItems[0])?.name
              : undefined
          }
          setShowModal={setShowDeleteModal}
          handleSubmit={handleDelete}
          isProcessing={isDeleteProcessing}
          actionType="delete"
        />
      )}

      {/* Restore Dialog */}
      {showRestoreModal && (
        <ActionDialog
          showModal={showRestoreModal}
          mode={restoreMode}
          setMode={setRestoreMode}
          selectedItemsCount={selectedItems.length}
          filename={
            restoreMode === "single"
              ? trashItems.find((item) => item.id === selectedItems[0])?.name
              : undefined
          }
          setShowModal={setShowRestoreModal}
          handleSubmit={handleRestore}
          isProcessing={isRestoreProcessing}
          actionType="restore"
        />
      )}
    </div>
  );
};

export default memo(TrashPage);
