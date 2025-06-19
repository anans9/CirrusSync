import React, { useState } from "react";
import { useDriveCache } from "../context/DriveManager";
import FolderTree from "./FolderTree";
import { Folder, List, Grid3X3 } from "lucide-react";

// This component renders the folder tree in a sidebar panel
const FolderTreePanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { currentFolder, navigateTo } = useDriveCache();

  const handleFolderSelect = (folderId: string) => {
    navigateTo(folderId);
    // On mobile, we might want to close the panel after selection
    if (window.innerWidth < 768) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Toggle button for folder tree panel */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed left-20 top-20 z-30 p-2 rounded-full shadow-md 
          ${isOpen ? 
            'bg-emerald-600 text-white' : 
            'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}
          hover:shadow-lg transition-all duration-200
        `}
        title="Toggle folder structure"
      >
        <List className="w-5 h-5" />
      </button>

      {/* Folder tree panel */}
      <div
        className={`
          fixed left-0 top-8 bottom-0 z-20 transition-all duration-300 ease-in-out
          w-72 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm
          border-r border-slate-200 dark:border-slate-700
          transform ${isOpen ? 'translate-x-16' : '-translate-x-full'}
          overflow-hidden shadow-lg
        `}
      >
        <div className="h-full flex flex-col p-3">
          <div className="flex items-center justify-between mb-3 p-2">
            <h2 className="text-base font-medium text-slate-800 dark:text-slate-200 flex items-center">
              <Folder className="w-4 h-4 mr-2" />
              Folder Structure
            </h2>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
          </div>
          
          {/* Render the folder tree component */}
          <div className="flex-1 overflow-hidden">
            <FolderTree 
              onFolderSelect={handleFolderSelect}
              currentFolderId={currentFolder?.id || null}
            />
          </div>
        </div>
      </div>
      
      {/* Overlay to close panel on click outside (mobile) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 dark:bg-black/40 z-10 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default FolderTreePanel;