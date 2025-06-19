import React, { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { Laptop, Moon, Sun } from "lucide-react";

interface AppearanceSectionProps {
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
}

export const AppearanceSection: React.FC<AppearanceSectionProps> = ({
  setToastMessage,
  setShowToast,
}) => {
  const { themeMode, setTheme, isThemeChanging } = useTheme();
  const [isUpdatingTheme, setIsUpdatingTheme] = useState(false);

  const handleThemeChange = async (mode: "light" | "dark" | "system") => {
    if (isUpdatingTheme || isThemeChanging) {
      return;
    }

    setIsUpdatingTheme(true);

    setTheme(mode);

    setTimeout(() => {
      setIsUpdatingTheme(false);

      setToastMessage({
        type: "success",
        text: "Theme updated successfully",
      });
      setShowToast(true);
    }, 300);
  };

  return (
    <div className="flex flex-col h-full pb-6 lg:pb-2">
      {/* Static Header - Similar to AccountSection */}
      <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Appearance Settings
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Customize how the application looks and feels
        </p>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-grow pr-[2px]">
        <div className="space-y-6 pb-6 pr-2">
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Theme
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  mode: "light",
                  icon: Sun,
                  title: "Light Mode",
                  description: "Clean and bright appearance",
                },
                {
                  mode: "dark",
                  icon: Moon,
                  title: "Dark Mode",
                  description: "Easier on the eyes in low light",
                },
                {
                  mode: "system",
                  icon: Laptop,
                  title: "System",
                  description: "Match system preferences",
                },
              ].map((theme) => (
                <button
                  key={theme.mode}
                  onClick={() =>
                    handleThemeChange(theme.mode as "light" | "dark" | "system")
                  }
                  disabled={isUpdatingTheme || isThemeChanging}
                  className={`relative overflow-hidden p-5 bg-white dark:bg-[#1c1b23] rounded-xl border transition-all duration-200
                    ${
                      isUpdatingTheme || isThemeChanging
                        ? "opacity-70 cursor-not-allowed"
                        : "hover:shadow-md cursor-pointer"
                    }
                    ${
                      themeMode === theme.mode
                        ? "border-2 border-emerald-500"
                        : "border-slate-200/60 dark:border-[#343140]/60"
                    }`}
                  aria-label={`Switch to ${theme.title}`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none">
                    <theme.icon className="w-full h-full text-emerald-500" />
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                      <theme.icon className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {theme.title}
                      </span>
                      {themeMode === theme.mode && (
                        <span className="inline-flex mt-1 px-2.5 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-left">
                    {theme.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Additional appearance settings could go here */}
        </div>
      </div>
    </div>
  );
};
