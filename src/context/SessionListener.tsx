import { useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";

/**
 * SessionListener component listens for global session events
 * and manages authentication state accordingly.
 */
const SessionListener = () => {
  // Safe access to auth context with early return if not available
  const authContext = useContext(AuthContext);
  
  // If auth context isn't available yet, render nothing and don't try to use it
  if (!authContext) {
    return null;
  }
  
  const { logout } = authContext;
  
  useEffect(() => {
    // Handle session expiration
    const handleSessionExpired = () => {
      setTimeout(() => {
        logout().catch(error => {
          console.error("Error during logout after session expiration:", error);
        });
      }, 0);
    };
    
    // Listen for session expiration events dispatched by the API service
    window.addEventListener("sessionExpired", handleSessionExpired);
    
    // Clean up the listener when the component unmounts
    return () => {
      window.removeEventListener("sessionExpired", handleSessionExpired);
    };
  }, [logout]);
  
  // This component doesn't render anything
  return null;
};

export default SessionListener;