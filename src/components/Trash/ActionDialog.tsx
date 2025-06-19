import React from "react";
import { Trash2, RefreshCw } from "lucide-react";
import { Modal } from "../Modal";

// Define action types
type ActionType = "delete" | "restore";
type Mode = "single" | "batch";

interface ActionDialogProps {
  filename?: string;
  setShowModal: (show: boolean) => void;
  handleSubmit: () => void;
  mode: Mode;
  setMode?: (mode: Mode) => void;
  showModal: boolean;
  isProcessing: boolean;
  actionType: ActionType;
  selectedItemsCount?: number; // Add this prop for showing count in batch mode
}

const ActionDialog: React.FC<ActionDialogProps> = ({
  filename,
  setShowModal,
  handleSubmit,
  mode,
  setMode,
  showModal,
  isProcessing,
  actionType,
  selectedItemsCount = 0,
}) => {
  const isBatchMode = mode === "batch";

  // Action specific configurations
  const actionConfig = {
    delete: {
      title: "Delete permanently",
      icon: Trash2,
      iconColor: "red",
      buttonClass: "bg-red-600 hover:bg-red-700",
      buttonText: isBatchMode ? "Empty trash" : "Delete",
      message: isBatchMode
        ? "Are you sure you want to empty trash and permanently delete all the items? You cannot undo this action."
        : `Are you sure you want to permanently delete "${filename}" from trash? You cannot undo this action.`,
    },
    restore: {
      title: "Restore from trash",
      icon: RefreshCw,
      iconColor: "green",
      buttonClass: "bg-emerald-600 hover:bg-emerald-700",
      buttonText: isBatchMode ? "Restore all items" : "Restore",
      message: isBatchMode
        ? `Are you sure you want to restore all ${selectedItemsCount} items from trash?`
        : `Are you sure you want to restore "${filename}" from trash?`,
    },
  };

  const config = actionConfig[actionType];

  const handleClose = () => {
    setShowModal(false);
    setMode?.("single");
  };

  return (
    <Modal
      isOpen={showModal}
      onClose={handleClose}
      title={config.title}
      icon={config.icon}
      iconColor={config.iconColor}
      preventCloseOnOutsideClick={isProcessing}
      footer={
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2934] rounded-lg transition-all duration-300 hover:scale-105 cursor-pointer"
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className={`px-6 py-2.5 text-sm font-medium ${config.buttonClass} text-white rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg cursor-pointer ${isProcessing ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {isProcessing ? "Processing..." : config.buttonText}
          </button>
        </div>
      }
    >
      <div className="p-8">
        <p className="text-gray-700 dark:text-gray-300 mb-8">
          {config.message}
        </p>
      </div>
    </Modal>
  );
};

export default ActionDialog;
