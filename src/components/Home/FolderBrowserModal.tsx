import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Folder,
  FolderOpen,
  LogIn,
  AlertCircle,
} from "lucide-react";
import { Modal } from "../Modal";
import { useDriveCache } from "../../context/DriveManager";

// Interface for folder items in the tree
interface FolderItem {
  id: string;
  name: string;
  isLoading: boolean;
  isExpanded: boolean;
  children: string[]; // Store IDs instead of nested objects
  parentId: string | null;
  modifiedAt?: number;
  keyData?: {
    privateKey: any;
    keyPacket: string;
    sessionKey?: string;
    contentKey?: string;
    keyPacketId?: string;
  };
}

interface FolderBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedItems: string[]; // Array of item IDs
  onSelect: (
    selectedFolder: FolderItem | null,
    initialSelectedItems: string[], // Array of item IDs
  ) => void;
  onError: (message: string) => void;
  title?: string;
  description?: string;
  confirmButtonText?: string;
  selectionValidationRules?: {
    allowSameFolder?: boolean;
    allowDescendantFolder?: boolean;
  };
}

/**
 * FolderBrowserModal - A reusable component for browsing and selecting a folder
 * to move multiple items to
 */
const FolderBrowserModal: React.FC<FolderBrowserModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = "Select destination",
  description = "Choose where you want to move the selected items",
  confirmButtonText = "Move here",
  initialSelectedItems, // Array of item IDs
  onError,
  selectionValidationRules = {
    allowSameFolder: false,
    allowDescendantFolder: false,
  },
}) => {
  const [folderMap, setFolderMap] = useState<Record<string, FolderItem>>({});
  const [rootFolderIds, setRootFolderIds] = useState<string[]>([]);
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>(
    {},
  );
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [hasValidationWarnings, setHasValidationWarnings] =
    useState<boolean>(false);

  // Refs to preserve state between renders
  const scrollRef = useRef<HTMLDivElement>(null);
  const treeInitialized = useRef<boolean>(false);
  const isLoadingRef = useRef<boolean>(false);
  const expandedFoldersRef = useRef<Set<string>>(new Set());
  const processingFolderIds = useRef<Set<string>>(new Set());
  const folderHierarchyMap = useRef<Map<string, Set<string>>>(new Map()); // Maps folder IDs to their ancestor folders
  const childrenMap = useRef<Map<string, Set<string>>>(new Map()); // Maps folder IDs to their descendant folders
  const lastUpdateTime = useRef<number>(0);
  const lastUpdateCounterRef = useRef<number>(0);
  // Store previous validation inputs to prevent unnecessary calculations
  const prevValidationInputs = useRef<{
    selectedFolder: string | null;
    itemsLength: number;
  }>({ selectedFolder: null, itemsLength: 0 });

  // Get drive cache functions
  const {
    getRootFolderId,
    getFolderChildren,
    getFolder,
    getFile,
    updateCounter,
    actions: { loadFolderTree },
  } = useDriveCache();

  // Helper function to preserve existing order and append new items
  const updateWithPreservedOrder = useCallback(
    (currentIds: string[], newItems: any[]): string[] => {
      // Create a set of current IDs for faster lookup
      const currentIdSet = new Set(currentIds);

      // Create a list of all new item IDs
      const newItemIds: string[] = newItems.map((item) => item.id);

      // First include all existing IDs that are still present in the new items
      const stillPresentIds = currentIds.filter((id) =>
        newItemIds.includes(id),
      );

      // Then add any new IDs that weren't in the current list
      const newAddedIds = newItemIds.filter((id) => !currentIdSet.has(id));

      // Combine: existing items (in their original order) + new items at the end
      return [...stillPresentIds, ...newAddedIds];
    },
    [],
  );

  // Update folder hierarchy maps - track parent-child relationships for validation
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

    // Update children map for validation (each ancestor gets this folder as descendant)
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

  // Check if target folder is a descendant of source folder (would create circular reference)
  const isDescendantOf = useCallback(
    (targetId: string, sourceId: string): boolean => {
      // Get all descendants of the source folder
      const descendants = childrenMap.current.get(sourceId);
      if (!descendants) return false;

      // Check if target is in the descendants set
      return descendants.has(targetId);
    },
    [],
  );

  // Helper function to preload folder contents without navigation
  const preloadFolderContents = useCallback(
    async (folderId: string): Promise<boolean> => {
      try {
        const folder = getFolder(folderId);
        if (!folder) return false;

        // First check if we already have data in our maps
        if (folderMap[folderId] && folderMap[folderId].children.length > 0) {
          // Check how recent was the data updated
          if (Date.now() - lastUpdateTime.current < 30000) {
            return true; // Use cached data if it's recent
          }
        }

        const children = await getFolderChildren(folderId, false, false);
        if (children.length > 0) {
          return true;
        }

        // Only make the API call if we don't have cached data
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
    [getFolder, loadFolderTree, getFolderChildren, folderMap],
  );

  // Function to find path to a folder - returns array of folder IDs from root to target
  const findPathToFolder = useCallback(
    async (folderId: string): Promise<string[]> => {
      // First check our hierarchy map for an optimized path
      const ancestors = folderHierarchyMap.current.get(folderId);
      if (ancestors && ancestors.size > 0) {
        // Convert ancestors set to array and sort by depth (if we track depth)
        const path = Array.from(ancestors);

        // Add the target folder at the end
        path.push(folderId);

        // Root folder should be first
        const rootFolderId = getRootFolderId();
        if (rootFolderId && path.includes(rootFolderId)) {
          const rootIndex = path.indexOf(rootFolderId);
          if (rootIndex > 0) {
            // Move root to the beginning
            path.splice(rootIndex, 1);
            path.unshift(rootFolderId);
          }
        }

        return path;
      }

      // Fallback to iterative traversal if hierarchy map doesn't have the data
      const path: string[] = [];
      let currentId = folderId;

      // Safety counter to prevent infinite loops
      let iterations = 0;
      const maxIterations = 20;

      while (currentId && iterations < maxIterations) {
        path.unshift(currentId);

        const folder = getFolder(currentId);
        if (!folder || !folder.parentId) break;

        // Move up to parent
        currentId = folder.parentId;
        iterations++;

        // If it's the root folder, stop
        if (currentId === getRootFolderId()) {
          path.unshift(currentId);
          break;
        }
      }

      return path;
    },
    [getFolder, getRootFolderId],
  );

  // Find common parent folder for a group of items
  const findCommonParent = useCallback(
    (itemIds: string[]): string | null => {
      if (itemIds.length === 0) return null;

      // For a single item, return its parent
      if (itemIds.length === 1) {
        const item = getFolder(itemIds[0]) || getFile(itemIds[0]);
        return item?.parentId || null;
      }

      // Get all parent IDs
      const parentIds: string[] = [];
      itemIds.forEach((itemId) => {
        const item = getFolder(itemId) || getFile(itemId);
        if (item?.parentId) {
          parentIds.push(item.parentId);
        }
      });

      // If no parents found, return null
      if (parentIds.length === 0) return null;

      // If all items have the same parent, return it
      const firstParent = parentIds[0];
      const allSameParent = parentIds.every((id) => id === firstParent);

      if (allSameParent) {
        return firstParent;
      }

      // If different parents, return the root folder
      return getRootFolderId() || null;
    },
    [getFolder, getFile, getRootFolderId],
  );

  // Initialize the folder tree with root level folders
  const initFolderTree = useCallback(async () => {
    if (treeInitialized.current || isLoadingRef.current) {
      return;
    }

    console.log("Initializing folder tree");
    const rootFolderId = getRootFolderId();
    if (!rootFolderId) {
      console.log("No root folder ID found");
      return;
    }

    isLoadingRef.current = true;
    setLoadingFolders((prev) => ({ ...prev, [rootFolderId]: true }));

    try {
      // First try to get children from existing cache
      let children = await getFolderChildren(rootFolderId, false, false);

      // If no children in cache, load from API
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
        const folderId = child.id;
        childIds.push(folderId);

        const folderItem: FolderItem = {
          id: folderId,
          name: child.name,
          isLoading: false,
          isExpanded: expandedFoldersRef.current.has(folderId),
          children: [],
          parentId: rootFolderId,
          modifiedAt: child.modifiedAt || Date.now(),
          keyData: child.keyData, // Include keyData from the cache
        };

        newFolderMap[folderId] = folderItem;

        // Update folder hierarchy for validation
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

  // Fixed sync effect to update folder tree data - only run when needed
  useEffect(() => {
    // Skip if not visible or initialized
    if (!isOpen || !treeInitialized.current) {
      return;
    }

    // Use this to detect if this is a fresh update vs a repeat
    const isNewUpdate = updateCounter !== lastUpdateCounterRef.current;
    if (!isNewUpdate) return;

    // Update the ref for next time
    lastUpdateCounterRef.current = updateCounter;

    // Skip if updateCounter is 0 (initial state)
    if (updateCounter === 0) return;

    // Get the root folder ID first
    const rootFolderId = getRootFolderId();
    if (!rootFolderId) return;

    // Get all folders we need to check (root + expanded folders)
    const foldersToCheck = new Set<string>([rootFolderId]);

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

          // Get children, possibly triggering a reload if needed
          const children =
            freshChildren.length === 0
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

          // Only update if necessary
          if (isEmpty || hasNewChildren || hasRemovedChildren) {
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
                  keyData: child.keyData, // Include keyData from the cache
                };

                newEntries[child.id] = folderItem;

                // Update folder hierarchy for validation
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

              // Update root folder IDs - only if they changed
              if (
                JSON.stringify(updatedChildIds) !==
                JSON.stringify(rootFolderIds)
              ) {
                setRootFolderIds(updatedChildIds);
              }
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

                // Only update if children changed
                if (
                  JSON.stringify(prev[folderId].children) !==
                  JSON.stringify(updatedChildIds)
                ) {
                  return {
                    ...prev,
                    ...newEntries,
                    [folderId]: {
                      ...prev[folderId],
                      isLoading: false,
                      children: updatedChildIds,
                    },
                  };
                }

                return {
                  ...prev,
                  ...newEntries,
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
    isOpen,
    updateCounter,
    folderMap,
    rootFolderIds,
    getFolderChildren,
    getRootFolderId,
    loadingFolders,
    updateWithPreservedOrder,
    updateFolderHierarchy,
  ]);

  // Toggle folder expansion with immediate child loading
  const handleFolderToggle = useCallback(
    async (folderId: string, e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      const folder = folderMap[folderId];
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
      setFolderMap((prev) => ({
        ...prev,
        [folderId]: {
          ...prev[folderId],
          isExpanded: willExpand,
          isLoading: willExpand && prev[folderId].children.length === 0,
        },
      }));

      // If expanding, load children if needed
      if (willExpand) {
        processingFolderIds.current.add(folderId);
        setLoadingFolders((prev) => ({ ...prev, [folderId]: true }));

        try {
          // First try to get children from cache without forcing a reload
          let children = await getFolderChildren(folderId, false, false);

          // If children are empty or we need fresh data, load them from API
          if (folder.children.length === 0 || children.length === 0) {
            // First try preloading without API call if possible
            const preloaded = await preloadFolderContents(folderId);

            // Get children, possibly reloading if needed
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
              keyData: child.keyData, // Include keyData from cache
            };

            newEntries[childId] = folderItem;

            // Update folder hierarchy for validation
            updateFolderHierarchy(folderItem);
          });

          // Update folder map immediately to show children
          setFolderMap((prev) => ({
            ...prev,
            ...newEntries,
            [folderId]: {
              ...prev[folderId],
              isLoading: false,
              children: childIds,
            },
          }));
        } catch (error) {
          console.error(
            `Error loading children for folder ${folderId}:`,
            error,
          );

          // Reset loading state on error
          setFolderMap((prev) => ({
            ...prev,
            [folderId]: {
              ...prev[folderId],
              isLoading: false,
            },
          }));
        } finally {
          processingFolderIds.current.delete(folderId);
          setLoadingFolders((prev) => {
            const newState = { ...prev };
            delete newState[folderId];
            return newState;
          });
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

  // Effect to initialize tree on first open
  useEffect(() => {
    if (isOpen && !treeInitialized.current) {
      initFolderTree().then(async () => {
        // If we have a common parent folder, pre-select it
        if (initialSelectedItems.length > 0) {
          try {
            const commonParent = findCommonParent(initialSelectedItems);
            if (commonParent) {
              setSelectedFolder(commonParent);

              // Find path to the common parent folder
              const path = await findPathToFolder(commonParent);

              // Expand all folders in path except the last one (the selected folder)
              for (let i = 0; i < path.length - 1; i++) {
                const folderId = path[i];
                if (i > 0) {
                  // Skip root
                  await handleFolderToggle(folderId);
                }
              }

              // Scroll to the selected folder
              setTimeout(() => {
                const selectedElement = document.getElementById(
                  `folder-${commonParent}`,
                );
                if (selectedElement && scrollRef.current) {
                  selectedElement.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }
              }, 300);
            }
          } catch (error) {
            console.error("Error expanding path to selected folder:", error);
          }
        }
      });
    }
  }, [
    isOpen,
    initialSelectedItems,
    findPathToFolder,
    handleFolderToggle,
    initFolderTree,
    findCommonParent,
  ]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      treeInitialized.current = false;
      expandedFoldersRef.current.clear();
      folderHierarchyMap.current.clear();
      childrenMap.current.clear();
      setFolderMap({});
      setRootFolderIds([]);
      setLoadingFolders({});
      setValidationErrors([]);
      setHasValidationWarnings(false);
      setSelectedFolder(null);
      prevValidationInputs.current = { selectedFolder: null, itemsLength: 0 };
    }
  }, [isOpen]);

  // Validate the selected folder efficiently - avoid unnecessary revalidation
  useEffect(() => {
    // Skip if conditions haven't changed
    if (
      !selectedFolder ||
      initialSelectedItems.length === 0 ||
      (prevValidationInputs.current.selectedFolder === selectedFolder &&
        prevValidationInputs.current.itemsLength ===
          initialSelectedItems.length)
    ) {
      return;
    }

    // Update the previous values
    prevValidationInputs.current = {
      selectedFolder,
      itemsLength: initialSelectedItems.length,
    };

    // Collect validation errors and warnings
    const errors: string[] = [];
    let hasWarnings = false;

    // Validate each item against the selected folder
    for (const itemId of initialSelectedItems) {
      const item = getFolder(itemId) || getFile(itemId);
      if (!item) continue;

      // Check item type
      const itemType = getFolder(itemId) ? "folder" : "file";

      // Skip if target is the same as source (for folders only)
      if (itemType === "folder" && selectedFolder === itemId) {
        errors.push(`Cannot move a folder "${item.name}" into itself`);
        continue;
      }

      // Skip if target is a child of source (circular reference)
      if (itemType === "folder" && isDescendantOf(selectedFolder, itemId)) {
        if (!selectionValidationRules.allowDescendantFolder) {
          errors.push(
            `Cannot move a folder "${item.name}" to its own subfolder`,
          );
        } else {
          hasWarnings = true;
        }
        continue;
      }

      // Skip if target is the parent of source (no-op move)
      if (item.parentId === selectedFolder) {
        if (!selectionValidationRules.allowSameFolder) {
          errors.push(`Item "${item.name}" is already in this folder`);
        } else {
          hasWarnings = true;
        }
        continue;
      }
    }

    // Only update if values changed
    if (
      JSON.stringify(errors) !== JSON.stringify(validationErrors) ||
      hasWarnings !== hasValidationWarnings
    ) {
      setValidationErrors(errors);
      setHasValidationWarnings(hasWarnings);
    }
  }, [
    selectedFolder,
    initialSelectedItems,
    getFolder,
    getFile,
    isDescendantOf,
    selectionValidationRules,
    validationErrors,
    hasValidationWarnings,
  ]);

  // Handle folder selection
  const handleFolderSelect = useCallback(
    (folderId: string) => {
      const folder = folderMap[folderId];
      if (!folder) return;
      setSelectedFolder(folderId);
    },
    [folderMap],
  );

  // Handle root folder selection
  const handleRootFolderSelect = useCallback(() => {
    const rootFolderId = getRootFolderId();
    if (rootFolderId) {
      setSelectedFolder(rootFolderId);
    }
  }, [getRootFolderId]);

  // Recursive function to render folder tree
  const renderFolderTree = useCallback(
    (folderId: string, depth: number = 0, isLast: boolean = true) => {
      const folder = folderMap[folderId];
      if (!folder) return null;

      const isActive = selectedFolder === folderId;

      return (
        <div key={folderId} className="select-none">
          <div
            id={`folder-${folderId}`}
            className={`
              relative flex items-center py-2 px-4 rounded-md
              ${
                isActive
                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium"
                  : "hover:bg-slate-100 dark:hover:bg-[#343140]/70 text-gray-700 dark:text-gray-200"
              }
              transition-colors duration-150 cursor-pointer
            `}
            style={{ paddingLeft: `${depth * 20 + 16}px` }}
            onClick={() => handleFolderSelect(folderId)}
          >
            {/* Folder tree lines */}
            {depth > 0 && (
              <>
                <div
                  className="absolute left-0 top-0 bottom-0 border-l border-gray-200 dark:border-gray-700/50"
                  style={{
                    left: `${(depth - 1) * 20 + 25}px`,
                    height: isLast ? "50%" : "100%",
                  }}
                />
                <div
                  className="absolute border-t border-gray-200 dark:border-gray-700/50"
                  style={{
                    left: `${(depth - 1) * 20 + 25}px`,
                    width: "8px",
                    top: "50%",
                  }}
                />
              </>
            )}

            {/* Expand/collapse button */}
            <div
              onClick={(e) => handleFolderToggle(folderId, e)}
              className="p-1 rounded-md hover:bg-gray-100 hover:dark:bg-[#4a4658] transition-colors duration-150 mr-2 cursor-pointer"
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
            <div className="flex-shrink-0">
              {folder.isExpanded ? (
                <FolderOpen className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
              ) : (
                <Folder className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
              )}
            </div>

            {/* Folder name */}
            <span className="ml-2.5 text-sm font-medium truncate">
              {folder.name}
            </span>
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
                      className="py-1.5"
                      style={{
                        paddingLeft: `${(depth + 1) * 20 + 16}px`,
                      }}
                    >
                      <Loader2 className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200 animate-spin" />
                    </div>
                  )}
            </div>
          )}
        </div>
      );
    },
    [
      folderMap,
      selectedFolder,
      loadingFolders,
      handleFolderToggle,
      handleFolderSelect,
    ],
  );

  // Handle the root folder separately
  const renderRootFolder = useCallback(() => {
    const rootFolderId = getRootFolderId();
    const isActive = selectedFolder === rootFolderId;

    return (
      <div key="root" className="select-none">
        <div
          id={`folder-${rootFolderId}`}
          className={`
                    relative flex items-center py-2.5 px-4 rounded-md
                    ${
                      isActive
                        ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium"
                        : "hover:bg-slate-100 dark:hover:bg-[#343140]/70 text-gray-700 dark:text-gray-200"
                    }
                    transition-colors duration-150 cursor-pointer
                  `}
          onClick={handleRootFolderSelect}
        >
          {/* Expand/collapse button - always visible for root */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (rootFolderIds.length > 0) {
                // Collapse all folders
                expandedFoldersRef.current.clear();

                // Update all folders in the map to not be expanded
                setFolderMap((prev) => {
                  const newMap = { ...prev };
                  Object.keys(newMap).forEach((key) => {
                    if (newMap[key].isExpanded) {
                      newMap[key] = { ...newMap[key], isExpanded: false };
                    }
                  });
                  return newMap;
                });
              } else {
                // Refresh tree
                treeInitialized.current = false;
                initFolderTree();
              }
            }}
            className="p-1 rounded-md hover:bg-gray-100 hover:dark:bg-[#4a4658] transition-colors duration-150 mr-2 cursor-pointer"
          >
            {loadingFolders[rootFolderId || ""] ? (
              <Loader2 className="w-4 h-4 text-gray-900 dark:text-gray-200 animate-spin" />
            ) : rootFolderIds.length > 0 ? (
              <ChevronDown className="w-4 h-4 text-gray-900 dark:text-gray-200" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-900 dark:text-gray-200" />
            )}
          </div>

          {/* Folder icon */}
          <div className="flex-shrink-0">
            <FolderOpen className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
          </div>

          {/* Folder name */}
          <span className="ml-2.5 text-sm font-medium">My Files</span>
        </div>

        {/* Render children if we have any */}
        {rootFolderIds.length > 0 ? (
          <div className="transition-all duration-200 overflow-hidden">
            {rootFolderIds.map((folderId, index) =>
              renderFolderTree(folderId, 1, index === rootFolderIds.length - 1),
            )}
          </div>
        ) : loadingFolders[rootFolderId || ""] ? (
          <div className="py-2 pl-16">
            <Loader2 className="w-3.5 h-3.5 text-gray-900 dark:text-gray-200 animate-spin" />
          </div>
        ) : (
          <div className="py-2 pl-16 text-xs text-gray-900 dark:text-gray-200">
            No folders found
          </div>
        )}
      </div>
    );
  }, [
    getRootFolderId,
    selectedFolder,
    rootFolderIds,
    loadingFolders,
    handleRootFolderSelect,
    initFolderTree,
    renderFolderTree,
  ]);

  // Get the selected folder object - memoized to prevent recalculation
  const selectedFolderObject = useMemo(() => {
    if (!selectedFolder) return null;

    // Handle root folder special case
    if (selectedFolder === getRootFolderId()) {
      const rootFolderObj = getFolder(selectedFolder);
      if (!rootFolderObj) return null;

      return {
        id: selectedFolder,
        name: "My Files",
        isLoading: false,
        isExpanded: true,
        children: rootFolderIds,
        parentId: null,
        keyData: rootFolderObj.keyData,
      };
    }

    return folderMap[selectedFolder] || null;
  }, [selectedFolder, folderMap, rootFolderIds, getRootFolderId, getFolder]);

  // Handle confirm button click
  const handleConfirm = useCallback(() => {
    if (selectedFolder && selectedFolderObject) {
      // If we have blocking validation errors, show them
      if (validationErrors.length > 0) {
        // Show the first error
        onError(validationErrors[0]);
        return;
      }

      // If we have warnings but they're allowed by the validation rules, proceed
      onSelect(selectedFolderObject, initialSelectedItems);
      onClose();
    }
  }, [
    selectedFolder,
    selectedFolderObject,
    initialSelectedItems,
    validationErrors,
    onSelect,
    onClose,
    onError,
  ]);

  // Memoize button state with comprehensive validation
  const isConfirmDisabled = useMemo(() => {
    // Disabled if no selection
    if (!selectedFolder) return true;

    // Disabled if there are validation errors
    if (validationErrors.length > 0) return true;

    // All validation passed
    return false;
  }, [selectedFolder, validationErrors]);

  // Build validation message if any
  const validationMessage = useMemo(() => {
    if (validationErrors.length > 0) {
      return validationErrors[0]; // Show only the first error
    }

    if (hasValidationWarnings) {
      return "Some items are already in this folder or have other minor issues but can still be moved.";
    }

    return null;
  }, [validationErrors, hasValidationWarnings]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={Folder}
      iconColor="yellow"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2934] rounded-lg transition-all duration-300 hover:scale-105 cursor-pointer"
          >
            Cancel
          </button>
          <button
            className={`px-6 py-2.5 text-sm font-medium rounded-lg
                          flex items-center justify-center space-x-2 transition-all duration-150
                          focus:outline-none focus:ring-2 cursor-pointer ${
                            isConfirmDisabled
                              ? "bg-emerald-600/50 text-white cursor-not-allowed focus:ring-emerald-500/30"
                              : "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white hover:shadow-md focus:ring-emerald-500"
                          }`}
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            <LogIn className="w-4 h-4 mr-1.5" />
            <span>{confirmButtonText}</span>
          </button>
        </div>
      }
    >
      <>
        <div className="px-6 pb-2 pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>

          {/* Display validation message if any */}
          {validationMessage && (
            <div
              className={`mt-2 flex items-center ${validationErrors.length > 0 ? "text-red-500" : "text-amber-500"} text-sm`}
            >
              <AlertCircle className="w-4 h-4 mr-1.5" />
              <span>{validationMessage}</span>
            </div>
          )}
        </div>

        {/* Folder browser with enhanced scrolling */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto min-h-[400px] max-h-[50vh]
                        scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600
                        scrollbar-track-transparent pb-2 px-2"
        >
          {renderRootFolder()}
        </div>
      </>
    </Modal>
  );
};

export default FolderBrowserModal;
