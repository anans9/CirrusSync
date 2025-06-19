import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  X,
  Trash,
  ChevronDown,
  ChevronRight,
  HardDrive,
  Upload,
  Cloud,
  Settings,
  Users,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react";
import TitleBar from "../TitleBar";
import { useAuth } from "../context/AuthContext";
import CirrusSync from "../assets/logo.svg";
import { useDriveCache } from "../context/DriveManager";

// Interface for folder items in the tree
interface FolderItem {
  id: string;
  name: string;
  isLoading: boolean;
  isExpanded: boolean;
  children: string[]; // Store IDs instead of nested objects
  parentId: string | null;
  modifiedAt?: number;
}

// Interface for navigation items
interface NavigationItem {
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

// Interface for navigation sections
interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

const DashboardLayout: React.FC = () => {
  // UI state
  const [isLargeScreen, setIsLargeScreen] = useState<boolean>(
    window.innerWidth >= 1024,
  );
  const [userToggled, setUserToggled] = useState<boolean>(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(isLargeScreen);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [showStorageInfo, setShowStorageInfo] =
    useState<boolean>(isLargeScreen);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<string, boolean>
  >({
    Main: false,
    System: false,
  });

  // Folder tree state - using flat structure for better updates
  const [folderMap, setFolderMap] = useState<Record<string, FolderItem>>({});
  const [rootFolderIds, setRootFolderIds] = useState<string[]>([]);
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>(
    {},
  );
  const [showFolderTree, setShowFolderTree] = useState<boolean>(false);

  // Refs to preserve state between renders
  const treeInitialized = useRef<boolean>(false);
  const lastUpdateTime = useRef<number>(0);
  const expandedFoldersRef = useRef<Set<string>>(new Set());
  const isLoadingRef = useRef<boolean>(false);
  const processingFolderIds = useRef<Set<string>>(new Set());
  const pendingChildrenUpdates = useRef<Set<string>>(new Set());
  const lastUpdateCounterRef = useRef<number>(0);

  // Enhanced memory caching
  const folderCache = useRef<Map<string, FolderItem>>(new Map());
  const folderHierarchyMap = useRef<Map<string, Set<string>>>(new Map());
  const childrenMap = useRef<Map<string, Set<string>>>(new Map());

  // Routing and auth
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Get necessary drive cache functions
  const {
    getRootShareId,
    getRootFolderId,
    getFolderChildren,
    currentFolder,
    isInitialized,
    getFolder,
    updateCounter,
    actions: { navigateTo, loadFolderTree },
  } = useDriveCache();

  // Update folder hierarchy maps - track parent-child relationships
  const updateFolderHierarchy = useCallback((folder: FolderItem) => {
    const folderId = folder.id;
    const parentId = folder.parentId;

    if (!parentId) return; // Skip root folder

    // Get current ancestors for this folder
    let ancestors =
      folderHierarchyMap.current.get(folderId) || new Set<string>();

    // Add immediate parent
    ancestors.add(parentId);

    // Add parent's ancestors if they exist
    const parentAncestors = folderHierarchyMap.current.get(parentId);
    if (parentAncestors) {
      parentAncestors.forEach((id) => ancestors.add(id));
    }

    // Update the map
    folderHierarchyMap.current.set(folderId, ancestors);

    // Update children map
    ancestors.forEach((ancestorId) => {
      const descendants =
        childrenMap.current.get(ancestorId) || new Set<string>();
      descendants.add(folderId);
      childrenMap.current.set(ancestorId, descendants);
    });

    // Ensure this folder is in the children map even if it has no descendants yet
    if (!childrenMap.current.has(folderId)) {
      childrenMap.current.set(folderId, new Set<string>());
    }
  }, []);

  // Helper function to preserve existing order and append new items
  const updateWithPreservedOrder = (
    currentIds: string[],
    newItems: any[],
  ): string[] => {
    // Create a set of current IDs for faster lookup
    const currentIdSet = new Set(currentIds);

    // Create a list of all new item IDs
    const newItemIds: string[] = newItems.map((item) => item.id);

    // First include all existing IDs that are still present in the new items
    const stillPresentIds = currentIds.filter((id) => newItemIds.includes(id));

    // Then add any new IDs that weren't in the current list
    const newAddedIds = newItemIds.filter((id) => !currentIdSet.has(id));

    // Combine: existing items (in their original order) + new items at the end
    return [...stillPresentIds, ...newAddedIds];
  };

  // Helper function to preload folder contents without navigation
  const preloadFolderContents = useCallback(
    async (folderId: string): Promise<boolean> => {
      try {
        // First check the in-memory cache
        if (folderCache.current.has(folderId)) {
          const cachedFolder = folderCache.current.get(folderId);
          if (cachedFolder && cachedFolder.children.length > 0) {
            // Check if the cache is still recent (less than 30 seconds)
            if (Date.now() - lastUpdateTime.current < 30000) {
              return true; // Use cached data if it's recent
            }
          }
        }

        // Next try the folder cached in DriveCache
        const folder = getFolder(folderId);
        if (!folder) return false;

        // Try to get children from existing cache without API call
        const children = await getFolderChildren(folderId, false, false);
        if (children.length > 0) {
          return true;
        }

        // As a last resort, make an API call
        const result = await loadFolderTree(folderId, 1, 150, false, false);
        return result.success;
      } catch (error) {
        console.error(
          `Error preloading folder contents for ${folderId}:`,
          error,
        );
        return false;
      }
    },
    [getFolder, loadFolderTree, getFolderChildren],
  );

  // Initialize the folder tree with root level folders
  const initFolderTree = useCallback(async () => {
    console.log("Initializing folder tree");
    const rootFolderId = getRootFolderId();
    if (!rootFolderId || isLoadingRef.current) {
      console.log("No root folder ID found or already loading");
      return;
    }

    isLoadingRef.current = true;
    setLoadingFolders((prev) => ({ ...prev, [rootFolderId]: true }));

    try {
      // First try to get children from existing cache without forcing API call
      let children = await getFolderChildren(rootFolderId, false, false);

      // If no children in cache, try to load with API call
      if (children.length === 0) {
        await preloadFolderContents(rootFolderId);
        children = await getFolderChildren(rootFolderId, true, false);
      }

      // Filter for folders only
      const folderChildren = children.filter(
        (child) => child.type === "folder" && !child.isDeleted,
      );

      // Create folder entries with modifiedAt timestamps
      const newFolderMap: Record<string, FolderItem> = {};
      const childIds: string[] = [];

      folderChildren.forEach((child) => {
        const childId = child.id;
        childIds.push(childId);

        const folderItem: FolderItem = {
          id: childId,
          name: child.name,
          isLoading: false,
          isExpanded: expandedFoldersRef.current.has(childId),
          children: [],
          parentId: rootFolderId,
          modifiedAt: child.modifiedAt || Date.now(),
        };

        newFolderMap[childId] = folderItem;

        // Also add to memory cache for instant access
        folderCache.current.set(childId, folderItem);

        // Update folder hierarchy maps
        updateFolderHierarchy(folderItem);
      });

      // No need to sort - use the order as provided by the API
      setRootFolderIds(childIds);
      setFolderMap((prev) => ({
        ...prev,
        ...newFolderMap,
      }));

      lastUpdateTime.current = Date.now();
      treeInitialized.current = true;
    } catch (error) {
      console.error("Error initializing folder tree:", error);
    } finally {
      setLoadingFolders((prev) => {
        const newState = { ...prev };
        delete newState[rootFolderId];
        return newState;
      });
      isLoadingRef.current = false;
    }
  }, [
    getRootFolderId,
    getFolderChildren,
    preloadFolderContents,
    updateFolderHierarchy,
  ]);

  // Toggle folder tree visibility
  const toggleMyFilesTree = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      setShowFolderTree((prev) => {
        const newState = !prev;
        // If showing tree and not initialized, mark for initialization
        if (newState && !treeInitialized.current) {
          treeInitialized.current = true;
          // Initialize in the next tick to avoid state update conflicts
          setTimeout(() => {
            initFolderTree();
          }, 0);
        }
        return newState;
      });
    },
    [initFolderTree],
  );

