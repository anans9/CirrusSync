import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

// Define the context type
type AppTitleContextType = {
  title: string;
  setTitle: (newTitle: string) => Promise<void>;
  baseTitle: string;
  setBaseTitle: (baseTitle: string) => void;
};

// Create the context with default values
const AppTitleContext = createContext<AppTitleContextType>({
  title: "CirrusSync",
  setTitle: async () => {},
  baseTitle: "CirrusSync",
  setBaseTitle: () => {},
});

// Hook to use the title context
export const useAppTitle = () => useContext(AppTitleContext);

// Provider component
export const AppTitleProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [title, setTitleState] = useState("CirrusSync");
  const [baseTitle, setBaseTitleState] = useState("CirrusSync");

  // Use ref to avoid multiple API calls
  const updatePendingRef = useRef(false);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update the window title when our title state changes
  useEffect(() => {
    if (updatePendingRef.current) return;

    const updateWindowTitle = async () => {
      try {
        updatePendingRef.current = true;
        await getCurrentWindow().setTitle(title);
        if (isMountedRef.current) {
          updatePendingRef.current = false;
        }
      } catch (error) {
        console.error("Failed to update window title:", error);
        updatePendingRef.current = false;
      }
    };

    updateWindowTitle();
  }, [title]);

  // Method to set the window title
  const setTitle = async (newTitle: string) => {
    try {
      await getCurrentWindow().setTitle(newTitle);
      if (isMountedRef.current) {
        setTitleState(newTitle);
      }
    } catch (error) {
      console.error("Failed to set window title:", error);
    }
  };

  // Method to set the base application title
  const setBaseTitle = (newBaseTitle: string) => {
    setBaseTitleState(newBaseTitle);
    // When base title changes, update the window title
    setTitleState(newBaseTitle);
  };

  return (
    <AppTitleContext.Provider
      value={{
        title,
        setTitle,
        baseTitle,
        setBaseTitle,
      }}
    >
      {children}
    </AppTitleContext.Provider>
  );
};
