import React, { useState } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Modal } from "../Modal";
import { motion, AnimatePresence } from "framer-motion";

interface DisableFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  featureTitle: string;
  featureType: "security" | "mfa";
  isProcessing?: boolean;
}

const DisableFeatureModal: React.FC<DisableFeatureModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  featureTitle,
  featureType,
  isProcessing: externalProcessing,
}) => {
  const [internalProcessing, setInternalProcessing] = useState(false);

  // Use either external or internal processing state
  const isProcessing =
    externalProcessing !== undefined ? externalProcessing : internalProcessing;

  const getWarningMessage = () => {
    if (featureType === "security") {
      return `Disabling ${featureTitle} reduces your account's security level. Are you sure you want to continue?`;
    } else if (featureType === "mfa") {
      return `Disabling ${featureTitle} will make your account less secure. Without this additional verification step, it may be easier for unauthorized users to access your account.`;
    }
    return "Are you sure you want to disable this feature?";
  };

  const handleConfirm = async () => {
    if (isProcessing) return;

    setInternalProcessing(true);
    try {
      await onConfirm();
    } finally {
      setInternalProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Disable ${featureTitle}?`}
      icon={AlertTriangle}
      iconColor="red"
      preventCloseOnOutsideClick={true}
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] rounded-lg transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={!isProcessing ? { scale: 1.02 } : {}}
            whileTap={!isProcessing ? { scale: 0.98 } : {}}
            onClick={handleConfirm}
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </>
            ) : (
              "Yes, Disable It"
            )}
          </motion.button>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="disable-feature-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="px-6 py-6"
        >
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6"
            >
              <ShieldAlert className="h-8 w-8 text-red-500" />
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-lg font-medium text-gray-900 dark:text-white mb-4 text-center"
            >
              Are you sure you want to disable {featureTitle}?
            </motion.h3>

            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4 mb-6 w-full"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  {getWarningMessage()}
                </p>
              </div>
            </motion.div>

            {featureType === "mfa" && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg p-4 w-full mb-6"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      Multi-factor authentication is a critical security feature
                      that protects your account from unauthorized access.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.p
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-gray-500 dark:text-gray-400 text-center"
            >
              You can re-enable this feature at any time from your security
              settings.
            </motion.p>
          </div>
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
};

export default DisableFeatureModal;
