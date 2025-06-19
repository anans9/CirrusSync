import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState, useCallback, memo } from "react";
import { Modal } from "./Modal";
import { ApiService } from "../services/ApiService";
import keyManager from "../context/KeyManager";
import { useAuth } from "../context/AuthContext";
import { useDriveCache } from "../context/DriveManager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { downloadDir } from "@tauri-apps/api/path";
import { motion, AnimatePresence } from "framer-motion";

// Define the recovery method structure based on the API response
interface RecoveryMethodResponse {
  account_recovery: {
    email: {
      email: string | null;
      enabled: boolean;
      last_used: number | null;
      created_at: number;
      modified_at: number;
      email_verified: boolean;
    };
    phone: {
      phone: string | null;
      enabled: boolean;
      last_used: number | null;
      created_at: number;
      modified_at: number;
      phone_verified: boolean;
    };
  };
  data_recovery: {
    file: {
      enabled: boolean;
      last_used: number | null;
      created_at: number;
      modified_at: number;
      recovery_key: string | null;
      recovery_key_signature: string | null;
    };
    phrase: {
      enabled: boolean;
      last_used: number | null;
      created_at: number;
      modified_at: number;
    };
  };
  created_at: number;
  last_updated: number;
}

export type RecoveryMethod = RecoveryMethodResponse;

interface RecoveryPhraseModalProps {
  isOpen: boolean;
  onClose: () => void;
  recoveryPhrase?: string;
  recoveryMethod?: RecoveryMethod | null;
  setRecoveryMethod?: React.Dispatch<
    React.SetStateAction<RecoveryMethod | null>
  >;
  onContinue?: () => void;
  mode?: "generate" | "display";
  showContinueButton?: boolean;
  continueButtonText?: string;
  requireCopyToContinue?: boolean;
  title?: string;
}

// Loading skeleton component for better performance
const LoadingSkeleton = memo(() => (
  <div className="p-6 space-y-4">
    <div className="h-20 w-full bg-gray-50 dark:bg-[#2c2934] animate-pulse rounded-xl"></div>
    <div className="space-y-2">
      <div className="h-4 w-3/4 bg-gray-50 dark:bg-[#2c2934] animate-pulse rounded-md"></div>
      <div className="h-4 w-1/2 bg-gray-50 dark:bg-[#2c2934] animate-pulse rounded-md"></div>
    </div>
  </div>
));

