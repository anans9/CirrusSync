import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  Search,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { useDriveCache } from "../context/DriveManager";

interface FolderItem {
  id: string;
  name: string;
  isLoading: boolean;
  isExpanded: boolean;
  children: FolderItem[];
  parentId: string | null;
}

interface FolderTreeProps {
  onFolderSelect: (folderId: string) => void;
  currentFolderId: string | null;
}

const FolderTree: React.FC<FolderTreeProps> = ({
  onFolderSelect,
  currentFolderId,
}) => {
  const {
    getRootFolderId,
    getRootShareId,
    getFolderChildren,
    navigateTo,
    currentFolder,
  } = useDriveCache();
  
  const [tree, setTree] = useState<FolderItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [foundPaths, setFoundPaths] = useState<string[][]>([]);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({});

  // Initialize the tree with root folder
  useEffect(() => {
    const initTree = async () => {
      const rootFolderId = getRootFolderId();
      if (!rootFolderId) return;

      const rootFolder: FolderItem = {
        id: rootFolderId,
        name: "My Files",
        isLoading: false,
        isExpanded: false,
        children: [],
        parentId: null,
      };

      setTree([rootFolder]);
      
      // Auto-expand root folder
      handleFolderToggle(rootFolder);
    };

    initTree();
  }, [getRootFolderId]);

  // Auto-expand to show current folder
  useEffect(() => {
    if (!currentFolderId || tree.length === 0) return;
    
    const expandToCurrentFolder = async (
      folderId: string,
      currentTree: FolderItem[]
    ): Promise<boolean> => {
      for (const item of currentTree) {
        if (item.id === folderId) {
          // Found the folder, make sure it's expanded
          if (!item.isExpanded) {
            await handleFolderToggle(item);
          }
          return true;
        }
        
        if (item.children.length > 0) {
          const found = await expandToCurrentFolder(folderId, item.children);
          if (found) {
            // If found in children, make sure this parent is expanded too
            if (!item.isExpanded) {
              await handleFolderToggle(item);
            }
            return true;
          }
        }
      }
      
      return false;
    };
    
    // Start from the current folder and work backward to root
    const expandPath = async () => {
      if (currentFolder?.parentId) {
        await expandToCurrentFolder(currentFolder.parentId, tree);
      }
    };
    
    expandPath();
  }, [currentFolderId, currentFolder, tree]);

  // Load children of a folder
  const loadFolderChildren = useCallback(
    async (folder: FolderItem): Promise<FolderItem[]> => {
      if (loadingFolders[folder.id]) return [];
      
      setLoadingFolders(prev => ({ ...prev, [folder.id]: true }));
      
      try {
        // Get children folders from cache or API
        const children = getFolderChildren(folder.id, true) || [];
        
        // Filter to only include folders (not files)
        const folderChildren = children.filter(child => child.type === "folder");
        
        // Map to our FolderItem structure
        return folderChildren.map((child) => ({
          id: child.id,
          name: child.name,
          isLoading: false,
          isExpanded: false,
          children: [],
          parentId: folder.id,
        }));
      } catch (error) {
        return [];
      } finally {
        setLoadingFolders(prev => ({ ...prev, [folder.id]: false }));
      }
    },
    [getFolderChildren, loadingFolders]
  );

  // Toggle folder expansion
  const handleFolderToggle = useCallback(
    async (folder: FolderItem) => {
      if (folder.isLoading) return;

      // Update the tree immutably
      const updateFolderInTree = (
        treeItems: FolderItem[],
        folderId: string,
        updater: (folder: FolderItem) => FolderItem
      ): FolderItem[] => {
        return treeItems.map((item) => {
          if (item.id === folderId) {
            return updater(item);
          }
          if (item.children.length > 0) {
            return {
              ...item,
              children: updateFolderInTree(item.children, folderId, updater),
            };
          }
          return item;
        });
      };

      // First, toggle the expanded state
      setTree((prevTree) =>
        updateFolderInTree(
          prevTree,
          folder.id,
          (f) => ({
            ...f,
            isLoading: !f.isExpanded,
            isExpanded: !f.isExpanded,
          })
        )
      );

      // If we're expanding and have no children yet, load them
      if (!folder.isExpanded && folder.children.length === 0) {
        const children = await loadFolderChildren(folder);
        
        // Update the tree with the loaded children
        setTree((prevTree) =>
          updateFolderInTree(
            prevTree,
            folder.id,
            (f) => ({
              ...f,
              isLoading: false,
              children,
            })
          )
        );
      }
    },
    [loadFolderChildren]
  );

  // Handle folder selection
  const handleFolderSelect = useCallback(
    (folder: FolderItem) => {
      onFolderSelect(folder.id);
      navigateTo(folder.id);
    },
    [onFolderSelect, navigateTo]
  );

  // Search functionality
  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setFoundPaths([]);
      return;
    }

    setIsSearching(true);
    
    // Recursive search function to find matching folders
    const searchInTree = async (
      items: FolderItem[],
      currentPath: FolderItem[] = []
    ): Promise<FolderItem[][]> => {
      const results: FolderItem[][] = [];
      
      for (const item of items) {
        const newPath = [...currentPath, item];
        
        // Check if this folder matches
        if (item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
          results.push(newPath);
        }
        
        // Check children if expanded, or load and check if not
        if (item.children.length > 0) {
          const childResults = await searchInTree(item.children, newPath);
          results.push(...childResults);
        } else if (!item.isExpanded) {
          // Load children if not already loaded
          const children = await loadFolderChildren(item);
          
          // Search in these children
          if (children.length > 0) {
            // Update the tree with these children
            setTree(prev => 
              updateTreeItem(prev, item.id, {
                ...item,
                children,
                isExpanded: true,
              })
            );
            
            const childResults = await searchInTree(children, newPath);
            results.push(...childResults);
          }
        }
      }
      
      return results;
    };
    
    // Helper function to update tree immutably
    const updateTreeItem = (
      items: FolderItem[],
      itemId: string,
      newItem: FolderItem
    ): FolderItem[] => {
      return items.map(item => {
        if (item.id === itemId) {
          return newItem;
        }
        if (item.children.length > 0) {
          return {
            ...item,
            children: updateTreeItem(item.children, itemId, newItem),
          };
        }
        return item;
      });
    };
    
    // Start search from root
    const paths = await searchInTree(tree);
    setFoundPaths(paths.map(path => path.map(item => item.id)));
    setIsSearching(false);
  }, [searchTerm, tree, loadFolderChildren]);

  // Effect to handle search when term changes
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchTerm) {
        handleSearch();
      } else {
        setFoundPaths([]);
      }
    }, 300);
    
    return () => clearTimeout(delaySearch);
  }, [searchTerm, handleSearch]);

  // Recursive function to render a folder and its children
  const renderFolder = (folder: FolderItem, depth: number, isLast: boolean, isSearchResult: boolean) => {
    const isActive = currentFolderId === folder.id;
    const shouldHighlight = isSearchResult && searchTerm.trim() !== "";
    
    return (
      <div key={folder.id} className="select-none">
        <div 
          className={`
            relative flex items-center py-1.5 pl-${depth * 4} pr-2 rounded-lg 
            ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' : 
              shouldHighlight ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400' : 
              'hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'}
            transition-colors duration-150 cursor-pointer group
          `}
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {/* Connection lines for better visibility of hierarchy */}
          {depth > 0 && (
            <div 
              className="absolute left-0 top-0 bottom-0 border-l border-slate-200 dark:border-slate-700/50"
              style={{ 
                left: `${(depth - 1) * 12 + 6}px`,
                height: isLast ? '50%' : '100%'
              }}
            />
          )}
          {depth > 0 && (
            <div 
              className="absolute border-t border-slate-200 dark:border-slate-700/50"
              style={{ 
                left: `${(depth - 1) * 12 + 6}px`,
                width: '6px',
                top: '50%'
              }}
            />
          )}
          
          {/* Expand/collapse button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFolderToggle(folder);
            }}
            className="p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700/50"
          >
            {folder.isLoading ? (
              <Loader2 className="w-4 h-4 text-slate-600 dark:text-slate-400 animate-spin" />
            ) : folder.isExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            )}
          </button>
          
          {/* Folder icon */}
          <div className="mx-1.5">
            {folder.id === getRootFolderId() ? (
              <HardDrive className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : folder.isExpanded ? (
              <FolderOpen className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            ) : (
              <Folder className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            )}
          </div>
          
          {/* Folder name */}
          <div
            className="text-sm truncate cursor-pointer flex-1"
            onClick={() => handleFolderSelect(folder)}
            title={folder.name}
          >
            {folder.name}
          </div>
        </div>
        
        {/* Render children if expanded */}
        {folder.isExpanded && folder.children.length > 0 && (
          <div className="transition-all duration-200 overflow-hidden">
            {folder.children.map((child, index) =>
              renderFolder(
                child, 
                depth + 1, 
                index === folder.children.length - 1,
                foundPaths.some(path => path.includes(child.id))
              )
            )}
          </div>
        )}
      </div>
    );
  };

  // Toggle fullscreen mode
  const toggleFullScreen = () => {
    setIsFullScreen(!isFullScreen);
  };

  return (
    <div 
      className={`
        bg-white dark:bg-gray-900 border border-slate-200 dark:border-slate-700
        rounded-lg shadow-sm overflow-hidden transition-all duration-300 ease-in-out
        ${isFullScreen ? 
          'fixed inset-4 z-50 flex flex-col' : 
          'w-full max-h-[400px] max-w-md flex flex-col'
        }
      `}
    >
      {/* Header with search and controls */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Folder Structure
        </h3>
        <div className="flex items-center">
          <button
            onClick={toggleFullScreen}
            className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
          >
            {isFullScreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      
      {/* Search box */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-700/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search folders..."
            className="w-full py-2 pl-9 pr-8 text-sm bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-600 focus:border-emerald-500 dark:focus:border-emerald-600 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-2.5"
            >
              <X className="w-4 h-4 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300" />
            </button>
          )}
        </div>
        {isSearching && (
          <div className="flex items-center space-x-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Searching...</span>
          </div>
        )}
        {foundPaths.length > 0 && (
          <div className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
            Found {foundPaths.length} {foundPaths.length === 1 ? 'folder' : 'folders'}
          </div>
        )}
      </div>
      
      {/* Tree content with scrolling */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-0.5">
          {tree.map((folder) => renderFolder(
            folder, 
            0, 
            true, 
            foundPaths.some(path => path.includes(folder.id))
          ))}
        </div>
        
        {/* Empty state */}
        {tree.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full py-8 text-slate-400 dark:text-slate-500">
            <Folder className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">No folders to display</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FolderTree;