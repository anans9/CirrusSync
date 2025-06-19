import { AlertTriangle, ShieldOff } from "lucide-react";
import { useState } from "react";
import { ApiService } from "../../services/ApiService";
import { Modal } from "../Modal";
import { motion, AnimatePresence } from "framer-motion";

interface RecoveryMethodUpdate {
  account_recovery?: {
    email?: {
      enabled: boolean;
      email: null;
      email_verified: boolean;
    };
    phone?: {
      enabled: boolean;
      phone: null;
      phone_verified: boolean;
    };
  };
  data_recovery?: {
    phrase?: {
      enabled: boolean;
    };
    file?: {
      enabled: boolean;
      recovery_key: null;
      recovery_key_signature: null;
    };
  };
}

interface DisableRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "email" | "phone" | "phrase" | "file";
  onConfirm: () => void;
  setRecoveryMethod?: React.Dispatch<
    React.SetStateAction<RecoveryMethod | null>
  >;
}

export const DisableRecoveryModal = ({
  isOpen,
  onClose,
  type,
  onConfirm,
  setRecoveryMethod,
}: DisableRecoveryModalProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const titles = {
    email: "Recovery Email",
    phone: "Recovery Phone",
    phrase: "Recovery Phrase",
    file: "Recovery File",
  };

  const descriptions = {
    email: {
      main: "This will disable your recovery email. You won't be able to use it for account recovery.",
      secondary: "You can add a new recovery email later if needed.",
    },
    phone: {
      main: "This will disable your recovery phone. You won't be able to use it for account recovery.",
      secondary: "You can add a new recovery phone later if needed.",
    },
    phrase: {
      main: "This will disable your recovery phrase. You won't be able to use it to recover your data if you forget your password.",
      secondary:
        "Enabling recovery by phrase again will generate a new recovery phrase.",
    },
    file: {
      main: "This will disable your recovery file. You won't be able to use it to recover your data if you forget your password.",
      secondary:
        "Enabling recovery by file again will generate a new recovery file.",
    },
  };

  const handleDisable = async () => {
    setIsProcessing(true);
    try {
      // Create payload based on type and new API structure
      let payload: RecoveryMethodUpdate = {};

      // Add a timestamp for modified_at
      const currentTime = Math.floor(Date.now() / 1000);

      switch (type) {
        case "email":
          payload = {
            account_recovery: {
              email: {
                enabled: false,
                email: null,
                email_verified: false,
              },
            },
          };
          break;
        case "phone":
          payload = {
            account_recovery: {
              phone: {
                enabled: false,
                phone: null,
                phone_verified: false,
              },
            },
          };
          break;
        case "phrase":
          payload = {
            data_recovery: {
              phrase: {
                enabled: false,
              },
            },
          };
          break;
        case "file":
          payload = {
            data_recovery: {
              file: {
                enabled: false,
                recovery_key: null,
                recovery_key_signature: null,
              },
            },
          };
          break;
      }

      // Call API with the constructed payload
      await ApiService.updateRecoveryMethods(payload);

      // Update local state based on the type
      setRecoveryMethod?.((prev) => {
        if (!prev) return null;

        const updatedMethod = { ...prev };

        switch (type) {
          case "email":
            updatedMethod.account_recovery.email.enabled = false;
            updatedMethod.account_recovery.email.email = null;
            updatedMethod.account_recovery.email.email_verified = false;
            updatedMethod.account_recovery.email.modified_at = Math.floor(
              Date.now() / 1000,
            );
            break;
          case "phone":
            updatedMethod.account_recovery.phone.enabled = false;
            updatedMethod.account_recovery.phone.phone = null;
            updatedMethod.account_recovery.phone.phone_verified = false;
            updatedMethod.account_recovery.phone.modified_at = Math.floor(
              Date.now() / 1000,
            );
            break;
          case "phrase":
            updatedMethod.data_recovery.phrase.enabled = false;
            updatedMethod.data_recovery.phrase.modified_at = Math.floor(
              Date.now() / 1000,
            );
            break;
          case "file":
            updatedMethod.data_recovery.file.enabled = false;
            updatedMethod.data_recovery.file.recovery_key = null;
            updatedMethod.data_recovery.file.recovery_key_signature = null;
            updatedMethod.data_recovery.file.modified_at = Math.floor(
              Date.now() / 1000,
            );
            break;
        }

        updatedMethod.last_updated = Math.floor(Date.now() / 1000);
        return updatedMethod;
      });

      onConfirm();
    } catch (error) {
      console.error(`Error disabling ${type}:`, error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Disable ${titles[type]}`}
      icon={AlertTriangle}
      iconColor="amber"
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
            onClick={handleDisable}
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
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
              `Disable ${titles[type]}`
            )}
          </motion.button>
        </div>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key="disable-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="p-6"
        >
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6"
            >
              <ShieldOff className="h-8 w-8 text-red-500" />
            </motion.div>

            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 text-center">
              Are you sure you want to disable your {titles[type].toLowerCase()}
              ?
            </h3>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4 mb-6 w-full">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {descriptions[type].main}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {descriptions[type].secondary}
                  </p>
                </div>
              </div>
            </div>

            {type === "phrase" && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg p-4 w-full">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Without a recovery phrase, you may permanently lose access
                    to your encrypted data if you forget your password.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </Modal>
  );
};
