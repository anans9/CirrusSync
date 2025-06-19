import { createContext, useContext, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ApiService } from "../services/ApiService";

interface ThemeProviderProps {
  children: React.ReactNode;
}

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
  setTheme: (theme: ThemeMode) => void;
  themeMode: ThemeMode;
  isDarkMode: boolean;
  isThemeChanging: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  setTheme: () => {},
  themeMode: "system",
  isDarkMode: false,
  isThemeChanging: false,
});

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>("system");
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [isThemeChanging, setIsThemeChanging] = useState(false);

  // Refs to track state and prevent race conditions
  const hasInitialized = useRef(false);
  const isUpdatingTheme = useRef(false);
  const cooldownActive = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  // Function to determine dark mode status
  const getIsDark = (theme: ThemeMode) => {
    if (theme === "dark") return true;
    if (theme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches; // system preference
  };

  const clearPendingTimeout = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Separate function to update Tauri window theme
  const updateTauriTheme = (isDark: boolean) => {
    invoke("set_window_theme", { isDark }).catch(() => {});
  };

  const applyTheme = (newTheme: ThemeMode) => {
    // Clear any pending timeouts
    clearPendingTimeout();

    // Check if we're in cooldown or already updating
    if (cooldownActive.current || isUpdatingTheme.current) {
      return;
    }

    // Set cooldown to prevent rapid changes
    cooldownActive.current = true;
    setTimeout(() => {
      cooldownActive.current = false;
    }, 500); // 500 milli second cooldown

    // Mark that we're updating the theme
    isUpdatingTheme.current = true;
    setIsThemeChanging(true);

    try {
      const isDark = getIsDark(newTheme);

      // Update state first
      setThemeMode(newTheme);
      setIsDarkMode(isDark);

      // Update DOM classes
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.classList.toggle("light", !isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";

      // Call Tauri with a delay and in a non-blocking way
      setTimeout(() => {
        updateTauriTheme(isDark);
      }, 300);

      ApiService.updatePreferences({
        theme_mode: newTheme,
      });
    } catch (error) {
      // Silently handle errors
    }

    // Set a timeout to clear the updating state
    timeoutRef.current = window.setTimeout(() => {
      isUpdatingTheme.current = false;
      setIsThemeChanging(false);
    }, 300);
  };

  // Initialize theme on mount
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      const savedTheme = localStorage.getItem("theme") as ThemeMode | null;

      // If we have a saved theme, use it
      if (savedTheme && ["light", "dark", "system"].includes(savedTheme)) {
        setTimeout(() => {
          applyTheme(savedTheme as ThemeMode);
        }, 100);
      } else {
        // Otherwise use system preference
        setTimeout(() => {
          applyTheme("system");
        }, 100);
      }
    }

    // Cleanup function
    return () => {
      clearPendingTimeout();
    };
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if (themeMode === "system") {
        // Just update the isDarkMode state and DOM
        const newIsDark = mediaQuery.matches;
        setIsDarkMode(newIsDark);
        document.documentElement.classList.toggle("dark", newIsDark);
        document.documentElement.classList.toggle("light", !newIsDark);
        document.documentElement.style.colorScheme = newIsDark
          ? "dark"
          : "light";

        // Update Tauri window separately and non-blocking
        setTimeout(() => {
          updateTauriTheme(newIsDark);
        }, 100);
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [themeMode]);

  return (
    <ThemeContext.Provider
      value={{
        setTheme: applyTheme,
        themeMode,
        isDarkMode,
        isThemeChanging,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