  // Fixed sync effect that properly handles both root AND expanded folders
  useEffect(() => {
    // Skip if not visible or initialized
    if (!showFolderTree || !treeInitialized.current) {
      return;
    }

    // Use this to detect if this is a fresh update vs a repeat
    const isNewUpdate = updateCounter !== lastUpdateCounterRef.current;

    // Update the ref for next time
    if (isNewUpdate) {
      lastUpdateCounterRef.current = updateCounter;
    }

    // Skip if updateCounter is 0 (initial state)
    if (updateCounter === 0) return;

    // Throttle updates if this isn't a fresh update
    if (!isNewUpdate) {
      const now = Date.now();
      if (now - lastUpdateTime.current < 300) {
        return;
      }
      lastUpdateTime.current = now;
    }

    console.log(
      `Sync effect running, updateCounter: ${updateCounter}, isNew: ${isNewUpdate}`,
    );

    // Get the root folder ID first
    const rootFolderId = getRootFolderId();

    // Get all folders we need to check (root + expanded folders)
    const foldersToCheck = new Set<string>();

    // ALWAYS add root folder if it exists - regardless of expansion state
    // This ensures we always check for new root level folders
    if (rootFolderId) {
      foldersToCheck.add(rootFolderId);
    }

    // Then add all explicitly expanded folders
    expandedFoldersRef.current.forEach((folderId) => {
      // Skip the root folder since we already added it
      if (folderId === rootFolderId) return;

      // Only add folders that exist and are expanded
      if (
        folderId &&
        folderMap[folderId] &&
        folderMap[folderId].isExpanded === true
      ) {
        foldersToCheck.add(folderId);
      }
    });

    console.log(`Checking ${foldersToCheck.size} folders for updates`);

    // Process all folders
    const syncAllFolders = async () => {
      // Convert to array to avoid issues with set modification during iteration
      const foldersArray = Array.from(foldersToCheck);

      for (const folderId of foldersArray) {
        try {
          // Skip if invalid ID or already processing
          if (
            !folderId ||
            processingFolderIds.current.has(folderId) ||
            loadingFolders[folderId]
          ) {
            continue;
          }

          // For non-root folders, skip if not expanded
          const isRootFolder = folderId === rootFolderId;
          if (
            !isRootFolder &&
            (!folderMap[folderId] || !folderMap[folderId].isExpanded)
          ) {
            continue;
          }

          // Mark as processing
          processingFolderIds.current.add(folderId);

          // First try to get children from local cache without forcing a reload
          const freshChildren = await getFolderChildren(
            folderId,
            false, // Don't force reload first
            false,
          );

          // If no children found and it's a fresh update, try to reload
          const shouldReload = isNewUpdate && freshChildren.length === 0;

          // Get children, possibly triggering a reload if needed
          const children = shouldReload
            ? await getFolderChildren(folderId, true, false)
            : freshChildren;

          // Filter for folders only, with safety check
          const folderChildren = children.filter(
            (child) => child && child.type === "folder" && !child.isDeleted,
          );

          // For non-root folders, skip if no longer expanded
          // We check again because async operations take time
          if (
            !isRootFolder &&
            (!folderMap[folderId] || !folderMap[folderId].isExpanded)
          ) {
            processingFolderIds.current.delete(folderId);
            continue;
          }

          // Get current folder from state with safety checks
          let currentChildIds: string[] = [];

          if (isRootFolder) {
            // For root folder, use rootFolderIds
            currentChildIds = [...rootFolderIds];
          } else if (folderMap[folderId]) {
            // For other folders, use the children array from folderMap with safety check
            currentChildIds = folderMap[folderId].children || [];
          } else {
            // Skip if folder doesn't exist in state
            processingFolderIds.current.delete(folderId);
            continue;
          }

          // Check if we need to update
          const freshChildIds = folderChildren.map((child) => child.id);

          // For instant updates, we want to update on ANY change
          // For fresh updates always update if empty
          // For repeat checks, only update if there are new children
          const hasNewChildren = freshChildIds.some(
            (id) => !currentChildIds.includes(id),
          );
          const isEmpty = currentChildIds.length === 0;

          // Also check if any children were removed
          const hasRemovedChildren = currentChildIds.some(
            (id) =>
              !freshChildIds.includes(id) &&
              // Make sure it's really gone, not just a non-folder item
              !folderMap[id],
          );

          // Update if empty, has new children, has removed children, or is a fresh update
          // For root folder, we also always update on fresh updates to ensure immediate response
          if (
            isEmpty ||
            hasNewChildren ||
            hasRemovedChildren ||
            (isRootFolder && isNewUpdate)
          ) {
            console.log(
              `Folder ${folderId} has changes: Root=${isRootFolder}, Empty=${isEmpty}, New=${hasNewChildren}, Removed=${hasRemovedChildren}`,
              { current: currentChildIds.length, fresh: freshChildIds.length },
            );

            // Create entries for all new folders
            const newEntries: Record<string, FolderItem> = {};

            folderChildren.forEach((child) => {
              if (!folderMap[child.id]) {
                const folderItem: FolderItem = {
                  id: child.id,
                  name: child.name || "Unnamed",
                  isLoading: false,
                  isExpanded: expandedFoldersRef.current.has(child.id),
                  children: [], // Always initialize with empty array
                  parentId: folderId,
                  modifiedAt: child.modifiedAt || Date.now(),
                };

                newEntries[child.id] = folderItem;

                // Add to memory cache for instant access
                folderCache.current.set(child.id, folderItem);

                // Update folder hierarchy maps
                updateFolderHierarchy(folderItem);
              }
            });

            // Get updated list preserving order
            const updatedChildIds = updateWithPreservedOrder(
              currentChildIds,
              folderChildren,
            );

            // Update state based on folder type
            if (isRootFolder) {
              // Update folderMap with new entries
              setFolderMap((prev) => ({
                ...prev,
                ...newEntries,
              }));

              // Update root folder IDs
              setRootFolderIds(updatedChildIds);
            } else {
              // Update folderMap with new entries and update the folder's children
              setFolderMap((prev) => {
                // Safety check in case folder was removed
                if (!prev[folderId]) {
                  return {
                    ...prev,
                    ...newEntries,
                  };
                }

                const updatedFolder = {
                  ...prev[folderId],
                  isLoading: false,
                  children: updatedChildIds,
                };

                // Update memory cache too
                folderCache.current.set(folderId, updatedFolder);

                return {
                  ...prev,
                  ...newEntries,
                  [folderId]: updatedFolder,
                };
              });
            }
          }
        } catch (error) {
          console.error(`Error syncing folder ${folderId}:`, error);
        } finally {
          // Always clean up
          processingFolderIds.current.delete(folderId);
        }
      }
    };

    // Execute the sync
    syncAllFolders();
  }, [
    updateCounter,
    showFolderTree,
    folderMap,
    rootFolderIds,
    getFolderChildren,
    getRootFolderId,
    loadingFolders,
    updateWithPreservedOrder,
    updateFolderHierarchy,
  ]);

