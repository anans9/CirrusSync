import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";

/**
 * Custom hook for managing Tauri event listeners
 * Optimized for React 19 with singleton registration pattern
 */
export function useTauriEventListeners() {
  // Track registered listeners by name to prevent duplicates
  const registeredListeners = useRef(new Set<string>());

  // Track unlisten functions for cleanup
  const unlistenFunctions = useRef(new Map<string, () => void>());

  // Track pending registrations to prevent race conditions
  const pendingRegistrations = useRef(new Map<string, Promise<() => void>>());

  // Track component mounted state
  const isMounted = useRef(false);

  // Set mounted flag and clean up on unmount
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;

      // Clean up all listeners on unmount
      unlistenFunctions.current.forEach((unlisten) => {
        try {
          unlisten();
        } catch (error) {
          // Ignore errors during cleanup
        }
      });

      unlistenFunctions.current.clear();
      registeredListeners.current.clear(); // Fixed: Added .current
      pendingRegistrations.current.clear();
    };
  }, []);

  /**
   * Register an event listener with singleton behavior
   * @param name Unique identifier for this listener
   * @param eventName The Tauri event name to listen for
   * @param handler The event handler callback
   * @returns A cleanup function
   */
  const registerListener = async <T>(
    name: string,
    eventName: string,
    handler: (event: { payload: T }) => void | Promise<void>,
  ): Promise<() => void> => {
    // If already registered, return early with a no-op cleanup
    if (registeredListeners.current.has(name)) {
      return () => {};
    }

    // If registration is pending, wait for it to complete
    if (pendingRegistrations.current.has(name)) {
      try {
        return await pendingRegistrations.current.get(name)!;
      } catch (error) {
        // If pending registration failed, we'll try again
      }
    }

    // Create and store registration promise
    const registrationPromise = (async () => {
      try {
        // Mark as registered early to prevent race conditions
        registeredListeners.current.add(name);

        // Register the actual listener
        const unlisten = await listen<T>(eventName, (event) => {
          // Only call handler if component is still mounted
          if (isMounted.current) {
            handler(event);
          }
        });

        // If component unmounted during registration, cleanup immediately
        if (!isMounted.current) {
          unlisten();
          return () => {};
        }

        // Store unlisten function for later cleanup
        unlistenFunctions.current.set(name, unlisten);

        // Return cleanup function
        return () => {
          if (unlistenFunctions.current.has(name)) {
            const cleanup = unlistenFunctions.current.get(name)!;
            cleanup();
            unlistenFunctions.current.delete(name);
            registeredListeners.current.delete(name);
          }
        };
      } catch (error) {
        // Registration failed, remove from tracking
        registeredListeners.current.delete(name);
        throw error;
      } finally {
        // Always remove from pending regardless of outcome
        pendingRegistrations.current.delete(name);
      }
    })();

    // Store registration promise
    pendingRegistrations.current.set(name, registrationPromise);

    // Wait for and return result
    return registrationPromise;
  };

  /**
   * Clean up a specific listener by name
   */
  const cleanupListener = (name: string): void => {
    if (unlistenFunctions.current.has(name)) {
      const unlisten = unlistenFunctions.current.get(name)!;
      try {
        unlisten();
      } catch (error) {
        // Ignore errors during cleanup
      }
      unlistenFunctions.current.delete(name);
      registeredListeners.current.delete(name);
    }
  };

  /**
   * Clean up all registered listeners
   */
  const cleanupAllListeners = (): void => {
    unlistenFunctions.current.forEach((unlisten, name) => {
      try {
        unlisten();
      } catch (error) {
        // Ignore errors during cleanup
      }
      unlistenFunctions.current.delete(name);
      registeredListeners.current.delete(name);
    });
  };

  return {
    registerListener,
    cleanupListener,
    cleanupAllListeners,
  };
}

export default useTauriEventListeners;
