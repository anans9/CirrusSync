import React from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Modal } from "../Modal";
import { motion } from "framer-motion";

interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isProcessing?: boolean;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
}) => {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Account"
      icon={Trash2}
      iconColor="red"
      footer={
        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
            disabled={isProcessing}
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={!isProcessing ? { scale: 1.02 } : {}}
            whileTap={!isProcessing ? { scale: 0.98 } : {}}
            type="button"
            onClick={handleConfirm}
            className="px-6 py-2.5 text-sm font-medium bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer flex items-center gap-2"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
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
              "Delete Account"
            )}
          </motion.button>
        </div>
      }
    >
      <div className="p-6">
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Are you sure you want to delete your account? This action cannot be
          undone.
        </p>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700 dark:text-red-400">
              <p className="font-medium mb-1">Warning</p>
              <p>
                Deleting your account will permanently remove all your data,
                including:
              </p>
              <ul className="list-disc ml-4 mt-2 space-y-1">
                <li>Personal profile information</li>
                <li>All projects and associated data</li>
                <li>API keys and integrations</li>
                <li>Usage history and analytics</li>
                <li>Billing information</li>
              </ul>
              <p className="mt-2">
                This action is irreversible and cannot be recovered through
                customer support.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 dark:bg-[#2c2934] dark:border-[#343140]"
              required
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              I understand that deleting my account is permanent and cannot be
              undone.
            </span>
          </label>
        </div>
      </div>
    </Modal>
  );
};

export default DeleteAccountModal;
