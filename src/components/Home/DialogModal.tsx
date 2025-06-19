import React, { useEffect } from "react";
import { FolderPlus, Edit } from "lucide-react";
import { Modal } from "../Modal";
import { motion } from "framer-motion";

type ModalMode = "edit" | "new";

interface DialogProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  modalMode: ModalMode;
  setShowModal: (show: boolean) => void;
  showModal: boolean;
  handleCreateSubmit: (e: React.FormEvent) => void;
  isProcessing: boolean;
}

const Dialog: React.FC<DialogProps> = ({
  inputValue,
  setInputValue,
  modalMode,
  setShowModal,
  showModal,
  handleCreateSubmit,
  isProcessing,
}) => {
  const handleClose = () => {
    setShowModal(false);
  };

  // Track input validity
  const [isValid, setIsValid] = React.useState(false);

  // Update validity when input changes
  useEffect(() => {
    setIsValid(inputValue.trim().length > 0);
  }, [inputValue]);

  // Handle key press for submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid) {
      e.preventDefault();
      handleCreateSubmit(e as unknown as React.FormEvent);
    }
  };

  const icon = modalMode === "edit" ? Edit : FolderPlus;
  const title = modalMode === "edit" ? "Edit name" : "Create new folder";

  return (
    <Modal
      isOpen={showModal}
      onClose={handleClose}
      title={title}
      icon={icon}
      iconColor="emerald"
      footer={
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <motion.button
            type="button"
            onClick={handleClose}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            Cancel
          </motion.button>

          <motion.button
            type="submit"
            form="folder-form"
            disabled={!isValid && isProcessing}
            whileHover={isValid ? { scale: 1.02 } : {}}
            whileTap={isValid ? { scale: 0.98 } : {}}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm cursor-pointer ${
              isValid && !isProcessing
                ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white"
                : "bg-emerald-600 dark:bg-emerald-600 opacity-70 text-white disabled:cursor-not-allowed"
            }`}
          >
            {isProcessing
              ? "Processing..."
              : modalMode === "edit"
                ? "Save changes"
                : "Create folder"}
          </motion.button>
        </div>
      }
      preventCloseOnOutsideClick={isProcessing}
    >
      <form id="folder-form" onSubmit={handleCreateSubmit} noValidate>
        <div className="p-6 sm:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <label
              htmlFor="folder-name-input"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              {modalMode === "edit" ? "New name" : "Folder name"}
            </label>
            <input
              id="folder-name-input"
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                modalMode === "edit"
                  ? "Enter a new name"
                  : "Enter a new folder name"
              }
              autoFocus
              className="w-full bg-gray-50/50 dark:bg-[#0e0d12]/50 border border-slate-200/60 dark:border-[#343140]/60 rounded-lg px-4 py-3 text-gray-900 dark:text-white transition-all duration-200 outline-none focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-600 focus:border-transparent"
            />
          </motion.div>

          {/* Additional info if needed */}
          {modalMode === "new" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mt-3 text-xs text-gray-500 dark:text-gray-400"
            >
              Create a new folder in your drive.
            </motion.p>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default Dialog;
