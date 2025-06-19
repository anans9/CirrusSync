import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

// Animation variants for better performance
const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalContentVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  footer: React.ReactNode; // Footer content (typically buttons)
  iconColor?: string;
  maxWidth?: string;
  preventCloseOnOutsideClick?: boolean;
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  icon: Icon,
  children,
  footer,
  iconColor = "emerald",
  maxWidth = "lg:max-w-2xl",
  preventCloseOnOutsideClick = false,
}: ModalProps) => {
  const modalContentRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if the click is outside the modal content and if we should close on outside click
      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(e.target as Node) &&
        !preventCloseOnOutsideClick
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !preventCloseOnOutsideClick) {
        onClose();
      }
    };

    // Lock body scroll when modal is open
    if (isOpen && user) {
      document.body.style.overflow = "hidden";
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    // Clean up event listeners and restore scroll
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, preventCloseOnOutsideClick, user]);

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="modal-backdrop"
        variants={modalBackdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[9999] bg-black/20 dark:bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
      >
        <motion.div
          ref={modalContentRef}
          key="modal-content"
          variants={modalContentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className={`bg-white dark:bg-[#1c1b23] rounded-xl w-full max-w-xl ${maxWidth} flex flex-col max-h-[calc(100vh-2rem)] shadow-xl overflow-hidden`}
        >
          {/* Fixed header */}
          <div className="flex justify-between items-center p-6 border-b border-slate-200/60 dark:border-[#343140]/60 shrink-0">
            <div className="flex items-center gap-3">
              <Icon className={`w-6 h-6 text-${iconColor}-500`} />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white truncate">
                {title}
              </h3>
            </div>
            {user && !preventCloseOnOutsideClick && (
              <motion.button
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 cursor-pointer flex-shrink-0"
              >
                <X className="w-6 h-6" />
              </motion.button>
            )}
            {user && preventCloseOnOutsideClick && (
              <div className="w-6 h-6"></div>
            )}
          </div>

          {/* Scrollable content area */}
          <div className="overflow-y-auto flex-1">{children}</div>

          {/* Fixed footer for buttons */}
          <div className="border-t border-slate-200/60 dark:border-[#343140]/60 p-6 shrink-0">
            {footer}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