  // Initialize folder tree when first shown
  useEffect(() => {
    if (showFolderTree && !treeInitialized.current && isInitialized) {
      treeInitialized.current = true;
      initFolderTree();
    }
  }, [showFolderTree, isInitialized, initFolderTree]);

  // Process any pending children updates
  useEffect(() => {
    if (pendingChildrenUpdates.current.size === 0) return;

    // Process all pending updates in one batch for efficiency
    const pendingFolders = Array.from(pendingChildrenUpdates.current);
    pendingChildrenUpdates.current.clear();

    // Apply all updates in a single state update
    setFolderMap((prev) => {
      const newState = { ...prev };

      for (const folderId of pendingFolders) {
        const folder = newState[folderId];
        if (folder) {
          const updatedFolder = {
            ...folder,
            isLoading: false,
          };

          newState[folderId] = updatedFolder;

          // Update memory cache too
          folderCache.current.set(folderId, updatedFolder);
        }
      }

      return newState;
    });
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const largeScreen = window.innerWidth >= 1024;
      setIsLargeScreen(largeScreen);

      if (!userToggled) {
        setSidebarOpen(largeScreen);
        if (largeScreen) {
          setTimeout(() => setShowStorageInfo(true), 300);
        } else {
          setShowStorageInfo(false);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [userToggled]);

  // Toggle sidebar
  const handleSidebarToggle = () => {
    setUserToggled(true);
    setSidebarOpen((prev) => {
      const newState = !prev;

      if (newState) {
        setTimeout(() => setShowStorageInfo(true), 300);
      } else {
        setShowStorageInfo(false);
      }

      return newState;
    });
  };

  // Toggle folder expansion with immediate child loading
  const handleFolderToggle = useCallback(
    async (folderId: string, e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      // First check in memory cache for immediate response
      const cachedFolder = folderCache.current.get(folderId);
      const folder = cachedFolder || folderMap[folderId];
      if (!folder) return;

      // Skip if already loading
      if (
        loadingFolders[folderId] ||
        processingFolderIds.current.has(folderId)
      ) {
        console.log("Folder already loading, skipping toggle");
        return;
      }

      const willExpand = !folder.isExpanded;

      // Track expanded state in ref
      if (willExpand) {
        expandedFoldersRef.current.add(folderId);
      } else {
        expandedFoldersRef.current.delete(folderId);
      }

      // Update UI state immediately
      const updatedFolder = {
        ...folder,
        isExpanded: willExpand,
        isLoading: willExpand && folder.children.length === 0,
      };

      // Update memory cache immediately
      folderCache.current.set(folderId, updatedFolder);

      // Update state
      setFolderMap((prev) => ({
        ...prev,
        [folderId]: updatedFolder,
      }));

      // If expanding, load children if needed
      if (willExpand) {
        processingFolderIds.current.add(folderId);
        setLoadingFolders((prev) => ({ ...prev, [folderId]: true }));

        try {
          // First try to get children from cache without forcing a reload
          let children = await getFolderChildren(folderId, false, false);

          // If folder children is empty or cache returned nothing, load them
          if (folder.children.length === 0 || children.length === 0) {
            // Check if preloading succeeds first
            const preloaded = await preloadFolderContents(folderId);

            // Get children with reload if needed
            children = await getFolderChildren(folderId, !preloaded, false);
          }

          // Filter for folders only
          const folderChildren = children.filter(
            (child) => child.type === "folder" && !child.isDeleted,
          );

          // Create new entries and collect IDs
          const newEntries: Record<string, FolderItem> = {};
          const childIds: string[] = [];

          folderChildren.forEach((child) => {
            const childId = child.id;
            childIds.push(childId);

            const folderItem: FolderItem = {
              id: childId,
              name: child.name,
              isLoading: false,
              isExpanded: expandedFoldersRef.current.has(childId),
              children: [],
              parentId: folderId,
              modifiedAt: child.modifiedAt || Date.now(),
            };

            newEntries[childId] = folderItem;

            // Add to memory cache for instant access
            folderCache.current.set(childId, folderItem);

            // Update folder hierarchy maps
            updateFolderHierarchy(folderItem);
          });

          // Create the updated folder with children
          const updatedFolderWithChildren = {
            ...updatedFolder,
            isLoading: false,
            children: childIds,
          };

          // Update memory cache
          folderCache.current.set(folderId, updatedFolderWithChildren);

          // Update folder map in state
          setFolderMap((prev) => ({
            ...prev,
            ...newEntries,
            [folderId]: updatedFolderWithChildren,
          }));
        } catch (error) {
          console.error(
            `Error loading children for folder ${folderId}:`,
            error,
          );

          // Reset loading state on error
          const resetFolder = {
            ...updatedFolder,
            isLoading: false,
          };

          // Update memory cache
          folderCache.current.set(folderId, resetFolder);

          // Update state
          setFolderMap((prev) => ({
            ...prev,
            [folderId]: resetFolder,
          }));
        } finally {
          processingFolderIds.current.delete(folderId);
          setLoadingFolders((prev) => {
            const newState = { ...prev };
            delete newState[folderId];
            return newState;
          });
          pendingChildrenUpdates.current.add(folderId);
        }
      }
    },
    [
      folderMap,
      loadingFolders,
      getFolderChildren,
      preloadFolderContents,
      updateFolderHierarchy,
    ],
  );

  // Handle folder selection (navigation)
  const handleFolderSelect = useCallback(
    (folderId: string) => {
      // First check memory cache for immediate response
      const folder = folderCache.current.get(folderId) || folderMap[folderId];
      if (!folder) return;

      console.log(`Selecting folder ${folderId} (${folder.name})`);
      navigateTo(folderId);
    },
    [folderMap, navigateTo],
  );

  // Navigate to root/My Files
  const goToMyFiles = useCallback(
    (e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      console.log("Navigating to My Files (root folder)");

      const rootShareId = getRootShareId();
      if (rootShareId) {
        navigate(`/u/${rootShareId}`);

        const rootFolderId = getRootFolderId();
        if (rootFolderId) {
          navigateTo(rootFolderId);
        }
      }
    },
    [getRootShareId, getRootFolderId, navigate, navigateTo],
  );

  // Toggle section collapse
  const toggleSection = (title: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  // Format bytes for display
  const formatBytes = (bytes: number) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  // Calculate storage details
  const storageUsed = user?.usedDriveSpace ?? 0;
  const storageTotal = user?.maxDriveSpace ?? 0;
  const storagePercentage = (storageUsed / storageTotal) * 100;

  // Shared icon component
  const SharedIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );

  // Memoize navigation sections
  const navigationSections = useMemo<NavigationSection[]>(
    () => [
      {
        title: "Main",
        items: [
          {
            path: `/u/${getRootShareId()}`,
            icon: HardDrive,
            label: "My Files",
          },
          { path: "/shared", icon: SharedIcon, label: "Shared Files" },
          { path: "/shared-with-me", icon: Users, label: "Shared with Me" },
        ],
      },
      {
        title: "System",
        items: [
          { path: "/settings", icon: Settings, label: "Settings" },
          { path: "/trash", icon: Trash, label: "Trash" },
        ],
      },
    ],
    [getRootShareId],
  );

  // Recursive function to render folder tree
  const renderFolderTree = useCallback(
    (folderId: string, depth: number = 0, isLast: boolean = true) => {
      // Check memory cache first for instant response, then fallback to state
      const folder = folderCache.current.get(folderId) || folderMap[folderId];
      if (!folder) return null;

      const isActive = currentFolder?.id === folderId;

      return (
        <div key={folderId} className="select-none">
          <div
            className={`
            relative flex items-center py-1.5 pr-2 rounded-lg
            ${
              isActive
                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                : "hover:bg-slate-100 dark:hover:bg-[#343140]/70 text-slate-700 dark:text-slate-300"
            }
            transition-colors duration-150 cursor-pointer group
          `}
            style={{ paddingLeft: `${depth * 12 + (sidebarOpen ? 12 : 2)}px` }}
            onClick={() => handleFolderSelect(folderId)}
          >
            {/* Folder tree lines */}
            {depth > 0 && sidebarOpen && (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 border-l border-slate-200 dark:border-slate-700/50"
                  style={{
                    left: `${(depth - 1) * 12 + 18}px`,
                    height: isLast ? "50%" : "100%",
                  }}
                />
                <div
                  className="absolute border-t border-slate-200 dark:border-slate-700/50"
                  style={{
                    left: `${(depth - 1) * 12 + 18}px`,
                    width: "6px",
                    top: "50%",
                  }}
                />
              </>
            )}

            {/* Expand/collapse button */}
            <div
              onClick={(e) => handleFolderToggle(folderId, e)}
              className="p-0.5 rounded-md hover:bg-gray-100 hover:dark:bg-[#4a4658] flex-shrink-0 cursor-pointer"
            >
              {loadingFolders[folderId] ? (
                <Loader2 className="w-4 h-4 text-gray-900 dark:text-gray-200 animate-spin" />
              ) : folder.isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-900 dark:text-gray-200" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-900 dark:text-gray-200" />
              )}
            </div>

            {/* Folder icon */}
            <div className={`mx-1 flex-shrink-0 ${!sidebarOpen ? "mr-0" : ""}`}>
              {folder.isExpanded ? (
                <FolderOpen className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <Folder className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              )}
            </div>

            {/* Folder name (only show if sidebar is open) */}
            {sidebarOpen && (
              <div
                className="text-sm truncate cursor-pointer flex-1"
                title={folder.name}
              >
                {folder.name}
              </div>
            )}
          </div>

          {/* Render children if expanded */}
          {folder.isExpanded && (
            <div className="transition-all duration-200 overflow-hidden">
              {folder.children.length > 0
                ? folder.children.map((childId, index) =>
                    renderFolderTree(
                      childId,
                      depth + 1,
                      index === folder.children.length - 1,
                    ),
                  )
                : loadingFolders[folderId] && (
                    <div
                      className="py-1 pl-10"
                      style={{
                        paddingLeft: `${
                          (depth + 1) * 12 + (sidebarOpen ? 12 : 2)
                        }px`,
                      }}
                    >
                      <Loader2 className="w-3 h-3 text-gray-900 dark:text-gray-200 animate-spin" />
                    </div>
                  )}
            </div>
          )}
        </div>
      );
    },
    [
      folderMap,
      loadingFolders,
      currentFolder,
      sidebarOpen,
      handleFolderSelect,
      handleFolderToggle,
    ],
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Title bar fixed at top, height of 8px */}
      <TitleBar onToggleMenu={handleSidebarToggle} sidebarOpen={sidebarOpen} />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden pt-8">
        {/* Sidebar */}
        <div
          className={`fixed top-7 bottom-0 left-0 bg-white/80 dark:bg-[#040405]
            border-r border-slate-200/50 dark:border-[#343140]
            transition-all duration-300 ease-out z-10 flex flex-col
            ${sidebarOpen ? "w-64" : "w-16"}`}
        >
          <div className="px-4 py-3 border-b border-slate-200/50 dark:border-[#343140] flex justify-between">
            <div className="flex items-center">
              <img
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                src={CirrusSync}
                alt="CirrusSync"
                className={`
                  ${isHovered ? "scale-110 rotate-12" : "scale-100 rotate-0"}
                  transition-transform duration-500
                  min-w-7 h-7 cursor-pointer
                  ${!sidebarOpen ? "mx-auto" : ""}
                `}
                onClick={goToMyFiles}
              />
              <div
                className={`ml-2 whitespace-nowrap transition-opacity duration-300
                ${!sidebarOpen ? "opacity-0 hidden" : "opacity-100"}`}
              >
                <span
                  className="text-xl font-semibold text-gray-800 dark:text-white cursor-pointer"
                  onClick={goToMyFiles}
                >
                  Cirrus
                </span>
                <span
                  className="text-xl font-semibold bg-gradient-to-r from-emerald-500 to-blue-600
                  dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent cursor-pointer"
                  onClick={goToMyFiles}
                >
                  Sync
                </span>
              </div>
            </div>

            <button
              onClick={handleSidebarToggle}
              className={`p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-[#343140]
                transition-opacity duration-300 cursor-pointer
                ${!sidebarOpen ? "opacity-0" : "opacity-100"}`}
            >
              <X className="w-4 h-4 text-gray-900 dark:text-white" />
            </button>
          </div>

          <nav className="flex-1 p-3 overflow-y-auto">
            {/* Main Navigation with "My Files" first */}
            <div className="space-y-1.5 mb-4">
              {/* Section header */}
              <div
                onClick={() => toggleSection("Main")}
                className={`flex items-center space-x-2 px-2 py-1.5 w-full rounded-lg
                  hover:bg-slate-100 dark:hover:bg-[#343140] cursor-pointer
                  ${!sidebarOpen ? "justify-center" : "justify-start"}`}
              >
                {collapsedSections["Main"] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200" />
                )}
                <h3
                  className={`text-xs font-medium text-slate-600 dark:text-gray-200 uppercase tracking-wide
                  transition-opacity duration-300
                  ${!sidebarOpen ? "opacity-0 hidden" : "opacity-100"}`}
                >
                  Navigation
                </h3>
              </div>

              {!collapsedSections["Main"] && (
                <div className={`space-y-0.5 ${!sidebarOpen ? "" : "ml-2"}`}>
                  {/* My Files button with separate clickable areas */}
                  <div className="relative">
                    <div
                      className={`relative w-full p-2 rounded-lg flex items-center
                      ${!sidebarOpen ? "justify-center" : ""}
                      ${
                        location.pathname === `/u/${getRootShareId()}` &&
                        !currentFolder?.parentId
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#343140]/70 hover:text-slate-900 dark:hover:text-white"
                      } transition-all duration-200 cursor-pointer`}
                      onClick={goToMyFiles}
                    >
                      <HardDrive className="w-4 h-4 flex-shrink-0" />
                      <span
                        className={`text-sm ml-2.5 transition-opacity duration-300
                        ${!sidebarOpen ? "opacity-0 hidden" : "opacity-100"}`}
                      >
                        My Files
                      </span>
                      {sidebarOpen && (
                        <div
                          className="ml-auto p-0.5 rounded-md hover:bg-gray-100 hover:dark:bg-[#4a4658] cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMyFilesTree(e);
                          }}
                        >
                          {loadingFolders[getRootFolderId() || ""] ? (
                            <Loader2 className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200 animate-spin" />
                          ) : showFolderTree ? (
                            <ChevronDown className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Folder tree after My Files (only shown when expanded) */}
                  {sidebarOpen && showFolderTree && (
                    <div className="mt-1 pl-2 space-y-0.5 transition-all duration-200">
                      {loadingFolders[getRootFolderId() || ""] ? (
                        <div className="flex items-center justify-center py-1">
                          <Loader2 className="w-4 h-4 text-gray-900 dark:text-gray-200 animate-spin" />
                        </div>
                      ) : rootFolderIds.length > 0 ? (
                        rootFolderIds.map((folderId, index) =>
                          renderFolderTree(
                            folderId,
                            0,
                            index === rootFolderIds.length - 1,
                          ),
                        )
                      ) : (
                        <div className="text-xs text-slate-500 py-1 px-2">
                          No folders found
                        </div>
                      )}
                    </div>
                  )}

                  {/* Other navigation items */}
                  {navigationSections[0].items.slice(1).map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <div
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`relative w-full p-2 rounded-lg flex items-center
                          ${!sidebarOpen ? "justify-center" : ""}
                          ${
                            isActive
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#343140]/70 hover:text-slate-900 dark:hover:text-white"
                          } transition-all duration-200 cursor-pointer`}
                        draggable={false}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span
                          className={`text-sm ml-2.5 transition-opacity duration-300
                            ${!sidebarOpen ? "opacity-0 hidden" : "opacity-100"}`}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* System Navigation */}
            <div className="space-y-1.5 mb-4">
              {/* System section header */}
              <div
                onClick={() => toggleSection("System")}
                className={`flex items-center space-x-2 px-2 py-1.5 w-full rounded-lg
                  hover:bg-slate-100 dark:hover:bg-[#343140] cursor-pointer
                  ${!sidebarOpen ? "justify-center" : "justify-start"}`}
              >
                {collapsedSections["System"] ? (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200" />
                )}
                <h3
                  className={`text-xs font-medium text-slate-600 dark:text-gray-200 uppercase tracking-wide
                    transition-opacity duration-300
                    ${!sidebarOpen ? "opacity-0 hidden" : "opacity-100"}`}
                >
                  System
                </h3>
              </div>

              {!collapsedSections["System"] && (
                <div className={`space-y-0.5 ${!sidebarOpen ? "" : "ml-2"}`}>
                  {navigationSections[1].items.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <div
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`relative w-full p-2 rounded-lg flex items-center
                          ${!sidebarOpen ? "justify-center" : ""}
                          ${
                            isActive
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#343140]/70 hover:text-slate-900 dark:hover:text-white"
                          } transition-all duration-200 cursor-pointer`}
                        draggable={false}
                      >
                        <item.icon className="w-4 h-4 flex-shrink-0" />
                        <span
                          className={`text-sm ml-2.5 transition-opacity duration-300
                                                  ${!sidebarOpen ? "opacity-0 hidden" : "opacity-100"}`}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          <div
            className={`
              p-3 border-t border-slate-200/50 dark:border-[#343140]/70
              transform transition-all duration-300 ease-out
              ${
                !sidebarOpen
                  ? "opacity-0 translate-y-4 pointer-events-none absolute bottom-0 w-full"
                  : "opacity-100 translate-y-0"
              }
            `}
          >
            <div
              className={`
                transition-all duration-300 ease-out transform
                ${
                  showStorageInfo
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                }
              `}
            >
              <div className="mb-2">
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span className="font-medium">Storage</span>
                  <span>
                    {formatBytes(storageUsed)} / {formatBytes(storageTotal)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-700 ease-out ${
                      storagePercentage > 85
                        ? "bg-red-500"
                        : storagePercentage > 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{
                      width: `${showStorageInfo ? storagePercentage : 0}%`,
                      transitionDelay: "150ms",
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-2 mt-3">
                {/* Changed from button to div with onClick */}
                <div
                  onClick={() => navigate("/settings?section=billing")}
                  className={`
                    w-full p-2 flex items-center justify-center space-x-2
                    text-white rounded-lg text-xs font-medium
                    transform cursor-pointer relative overflow-hidden
                    ${
                      showStorageInfo
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0"
                    }
                  `}
                  style={{
                    transitionDelay: "200ms",
                    transition:
                      "transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease",
                    borderRadius: "0.5rem", // Ensure consistent border radius
                  }}
                  draggable={false}
                >
                  {/* Static background with matching border radius */}
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg" />

                  {/* Hover overlay with matching border radius */}
                  <div className="absolute inset-0 bg-black opacity-0 hover:opacity-20 transition-opacity duration-200 rounded-lg" />

                  {/* Content stays above the background layers */}
                  <div className="relative flex items-center justify-center space-x-2">
                    <Cloud className="w-4 h-4" />
                    <span>Upgrade Storage</span>
                  </div>
                </div>

                <div
                  className={`
                    flex items-center space-x-1.5 px-2 py-1.5
                    transform transition-all duration-300
                    ${
                      showStorageInfo
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0"
                    }
                  `}
                  style={{ transitionDelay: "250ms" }}
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    End-to-end encrypted storage
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main content area with proper positioning */}
        <main
          className={`flex-1 transition-all duration-300 flex flex-col overflow-hidden
            ${sidebarOpen ? "ml-64" : "ml-16"}`}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
