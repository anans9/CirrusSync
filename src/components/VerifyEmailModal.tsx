import { ShieldCheck } from "lucide-react";
import { Modal } from "./Modal";
import { useEffect, useState } from "react";
import { ApiService } from "../services/ApiService";
import { motion } from "framer-motion";

interface VerifyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "email" | "phone";
  value: string;
  onSubmit: (code: string) => void;
  isRecovery?: boolean;
  setRecoveryMethod?: React.Dispatch<
    React.SetStateAction<RecoveryMethod | null>
  >;
}

export const VerifyEmailModal = ({
  isOpen,
  onClose,
  type,
  value,
  onSubmit,
  isRecovery = true,
  setRecoveryMethod,
}: VerifyEmailModalProps) => {
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!code || code.length !== 6) return;
    setIsVerifying(true);
    setError(null);

    try {
      // First, verify the code is valid
      const verifyResponse = await ApiService.verifyRecoveryContact(
        type,
        value,
        code,
      );

      if (verifyResponse.code !== 1000) {
        // If verification failed
        setError("Invalid verification code. Please try again.");
        setIsVerifying(false);
        return;
      }

      // If verification succeeded, update the recovery method
      const updateData: RecoveryMethodUpdate = {
        account_recovery: {
          [type]: {
            [`${type}_verified`]: true,
          },
        },
      };

      await ApiService.updateRecoveryMethods(updateData);

      // Notify parent component
      if (onSubmit) onSubmit(code);
    } catch (error) {
      console.error("Verification error:", error);
      setError("Failed to verify the code. Please try again.");

      // If verification fails, reset the recovery contact value
      if (isRecovery) {
        try {
          const resetData: RecoveryMethodUpdate = {
            account_recovery: {
              [type]: {
                enabled: false,
                [type]: null,
                [`${type}_verified`]: false,
              },
            },
          };

          await ApiService.updateRecoveryMethods(resetData);

          // Also update local state through setRecoveryMethod
          if (setRecoveryMethod) {
            updateLocalRecoveryMethod(false, null, false);
          }
        } catch (resetError) {
          console.error("Error resetting recovery contact:", resetError);
        }
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Helper function to update local RecoveryMethod state
  const updateLocalRecoveryMethod = (
    enabled: boolean,
    value: string | null,
    verified: boolean,
  ) => {
    if (!setRecoveryMethod) return;

    const currentTime = Math.floor(Date.now() / 1000);

    setRecoveryMethod((prev) => {
      if (!prev) return null;

      const updated = { ...prev };

      if (type === "email") {
        updated.account_recovery.email.enabled = enabled;
        updated.account_recovery.email.email = value;
        updated.account_recovery.email.email_verified = verified;
        updated.account_recovery.email.modified_at = currentTime;
      } else {
        updated.account_recovery.phone.enabled = enabled;
        updated.account_recovery.phone.phone = value;
        updated.account_recovery.phone.phone_verified = verified;
        updated.account_recovery.phone.modified_at = currentTime;
      }

      updated.last_updated = currentTime;
      return updated;
    });
  };

  // Handle cancel action - reset the state back to original
  const handleCancel = async () => {
    // If in recovery mode, reset the recovery contact value
    if (isRecovery) {
      setIsVerifying(true);
      try {
        const resetData: RecoveryMethodUpdate = {
          account_recovery: {
            [type]: {
              enabled: false,
              [type]: null,
              [`${type}_verified`]: false,
            },
          },
        };

        // Make API call to reset the recovery method
        await ApiService.updateRecoveryMethods(resetData);

        // Also update local state through setRecoveryMethod
        if (setRecoveryMethod) {
          updateLocalRecoveryMethod(false, null, false);
        }
      } catch (resetError) {
        console.error(
          "Error resetting recovery contact on cancel:",
          resetError,
        );
      } finally {
        setIsVerifying(false);
        onClose();
      }
    } else {
      // If not in recovery mode, just close the modal
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTimeLeft(300);
      setCode("");
      setError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  useEffect(() => {
    const handleKeyEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (isRecovery) {
          handleVerify();
        } else {
          onSubmit?.(code);
        }
      } else if (e.key === "Escape") {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyEnter);

    return () => {
      window.removeEventListener("keydown", handleKeyEnter);
    };
  }, [code, isRecovery, onSubmit]);

  const handleResendCode = async () => {
    setError(null);
    try {
      // Send verification code again
      if (type === "email") {
        await ApiService.sendVerificationCode("email", value);
      } else {
        await ApiService.sendVerificationCode("phone", value);
      }

      // Reset timer
      setTimeLeft(300);
    } catch (error) {
      console.error(`Failed to resend ${type} verification code:`, error);
      setError(`Failed to send verification code. Please try again later.`);
    }
  };

  const title = isRecovery
    ? `Verify ${type === "email" ? "Recovery Email" : "Recovery Phone"}`
    : `Verify ${type === "email" ? "Email" : "Phone"}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title={title}
      icon={ShieldCheck}
      footer={
        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCancel}
            disabled={isVerifying}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </motion.button>

          <motion.button
            whileHover={
              code.length === 6 && !isVerifying ? { scale: 1.02 } : {}
            }
            whileTap={code.length === 6 && !isVerifying ? { scale: 0.98 } : {}}
            onClick={isRecovery ? handleVerify : () => onSubmit?.(code)}
            disabled={code.length !== 6 || isVerifying}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              code.length === 6 && !isVerifying
                ? "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white cursor-pointer"
                : "bg-gray-100 dark:bg-[#4a4658] text-gray-400 cursor-not-allowed"
            }`}
          >
            {isVerifying ? "Verifying..." : "Verify"}
          </motion.button>
        </div>
      }
    >
      <div className="p-6 space-y-6">
        <div className="py-2 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="space-y-1 w-full">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                For your security, we sent a verification code to your{" "}
                {isRecovery
                  ? type === "email"
                    ? "recovery email"
                    : "recovery phone number"
                  : type === "email"
                    ? "email"
                    : "phone number"}
                :
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                {value}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                To verify it belongs to you, enter the 6-digit code below.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-900 dark:text-white">
              Verification Code
            </label>
            {timeLeft > 0 ? (
              <span className="text-sm text-gray-500">
                Resend code in {Math.floor(timeLeft / 60)}:
                {(timeLeft % 60).toString().padStart(2, "0")}
              </span>
            ) : (
              <button
                onClick={handleResendCode}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 cursor-pointer"
              >
                Resend code
              </button>
            )}
          </div>
          <input
            type="text"
            value={code}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              if (value.length <= 6) setCode(value);
              if (error) setError(null);
            }}
            maxLength={6}
            className={`
                  w-full px-3 py-2
                  bg-gray-50 dark:bg-[#0e0d12]/50
                  rounded-lg
                  text-gray-900 dark:text-white
                  text-center tracking-wider text-lg font-mono
                  ring-inset transition-all duration-200
                  focus:outline-none focus:ring-2 focus:ring-emerald-500
                  border border-slate-200/60 dark:border-[#343140]/60
                  ${
                    code.length === 6
                      ? error
                        ? "ring-2 ring-red-500"
                        : "ring-2 ring-emerald-500"
                      : "focus:ring-2 focus:ring-emerald-500"
                  }
                `}
            autoFocus
            placeholder="000000"
          />
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Having trouble? Contact us at{" "}
            <span className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400">
              https://cloudsync.com/support/abuse
            </span>
          </p>
        </div>
      </div>
    </Modal>
  );
};
