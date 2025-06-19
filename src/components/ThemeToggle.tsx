import React from "react";
import { Sun, Moon, Monitor, Loader2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export const ThemeToggle: React.FC = () => {
  const { setTheme, themeMode, isThemeChanging } = useTheme();

  const toggleTheme = () => {
    // If theme is currently changing, don't allow further changes
    if (isThemeChanging) {
      return;
    }

    let newTheme: "light" | "dark" | "system";
    if (themeMode === "light") newTheme = "dark";
    else if (themeMode === "dark") newTheme = "system";
    else newTheme = "light";

    setTheme(newTheme);
  };

  // Get the icon based on current theme
  const getIcon = () => {
    if (isThemeChanging) {
      return (
        <Loader2 className="w-5 h-5 text-gray-100 dark:text-gray-300 stroke-[1.5] animate-spin" />
      );
    }

    if (themeMode === "light") {
      return (
        <Sun className="w-5 h-5 text-gray-100 dark:text-gray-300 stroke-[1.5]" />
      );
    } else if (themeMode === "dark") {
      return (
        <Moon className="w-5 h-5 text-gray-100 dark:text-gray-300 stroke-[1.5]" />
      );
    } else {
      return (
        <Monitor className="w-5 h-5 text-gray-100 dark:text-gray-300 stroke-[1.5]" />
      );
    }
  };

  return (
    <button
      onClick={toggleTheme}
      className={`p-1 rounded-md transition-all duration-200 hover:shadow-sm app-region-no-drag
        ${
          isThemeChanging
            ? "cursor-not-allowed opacity-80"
            : "hover:bg-emerald-800/50 dark:hover:bg-[#2c2934] active:scale-95 cursor-pointer"
        }`}
      aria-label={`Switch to ${
        themeMode === "light"
          ? "dark"
          : themeMode === "dark"
            ? "system"
            : "light"
      } mode`}
      disabled={isThemeChanging}
    >
      {getIcon()}
    </button>
  );
};
