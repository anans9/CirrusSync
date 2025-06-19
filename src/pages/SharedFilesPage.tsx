import React, { useState, useEffect } from "react";
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  File,
  CloudUpload,
  Download,
  Share2,
  MoreHorizontal,
  Search,
  Grid,
  List,
  Star,
  Clock,
  Trash2,
  X,
  Check,
  Moon,
  Sun,
} from "lucide-react";

// Type definitions
interface FileItem {
  id: number;
  name: string;
  type:
    | "folder"
    | "document"
    | "image"
    | "video"
    | "presentation"
    | "spreadsheet";
  size?: string;
  items?: number;
  modified: string;
  shared: string;
}

type FilterType = "all" | "shared" | "byMe";
type ViewMode = "grid" | "list";
type ThemeMode = "light" | "dark";

// Mock data for demonstration
const mockFiles: FileItem[] = [
  {
    id: 1,
    name: "Project Proposal",
    type: "document",
    size: "2.4 MB",
    modified: "2023-10-15",
    shared: "Only me",
  },
  {
    id: 2,
    name: "Meeting Notes",
    type: "document",
    size: "1.1 MB",
    modified: "2023-10-12",
    shared: "Team",
  },
  {
    id: 3,
    name: "Product Images",
    type: "folder",
    items: 14,
    modified: "2023-10-10",
    shared: "Company",
  },
  {
    id: 4,
    name: "Q4 Reports",
    type: "folder",
    items: 5,
    modified: "2023-09-30",
    shared: "Only me",
  },
  {
    id: 5,
    name: "Presentation.pptx",
    type: "presentation",
    size: "8.7 MB",
    modified: "2023-09-28",
    shared: "Team",
  },
  {
    id: 6,
    name: "Vacation.jpg",
    type: "image",
    size: "3.2 MB",
    modified: "2023-09-25",
    shared: "Only me",
  },
  {
    id: 7,
    name: "Client Meeting.mp4",
    type: "video",
    size: "45.8 MB",
    modified: "2023-09-22",
    shared: "Team",
  },
  {
    id: 8,
    name: "Budget.xlsx",
    type: "spreadsheet",
    size: "1.8 MB",
    modified: "2023-09-20",
    shared: "Management",
  },
];

const SharedFilesPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [theme, setTheme] = useState<ThemeMode>("light");

  // Initialize theme from system preference
  useEffect(() => {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    setTheme(prefersDark ? "dark" : "light");
  }, []);

  // Toggle between light and dark theme
  const toggleTheme = (): void => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const getFileIcon = (type: FileItem["type"]): JSX.Element => {
    const commonClasses = "w-12 h-12";
    switch (type) {
      case "folder":
        return (
          <Folder
            className={`${commonClasses} ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`}
          />
        );
      case "document":
        return (
          <FileText
            className={`${commonClasses} ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`}
          />
        );
      case "image":
        return (
          <ImageIcon
            className={`${commonClasses} ${theme === "dark" ? "text-green-400" : "text-green-600"}`}
          />
        );
      case "video":
        return (
          <Video
            className={`${commonClasses} ${theme === "dark" ? "text-red-400" : "text-red-600"}`}
          />
        );
      case "presentation":
        return (
          <File
            className={`${commonClasses} ${theme === "dark" ? "text-orange-400" : "text-orange-600"}`}
          />
        );
      case "spreadsheet":
        return (
          <File
            className={`${commonClasses} ${theme === "dark" ? "text-teal-400" : "text-teal-600"}`}
          />
        );
      default:
        return (
          <File
            className={`${commonClasses} ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}
          />
        );
    }
  };

  const getThumbnailBg = (type: FileItem["type"], name: string): string => {
    if (theme === "dark") {
      if (type === "image") {
        return "bg-gradient-to-br from-blue-900/30 to-blue-800/30";
      } else if (type === "video") {
        return "bg-gradient-to-br from-red-900/30 to-red-800/30";
      } else if (type === "document") {
        return "bg-gradient-to-br from-blue-900/30 to-indigo-800/30";
      } else if (type === "presentation") {
        return "bg-gradient-to-br from-orange-900/30 to-orange-800/30";
      } else if (type === "spreadsheet") {
        return "bg-gradient-to-br from-green-900/30 to-green-800/30";
      } else if (type === "folder") {
        return "bg-gradient-to-br from-purple-900/30 to-purple-800/30";
      }
      return "bg-gray-800/30";
    } else {
      if (type === "image") {
        return "bg-gradient-to-br from-blue-100 to-blue-200";
      } else if (type === "video") {
        return "bg-gradient-to-br from-red-100 to-red-200";
      } else if (type === "document") {
        return "bg-gradient-to-br from-blue-50 to-indigo-100";
      } else if (type === "presentation") {
        return "bg-gradient-to-br from-orange-100 to-orange-200";
      } else if (type === "spreadsheet") {
        return "bg-gradient-to-br from-green-100 to-green-200";
      } else if (type === "folder") {
        return "bg-gradient-to-br from-purple-50 to-purple-100";
      }
      return "bg-gray-100";
    }
  };

  const toggleItemSelection = (id: number, event: React.MouseEvent): void => {
    event.stopPropagation();
    if (selectedItems.includes(id)) {
      setSelectedItems(selectedItems.filter((itemId) => itemId !== id));
    } else {
      setSelectedItems([...selectedItems, id]);
    }
  };

  const filteredFiles = mockFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const clearSelection = (): void => {
    setSelectedItems([]);
  };

  const handleFilterClick = (filter: FilterType): void => {
    setActiveFilter(filter);
  };

  // Dynamic classes based on theme
  const bgMain = theme === "dark" ? "bg-[#0e0d12]" : "bg-gray-50";
  const bgCard = theme === "dark" ? "bg-gray-900" : "bg-white";
  const bgActive = theme === "dark" ? "bg-purple-900/40" : "bg-purple-100";
  const bgSecondary = theme === "dark" ? "bg-gray-800" : "bg-white";
  const bgInput =
    theme === "dark"
      ? "bg-gray-800 border-gray-700"
      : "bg-gray-100 border-transparent";
  const textPrimary = theme === "dark" ? "text-white" : "text-gray-900";
  const textSecondary = theme === "dark" ? "text-gray-300" : "text-gray-700";
  const textMuted = theme === "dark" ? "text-gray-400" : "text-gray-500";
  const borderColor = theme === "dark" ? "border-gray-700" : "border-gray-200";
  const hoverBgState =
    theme === "dark" ? "hover:bg-gray-800" : "hover:bg-gray-100";
  const activeTabBorder =
    theme === "dark"
      ? "border-purple-400 text-purple-400"
      : "border-purple-500 text-purple-600";

  return (
    <div
      className={`min-h-screen ${bgMain} flex transition-colors duration-200`}
    >
      {/* Sidebar */}
      <div
        className={`hidden md:flex md:flex-col w-64 ${bgSecondary} border-r ${borderColor}`}
      >
        <div className="p-5">
          <div className="flex items-center space-x-2">
            <img
              className="h-8 w-auto"
              src="https://protonmail.com/images/logo.svg"
              alt="Proton"
            />
            <span className={`font-semibold text-lg ${textPrimary}`}>
              Proton Drive
            </span>
          </div>

          <div className="mt-8 space-y-1">
            <button
              className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${textSecondary} ${hoverBgState}`}
            >
              <CloudUpload className="mr-3 h-5 w-5 text-gray-500" />
              My Files
            </button>
            <button
              className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${bgActive} ${theme === "dark" ? "text-purple-400" : "text-purple-700"}`}
            >
              <Share2
                className={`mr-3 h-5 w-5 ${theme === "dark" ? "text-purple-400" : "text-purple-600"}`}
              />
              Shared Files
            </button>
            <button
              className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${textSecondary} ${hoverBgState}`}
            >
              <Clock className="mr-3 h-5 w-5 text-gray-500" />
              Recent
            </button>
            <button
              className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${textSecondary} ${hoverBgState}`}
            >
              <Star className="mr-3 h-5 w-5 text-gray-500" />
              Favorites
            </button>
            <button
              className={`flex items-center w-full px-3 py-2 text-sm font-medium rounded-md ${textSecondary} ${hoverBgState}`}
            >
              <Trash2 className="mr-3 h-5 w-5 text-gray-500" />
              Trash
            </button>
          </div>
        </div>

        <div className="mt-10 p-5">
          <div className="flex items-center justify-between">
            <h3
              className={`text-xs font-semibold ${textMuted} uppercase tracking-wider`}
            >
              Storage
            </h3>
            <span className={`text-xs ${textMuted}`}>5.2 GB of 15 GB</span>
          </div>
          <div
            className={`mt-2 w-full ${theme === "dark" ? "bg-gray-700" : "bg-gray-200"} rounded-full h-2`}
          >
            <div
              className={`${theme === "dark" ? "bg-purple-500" : "bg-purple-600"} h-2 rounded-full`}
              style={{ width: "35%" }}
            ></div>
          </div>
          <button
            className={`mt-4 w-full flex items-center justify-center px-4 py-2 border ${theme === "dark" ? "border-gray-700 bg-gray-800 text-gray-200" : "border-gray-300 bg-white text-gray-700"} shadow-sm text-sm font-medium rounded-md ${hoverBgState}`}
          >
            Upgrade Storage
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Navigation Bar */}
        <nav className={`${bgSecondary} shadow-sm z-10`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center md:hidden">
                  <img
                    className="h-8 w-auto"
                    src="https://protonmail.com/images/logo.svg"
                    alt="Proton"
                  />
                  <span className={`ml-2 font-semibold text-lg ${textPrimary}`}>
                    Proton Drive
                  </span>
                </div>
                <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
                  <span className={`text-lg font-medium ${textPrimary}`}>
                    Shared Files
                  </span>
                </div>
              </div>
              <div className="flex items-center">
                <div className="relative max-w-xs w-full">
                  <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                    <Search
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </div>
                  <input
                    id="search"
                    name="search"
                    className={`block w-full ${bgInput} rounded-md py-2 pl-10 pr-3 text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-purple-500 focus:placeholder-gray-400 ${textPrimary}`}
                    placeholder="Search files"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="ml-4 flex items-center">
                  <button
                    onClick={toggleTheme}
                    className={`p-2 rounded-md ${textMuted} ${hoverBgState}`}
                  >
                    {theme === "dark" ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <Moon className="h-5 w-5" />
                    )}
                  </button>
                  <div className="ml-4 flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={`p-2 rounded-md ${viewMode === "grid" ? bgActive + (theme === "dark" ? " text-purple-400" : " text-purple-700") : textMuted + " " + hoverBgState}`}
                    >
                      <Grid className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={`p-2 rounded-md ${viewMode === "list" ? bgActive + (theme === "dark" ? " text-purple-400" : " text-purple-700") : textMuted + " " + hoverBgState}`}
                    >
                      <List className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="ml-4">
                    <button
                      type="button"
                      className={`flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${theme === "dark" ? "bg-purple-600 hover:bg-purple-700" : "bg-purple-600 hover:bg-purple-700"} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
                    >
                      <CloudUpload
                        className="mr-2 h-5 w-5"
                        aria-hidden="true"
                      />
                      Upload
                    </button>
                  </div>
                  <div className="ml-4 flex items-center">
                    <div className="h-8 w-8 rounded-full bg-purple-600 flex items-center justify-center text-white">
                      <span className="text-sm font-medium">JD</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main content area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {/* Filter tabs */}
          <div className={`mb-6 border-b ${borderColor}`}>
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => handleFilterClick("all")}
                className={`${
                  activeFilter === "all"
                    ? activeTabBorder
                    : `border-transparent ${textMuted} hover:${theme === "dark" ? "text-gray-300 hover:border-gray-500" : "text-gray-700 hover:border-gray-300"}`
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                All Files
              </button>
              <button
                onClick={() => handleFilterClick("shared")}
                className={`${
                  activeFilter === "shared"
                    ? activeTabBorder
                    : `border-transparent ${textMuted} hover:${theme === "dark" ? "text-gray-300 hover:border-gray-500" : "text-gray-700 hover:border-gray-300"}`
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Shared with me
              </button>
              <button
                onClick={() => handleFilterClick("byMe")}
                className={`${
                  activeFilter === "byMe"
                    ? activeTabBorder
                    : `border-transparent ${textMuted} hover:${theme === "dark" ? "text-gray-300 hover:border-gray-500" : "text-gray-700 hover:border-gray-300"}`
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                Shared by me
              </button>
            </nav>
          </div>

          {/* Files display */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={`group relative rounded-lg border ${
                    selectedItems.includes(file.id)
                      ? `${theme === "dark" ? "border-purple-500" : "border-purple-500"} ring-2 ring-purple-500`
                      : `${borderColor} ${theme === "dark" ? "hover:border-purple-500/70" : "hover:border-purple-300"}`
                  } ${bgCard} overflow-hidden shadow transition-all duration-200`}
                  onClick={(e) => toggleItemSelection(file.id, e)}
                >
                  <div
                    className={`h-36 ${getThumbnailBg(file.type, file.name)} flex items-center justify-center p-4`}
                  >
                    {getFileIcon(file.type)}
                  </div>
                  <div className="p-4">
                    <h3
                      className={`text-sm font-medium ${textPrimary} truncate`}
                    >
                      {file.name}
                    </h3>
                    <div
                      className={`mt-2 flex items-center text-xs ${textMuted}`}
                    >
                      <span>
                        {file.type === "folder"
                          ? `${file.items} items`
                          : file.size}
                      </span>
                      <span className="mx-1">•</span>
                      <span>{file.modified}</span>
                    </div>
                  </div>
                  <div
                    className={`absolute top-2 right-2 transition-opacity ${selectedItems.includes(file.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                  >
                    <div className="flex space-x-1">
                      <button
                        className={`p-1 ${theme === "dark" ? "bg-gray-800" : "bg-white"} rounded-full shadow-sm ${theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          // Share functionality would go here
                        }}
                      >
                        <Share2
                          className={`h-4 w-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                        />
                      </button>
                      <button
                        className={`p-1 ${theme === "dark" ? "bg-gray-800" : "bg-white"} rounded-full shadow-sm ${theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-100"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          // More options functionality would go here
                        }}
                      >
                        <MoreHorizontal
                          className={`h-4 w-4 ${theme === "dark" ? "text-gray-300" : "text-gray-600"}`}
                        />
                      </button>
                    </div>
                  </div>
                  {selectedItems.includes(file.id) && (
                    <div className="absolute top-2 left-2">
                      <div className="h-5 w-5 bg-purple-600 rounded-full flex items-center justify-center">
                        <Check className="h-3 w-3 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={`${bgCard} shadow overflow-hidden sm:rounded-md`}>
              <ul className={`divide-y ${borderColor}`}>
                {filteredFiles.map((file) => (
                  <li
                    key={file.id}
                    className={`${
                      selectedItems.includes(file.id)
                        ? theme === "dark"
                          ? "bg-purple-900/20"
                          : "bg-purple-50"
                        : theme === "dark"
                          ? "hover:bg-gray-800/50"
                          : "hover:bg-gray-50"
                    }`}
                    onClick={(e) => toggleItemSelection(file.id, e)}
                  >
                    <div className="px-4 py-4 flex items-center sm:px-6">
                      <div className="min-w-0 flex-1 flex items-center">
                        <div className="flex-shrink-0">
                          <div
                            className={`h-12 w-12 rounded ${getThumbnailBg(file.type, file.name)} flex items-center justify-center`}
                          >
                            {React.cloneElement(getFileIcon(file.type), {
                              className: "w-6 h-6",
                            })}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1 px-4">
                          <div>
                            <p
                              className={`text-sm font-medium ${textPrimary} truncate`}
                            >
                              {file.name}
                            </p>
                            <p className={`mt-1 flex text-xs ${textMuted}`}>
                              <span>{file.shared}</span>
                              <span className="mx-1">•</span>
                              <span>
                                {file.type === "folder"
                                  ? `${file.items} items`
                                  : file.size}
                              </span>
                              <span className="mx-1">•</span>
                              <span>Modified {file.modified}</span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-5 flex-shrink-0 flex space-x-4">
                        <button
                          type="button"
                          className={`inline-flex items-center p-1.5 border ${theme === "dark" ? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"} shadow-sm text-xs rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Download functionality would go here
                          }}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center p-1.5 border ${theme === "dark" ? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"} shadow-sm text-xs rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // Share functionality would go here
                          }}
                        >
                          <Share2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className={`inline-flex items-center p-1.5 border ${theme === "dark" ? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"} shadow-sm text-xs rounded focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
                          onClick={(e) => {
                            e.stopPropagation();
                            // More options functionality would go here
                          }}
                        >
                          <MoreHorizontal
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                      {selectedItems.includes(file.id) && (
                        <div className="ml-3">
                          <div className="h-5 w-5 bg-purple-600 rounded-full flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Selection actions bar - appears when items are selected */}
        {selectedItems.length > 0 && (
          <div className="fixed bottom-0 inset-x-0 pb-2 sm:pb-5">
            <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
              <div
                className={`p-2 rounded-lg ${theme === "dark" ? "bg-purple-900" : "bg-purple-600"} shadow-lg sm:p-3`}
              >
                <div className="flex items-center justify-between flex-wrap">
                  <div className="w-0 flex-1 flex items-center">
                    <span
                      className={`flex p-2 rounded-lg ${theme === "dark" ? "bg-purple-800" : "bg-purple-800"}`}
                    >
                      <Check className="h-6 w-6 text-white" />
                    </span>
                    <p className="ml-3 font-medium text-white truncate">
                      <span>
                        {selectedItems.length}{" "}
                        {selectedItems.length === 1 ? "item" : "items"} selected
                      </span>
                    </p>
                  </div>
                  <div className="flex space-x-4">
                    <button
                      type="button"
                      className={`flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm leading-4 font-medium ${theme === "dark" ? "text-white bg-purple-700 hover:bg-purple-600" : "text-purple-600 bg-white hover:bg-purple-50"}`}
                    >
                      <Share2
                        className="-ml-0.5 mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Share
                    </button>
                    <button
                      type="button"
                      className={`flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm leading-4 font-medium ${theme === "dark" ? "text-white bg-purple-700 hover:bg-purple-600" : "text-purple-600 bg-white hover:bg-purple-50"}`}
                    >
                      <Download
                        className="-ml-0.5 mr-2 h-4 w-4"
                        aria-hidden="true"
                      />
                      Download
                    </button>
                    <button
                      type="button"
                      className={`flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm leading-4 font-medium ${theme === "dark" ? "text-white bg-purple-800 hover:bg-purple-700" : "text-white bg-purple-700 hover:bg-purple-800"}`}
                      onClick={clearSelection}
                    >
                      <X className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SharedFilesPage;