export const RecoveryPhraseModal = ({
  isOpen,
  onClose,
  recoveryPhrase: initialRecoveryPhrase,
  recoveryMethod,
  setRecoveryMethod,
  onContinue,
  mode = initialRecoveryPhrase ? "display" : "generate",
  showContinueButton = true,
  continueButtonText = "Continue",
  requireCopyToContinue = true,
  title = mode === "generate" ? "Recovery Phrase" : "Account Created",
}: RecoveryPhraseModalProps) => {
  const [copied, setCopied] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [step, setStep] = useState(mode === "generate" ? "warning" : "phrase");
  const [revealed, setRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showGeneratedPhrase, setShowGeneratedPhrase] = useState(false);
  const { user, setUser, getSessionDerivedKey } = useAuth();
  const { decryptUserPrivateKey } = useDriveCache();

  // Reset states when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      setShowGeneratedPhrase(false);
      if (mode === "generate") {
        setPhrase("");
        setStep("warning");
        setRevealed(false);
      } else {
        setRevealed(false);
      }
    }
  }, [isOpen, mode]);

  const recoveryKeyValue =
    mode === "generate" ? phrase : initialRecoveryPhrase || "";

  // Memoized key generation function for better performance
  const handleProceed = useCallback(async () => {
    if (mode !== "generate") return;

    setStep("loading");
    setIsLoading(true);
    setShowGeneratedPhrase(false);

    try {
      const primaryKey = user?.keys.find((key) => key.primary);

      if (!primaryKey) {
        setIsLoading(false);
        return;
      }

      const [recoveryPhraseResponse, derivedKey, decryptedKey] =
        await Promise.all([
          keyManager.generateRecoveryKey(),
          getSessionDerivedKey({ userId: user?.id }),
          decryptUserPrivateKey(primaryKey.private_key),
        ]);

      const { passphraseEncrypted, passphraseEncryptedSignature } =
        await keyManager.encryptUserPrivateKeyPassphrase(
          String(derivedKey),
          recoveryPhraseResponse.seed,
          decryptedKey,
          String(user?.username),
          String(user?.email),
        );

      if (recoveryPhraseResponse) {
        // Update with the new structure
        await Promise.all([
          ApiService.updateUserKeys({
            id: primaryKey.id,
            passphrase: passphraseEncrypted,
            passphrase_signature: passphraseEncryptedSignature,
          }),
          ApiService.updateRecoveryMethods({
            data_recovery: {
              phrase: {
                enabled: true,
              },
            },
          }),
        ]);

        setUser((prev) => {
          if (!prev || !prev.keys) return prev;

          const updatedKeys = prev.keys.map((key) => {
            if (key.id === primaryKey.id) {
              return {
                ...key,
                passphrase: passphraseEncrypted,
                passphrase_signature: passphraseEncryptedSignature,
              };
            }
            return key;
          });

          return {
            ...prev,
            keys: updatedKeys,
          };
        });

        setPhrase(recoveryPhraseResponse.recovery_phrase);

        // Update the recoveryMethod state if provided
        if (setRecoveryMethod && recoveryMethod) {
          setRecoveryMethod((prevMethod) => {
            if (!prevMethod) return null;

            const updatedMethod = { ...prevMethod };
            const currentTime = Math.floor(Date.now() / 1000);

            // Update phrase settings
            updatedMethod.data_recovery.phrase.enabled = true;
            updatedMethod.data_recovery.phrase.modified_at = currentTime;
            updatedMethod.last_updated = currentTime;

            return updatedMethod;
          });
        }

        // Add a delay for a smooth transition experience
        setTimeout(() => {
          setStep("phrase");
          // Show the phrase with a slight delay for smoother transition
          setTimeout(() => {
            setShowGeneratedPhrase(true);
          }, 200);
        }, 500);
      }
    } catch (error) {
      console.error("Error generating recovery phrase:", error);
      onClose();
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    getSessionDerivedKey,
    decryptUserPrivateKey,
    mode,
    recoveryMethod,
    setRecoveryMethod,
    setUser,
    onClose,
  ]);

  const handleCopy = useCallback(async () => {
    if (!revealed) return;

    try {
      await navigator.clipboard.writeText(recoveryKeyValue);
      setCopied(true);

      if (!requireCopyToContinue) {
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error("Error copying to clipboard:", error);
    }
  }, [revealed, recoveryKeyValue, requireCopyToContinue]);

  const handleDownload = useCallback(async () => {
    if (!revealed) return;

    try {
      const filePath = await save({
        title: "Save Recovery Phrase",
        filters: [
          {
            name: "Text",
            extensions: ["txt"],
          },
        ],
        defaultPath: (await downloadDir()) + "/cloudsync_recovery.txt",
      });

      // If user selected a path, write the file
      if (filePath) {
        await writeTextFile(filePath, recoveryKeyValue);
      }
    } catch (error) {
      console.error("Error downloading recovery phrase:", error);
    }
  }, [revealed, recoveryKeyValue]);

  const handleContinue = useCallback(() => {
    if (requireCopyToContinue && !copied) return;
    if (onContinue) onContinue();
    else onClose();
  }, [requireCopyToContinue, copied, onContinue, onClose]);

  const getModalIcon = () => {
    if (mode === "display") return CheckCircle2;
    return ShieldCheck;
  };

  // Check if recovery method has an active recovery phrase
  const hasActiveRecoveryPhrase = recoveryMethod?.data_recovery.phrase.enabled;

  // Render the appropriate footer buttons based on the current state
  const renderFooter = useCallback(() => {
    if (mode === "generate" && step === "warning") {
      return (
        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            Cancel
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleProceed}
            className={`px-6 py-2.5 text-sm font-medium text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer ${
              !hasActiveRecoveryPhrase
                ? "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
            }`}
          >
            {!hasActiveRecoveryPhrase ? "Generate Phrase" : "Replace Phrase"}
          </motion.button>
        </div>
      );
    }

    if (mode === "generate" && step === "phrase" && showContinueButton) {
      return (
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            Close
          </motion.button>
        </div>
      );
    }

    if (mode === "display" && showContinueButton) {
      return (
        <div className="w-full">
          <motion.button
            whileHover={requireCopyToContinue && !copied ? {} : { scale: 1.02 }}
            whileTap={requireCopyToContinue && !copied ? {} : { scale: 0.98 }}
            onClick={handleContinue}
            disabled={requireCopyToContinue && !copied}
            className={`w-full px-4 py-3 text-sm font-medium text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 shadow-sm ${
              requireCopyToContinue && !copied
                ? "bg-emerald-400 dark:bg-emerald-700/50 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 cursor-pointer"
            }`}
          >
            {continueButtonText}
          </motion.button>
        </div>
      );
    }

    return null;
  }, [
    mode,
    step,
    showContinueButton,
    requireCopyToContinue,
    copied,
    hasActiveRecoveryPhrase,
    onClose,
    handleProceed,
    handleContinue,
    continueButtonText,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={getModalIcon()}
      iconColor="emerald"
      footer={renderFooter()}
    >
      <AnimatePresence mode="wait">
        {mode === "generate" && step === "warning" && (
          <motion.div
            key="warning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-6 space-y-6"
          >
            <div
              className={`p-4 ${
                !hasActiveRecoveryPhrase
                  ? "bg-emerald-50 dark:bg-emerald-900/20"
                  : "bg-red-50 dark:bg-red-900/20"
              } rounded-xl`}
            >
              <div className="flex items-start gap-3">
                {!hasActiveRecoveryPhrase ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-500 flex-shrink-0" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-red-600 dark:text-red-500 flex-shrink-0" />
                )}
                <div className="space-y-2">
                  {!hasActiveRecoveryPhrase ? (
                    <>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                        Generate New Recovery Phrase
                      </p>
                      <p className="text-sm text-emerald-600 dark:text-emerald-300">
                        This recovery phrase will help you regain access to your
                        data if you forget your password. Make sure to save it
                        securely.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        Warning: This will replace your existing recovery phrase
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-300">
                        Generating a new recovery phrase will replace your
                        existing recovery phrase. Make sure to save the new
                        phrase securely.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {mode === "generate" && step === "loading" && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LoadingSkeleton />
          </motion.div>
        )}

        {((mode === "generate" && step === "phrase") || mode === "display") && (
          <motion.div
            key="phrase"
            initial={{ opacity: 0 }}
            animate={{
              opacity: showGeneratedPhrase || mode === "display" ? 1 : 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="p-6 space-y-6"
          >
            {(mode === "generate" || mode === "display") && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0" />
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    Please keep it safe. You'll need it to access your data if
                    you forget your password.
                  </p>
                </div>
              </div>
            )}
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                {initialRecoveryPhrase
                  ? "Your Recovery Phrase"
                  : "Recovery Phrase"}
              </h4>
              <motion.div
                className={`relative rounded-xl overflow-hidden transition-all ${
                  !revealed &&
                  "cursor-pointer hover:ring-2 hover:ring-emerald-500"
                }`}
                onClick={() => !revealed && setRevealed(true)}
                layoutId="recovery-phrase-container"
              >
                <div className="p-6 bg-gray-50 dark:bg-[#2c2934] rounded-xl h-32 relative">
                  <AnimatePresence>
                    {revealed && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute top-4 right-4 flex gap-2"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy();
                          }}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-[#1c1b23] hover:bg-gray-200 dark:hover:bg-[#343140] transition-colors cursor-pointer"
                          title="Copy to clipboard"
                        >
                          {copied ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload();
                          }}
                          className="p-2 rounded-lg bg-gray-100 dark:bg-[#1c1b23] hover:bg-gray-200 dark:hover:bg-[#343140] transition-colors cursor-pointer"
                          title="Download recovery phrase"
                        >
                          <Download className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <motion.div
                    className={`font-mono text-base text-gray-900 dark:text-white transition-all duration-300 h-full overflow-y-auto pr-20 ${
                      !revealed && "blur-md select-none"
                    }`}
                    layoutId="recovery-phrase-text"
                  >
                    {recoveryKeyValue}
                  </motion.div>
                </div>
                {!revealed && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center bg-gray-50/70 dark:bg-[#2c2934]/70 backdrop-blur-sm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#1c1b23] rounded-lg shadow-lg hover:bg-gray-200 dark:hover:bg-[#343140] cursor-pointer transition-colors">
                      <Eye className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Click to Reveal
                      </span>
                    </button>
                  </motion.div>
                )}
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Modal>
  );
};
