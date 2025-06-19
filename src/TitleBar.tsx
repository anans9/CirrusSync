import React, { useState, useRef, useEffect } from "react";
import { PanelLeft, PanelLeftOpen } from "lucide-react";
import { ThemeToggle } from "./components/ThemeToggle";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";
import UserMenuModal from "./components/UserMenuModal";
import { useDriveCache } from "./context/DriveManager";

interface TitleBarProps {
  onToggleMenu?: () => void;
  sidebarOpen?: boolean;
}

const TitleBar: React.FC<TitleBarProps> = ({ onToggleMenu, sidebarOpen }) => {
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const {
    clearDecryptionErrors,
    actions: { clear },
  } = useDriveCache();

  const handleLogout = async () => {
    try {
      // fire and forget
      await Promise.all([logout(), clearDecryptionErrors(), clear()]);
    } catch (error) {
    } finally {
      setShowUserMenu(false);
      navigate("/", { replace: true });
    }
  };

  const handleAccountSettings = () => {
    navigate("/settings");
    setShowUserMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsButtonRef.current &&
        !settingsButtonRef.current.contains(event.target as Node) &&
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="titlebar sticky top-0 z-50 w-full">
      <div
        data-tauri-drag-region
        className="h-8 w-full bg-emerald-700/90 dark:bg-[#0e0d12] backdrop-blur-md border-b border-slate-400/20 dark:border-[#343140] flex items-center justify-between px-3"
      >
        <div className="flex-1" />

        <div className="flex items-center space-x-3">
          {user && (
            <button
              onClick={onToggleMenu}
              className="p-1 hover:bg-emerald-800 dark:hover:bg-[#2c2934] rounded-md transition-all duration-200 hover:shadow-sm active:scale-95 app-region-no-drag cursor-pointer"
            >
              {sidebarOpen ? (
                <PanelLeftOpen className="w-5 h-5 text-white dark:text-gray-300 stroke-[1.5]" />
              ) : (
                <PanelLeft className="w-5 h-5 text-white dark:text-gray-300 stroke-[1.5]" />
              )}
            </button>
          )}
          <ThemeToggle />
          {user && (
            <div className="relative">
              <button
                ref={settingsButtonRef}
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="p-0.5 hover:bg-emerald-800/50 dark:hover:bg-[#2c2934] rounded-md transition-all duration-200 hover:shadow-sm active:scale-95 app-region-no-drag cursor-pointer"
              >
                <div
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-blue-500
                           dark:from-emerald-600 dark:to-blue-700 flex items-center justify-center text-white text-sm font-semibold"
                >
                  {user?.username.charAt(0).toUpperCase()}
                </div>
              </button>
              {showUserMenu && (
                <div ref={userMenuRef}>
                  <UserMenuModal
                    user={{
                      username: user?.username || "",
                      email: user?.email || "",
                    }}
                    onAccountSettings={handleAccountSettings}
                    onSignOut={handleLogout}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TitleBar;
