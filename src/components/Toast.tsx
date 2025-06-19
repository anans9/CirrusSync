import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Toast = ({
  toastMessage,
  setToastMessage,
  setShowToast,
  onUndo,
  showUndo = false,
  duration = 5000
}: ToastMessageProps) => {
  if (!toastMessage?.text) return null;

  useEffect(() => {
    const timer = setTimeout(() => {
      setToastMessage({ text: "", type: "success" });
      setShowToast(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [toastMessage, setShowToast, setToastMessage, duration]);

  const handleDismiss = () => {
    setToastMessage({ text: "", type: "success" });
    setShowToast(false);
  };

  // Color configurations based on toast type
  const getToastColors = () => {
    switch (toastMessage.type) {
      case "success":
        return {
          bg: "bg-white dark:bg-emerald-950",
          text: "text-emerald-900 dark:text-emerald-50",
          border: "border-emerald-200 dark:border-emerald-800",
          dot: "bg-emerald-500 dark:bg-emerald-400",
          button: "text-emerald-600 dark:text-emerald-300 hover:text-emerald-700 dark:hover:text-emerald-200",
          dismissButton: "text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300"
        };
      case "error":
        return {
          bg: "bg-white dark:bg-rose-950",
          text: "text-rose-900 dark:text-rose-50", 
          border: "border-rose-200 dark:border-rose-800",
          dot: "bg-rose-500 dark:bg-rose-400",
          button: "text-rose-600 dark:text-rose-300 hover:text-rose-700 dark:hover:text-rose-200",
          dismissButton: "text-rose-400 hover:text-rose-600 dark:hover:text-rose-300"
        };
      case "warning":
        return {
          bg: "bg-white dark:bg-amber-950",
          text: "text-amber-900 dark:text-amber-50",
          border: "border-amber-200 dark:border-amber-800",
          dot: "bg-amber-500 dark:bg-amber-400",
          button: "text-amber-600 dark:text-amber-300 hover:text-amber-700 dark:hover:text-amber-200",
          dismissButton: "text-amber-400 hover:text-amber-600 dark:hover:text-amber-300"
        };
      case "caution":
        return {
          bg: "bg-white dark:bg-yellow-950",
          text: "text-yellow-900 dark:text-yellow-50",
          border: "border-yellow-200 dark:border-yellow-800",
          dot: "bg-yellow-500 dark:bg-yellow-400",
          button: "text-yellow-600 dark:text-yellow-300 hover:text-yellow-700 dark:hover:text-yellow-200",
          dismissButton: "text-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-300"
        };
      case "info":
        return {
          bg: "bg-white dark:bg-blue-950",
          text: "text-blue-900 dark:text-blue-50",
          border: "border-blue-200 dark:border-blue-800",
          dot: "bg-blue-500 dark:bg-blue-400",
          button: "text-blue-600 dark:text-blue-300 hover:text-blue-700 dark:hover:text-blue-200",
          dismissButton: "text-blue-400 hover:text-blue-600 dark:hover:text-blue-300"
        };
      default:
        return {
          bg: "bg-white dark:bg-gray-800",
          text: "text-gray-900 dark:text-gray-100",
          border: "border-gray-200 dark:border-gray-700",
          dot: "bg-gray-500 dark:bg-gray-400",
          button: "text-gray-600 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200",
          dismissButton: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        };
    }
  };

  const colors = getToastColors();

  // Icon based on toast type
  const getToastIcon = () => {
    switch (toastMessage.type) {
      case "success":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case "error":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case "warning":
      case "caution":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case "info":
        return (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 102 0v-5a1 1 0 00-2 0v5z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {toastMessage.text && (
        <motion.div
          className="fixed inset-x-0 bottom-6 flex justify-center items-center z-[9999]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
            mass: 1
          }}
        >
          <motion.div
            className={`
              shadow-lg rounded-lg px-4 py-3 max-w-md w-full
              flex items-center justify-between gap-3
              border ${colors.border}
              ${colors.bg}
              ${colors.text}
            `}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
          >
            <motion.div
              className="flex items-center gap-3 flex-1"
              initial={{ x: -5, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <motion.div
                className={`flex-shrink-0 ${colors.text}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  delay: 0.2
                }}
              >
                {getToastIcon()}
              </motion.div>
              <motion.span
                className="text-sm font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {toastMessage.text}
              </motion.span>
            </motion.div>

            <div className="flex items-center gap-2">
              {showUndo && onUndo && (
                <motion.button
                  onClick={onUndo}
                  className={`text-xs font-medium ${colors.button} transition-colors`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Undo
                </motion.button>
              )}

              <motion.button
                onClick={handleDismiss}
                className={`p-1 ${colors.dismissButton} transition-colors focus:outline-none`}
                aria-label="Dismiss"
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;