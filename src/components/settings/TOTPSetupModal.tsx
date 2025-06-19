import { useState, useEffect, KeyboardEvent } from "react";
import {
  ShieldCheck,
  QrCode,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
  Download,
  Clock,
} from "lucide-react";
import { ApiError, ApiService } from "../../services/ApiService";
import { Modal } from "../Modal";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { downloadDir } from "@tauri-apps/api/path";
import { motion } from "framer-motion";

interface TOTPSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TOTPSetupModal = ({
  isOpen,
  onClose,
  onComplete,
}: TOTPSetupModalProps) => {
  // Step state: "setup", "verify", "backup-codes"
  const [step, setStep] = useState("setup");

  // TOTP data and session management
  const [setupSession, setSetupSession] = useState<{
    id: string | null;
    qrCode: string | null;
    expiresIn: number;
    expiryTime: number | null;
  }>({
    id: null,
    qrCode: null,
    expiresIn: 0,
    expiryTime: null,
  });

  // UI states
  const [verificationCode, setVerificationCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesCopied, setBackupCodesCopied] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  // Initialize setup when modal opens
  useEffect(() => {
    // Reset states when modal is closed
    if (!isOpen) {
      setStep("setup");
      setVerificationCode("");
      setError("");
      setBackupCodesCopied(false);
      setSetupSession({
        id: null,
        qrCode: null,
        expiresIn: 0,
        expiryTime: null,
      });
    }
  }, [isOpen]);

  // Setup session expiry timer
  useEffect(() => {
    let timer: number | undefined;

    if (setupSession.expiryTime) {
      timer = window.setInterval(() => {
        const now = new Date().getTime();
        const remaining = setupSession.expiryTime
          ? Math.max(0, Math.floor((setupSession.expiryTime - now) / 1000))
          : 0;

        setTimeRemaining(remaining);

        if (remaining <= 0) {
          clearInterval(timer);
          if (step === "setup" || step === "verify") {
            setError("Setup session expired. Please restart the process.");
          }
        }
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [setupSession.expiryTime, step]);

  // Format time remaining for display
  const formatTimeRemaining = (seconds: number | null) => {
    if (seconds === null) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Fetch initial TOTP setup data (QR code and session ID)
  const fetchTOTPSetup = async () => {
    setIsLoading(true);
    setVerificationCode("");
    setError("");

    try {
      // Call the secure API endpoint that doesn't expose the secret
      const response = await ApiService.generateTOTPSecret();

      if (response.code === 1000) {
        // SUCCESS
        const expiryTime = new Date().getTime() + response.expires_in * 1000;

        setSetupSession({
          id: response.setup_session_id,
          qrCode: response.qr_code,
          expiresIn: response.expires_in,
          expiryTime: expiryTime,
        });

        setStep("verify");
      } else {
        setError(response.detail || "Failed to generate TOTP setup");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Verify TOTP code and complete setup
  const handleVerify = async () => {
    if (verificationCode.length !== 6 || !setupSession.id) return;

    setIsLoading(true);
    setError("");

    try {
      // Call the secure verification endpoint with session ID instead of secret
      const response = await ApiService.verifyTOTP(
        setupSession.id,
        verificationCode,
      );

      if (response.code === 2001) {
        // MFA_SUCCESS
        // Store backup codes and update user
        setBackupCodes(response.backup_codes || []);
        if (response.backup_codes) {
          onComplete();
        }
        setStep("backup-codes");
      } else {
        setError(response.detail || "Verification failed");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press for code verification
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && verificationCode.length === 6 && !isLoading) {
      handleVerify();
    }
  };

  // Copy all backup codes to clipboard
  const copyAllBackupCodes = () => {
    if (backupCodes.length) {
      const codesText = backupCodes.join("\n");
      navigator.clipboard.writeText(codesText);
      setBackupCodesCopied(true);
      setTimeout(() => setBackupCodesCopied(false), 2000);
    }
  };

  // Save backup codes to file using Tauri API - no longer requiring the user to enter a path manually
  const saveBackupCodes = async () => {
    if (backupCodes.length) {
      try {
        // Prompt user to select save location with default filename
        const filePath = await save({
          title: "Save Backup Codes",
          filters: [
            {
              name: "Text",
              extensions: ["txt"],
            },
          ],
          defaultPath: (await downloadDir) + "/backup_codes.txt",
        });

        // If user selected a path, write the file
        if (filePath) {
          const codesText = backupCodes.join("\n");
          await writeTextFile(filePath, codesText);
        }
      } catch (err) {
        setError(
          "Failed to save backup codes. Please try copying them instead.",
        );
      }
    }
  };

  // Setup step content
  const renderSetupContent = () => (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <p className="text-gray-700 dark:text-gray-300">
          Two-factor authentication adds an extra layer of security to your
          account. In addition to your password, you'll need a code from your
          authenticator app to sign in.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
              You'll need:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-300 space-y-1 ml-2">
              <li>
                An authenticator app like Google Authenticator, Microsoft
                Authenticator, or Authy
              </li>
              <li>Your mobile device to scan a QR code</li>
            </ul>
          </div>

          <button
            onClick={fetchTOTPSetup}
            disabled={isLoading}
            className="w-full py-2.5 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isLoading ? "Setting up..." : "Continue"}
          </button>
        </div>
      )}
    </div>
  );

  // Verify step content
  const renderVerifyContent = () => (
    <div className="p-6 space-y-6">
      {/* Session timer */}
      {timeRemaining !== null && (
        <div
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
            timeRemaining > 60
              ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
              : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Setup expires in {formatTimeRemaining(timeRemaining)}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="bg-white dark:bg-[#18191b] border border-slate-200/60 dark:border-[#343140]/60 rounded-lg p-4">
        <div className="flex justify-center mb-4">
          <div className="bg-white p-2 rounded">
            {setupSession.qrCode ? (
              <img
                src={setupSession.qrCode}
                alt="QR Code"
                className="h-48 w-48"
              />
            ) : (
              <div className="h-48 w-48 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <QrCode className="h-10 w-10 text-gray-400" />
              </div>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 text-center">
          Scan this QR code with your authenticator app
        </p>
      </div>

      <div className="mt-6">
        <p className="font-medium text-gray-800 dark:text-white mb-2">
          Verify Setup
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter the 6-digit verification code from your authenticator app to
          complete setup.
        </p>

        <input
          type="text"
          value={verificationCode}
          onChange={(e) => {
            const value = e.target.value.replace(/\D/g, "");
            if (value.length <= 6) setVerificationCode(value);
          }}
          onKeyDown={handleKeyDown}
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
              verificationCode.length === 6
                ? "ring-2 ring-emerald-500"
                : "focus:ring-2 focus:ring-emerald-500"
            }
          `}
          autoFocus
          placeholder="000000"
        />
      </div>
    </div>
  );

  // Backup codes step content
  const renderBackupCodesContent = () => (
    <div className="p-6 space-y-6">
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-500 mt-0.5" />
          <div>
            <h4 className="font-medium text-emerald-700 dark:text-emerald-400">
              Two-factor authentication is now enabled
            </h4>
            <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
              Your account is now more secure. You'll need to enter a
              verification code from your authenticator app when you sign in.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-emerald-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">
              Backup Codes
            </h4>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAllBackupCodes}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
            >
              {backupCodesCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {backupCodesCopied ? "Copied!" : "Copy All"}
            </button>
            <button
              onClick={saveBackupCodes}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors cursor-pointer"
            >
              <Download className="h-4 w-4" />
              Save Codes
            </button>
          </div>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          Save these backup codes in a secure place. You can use each backup
          code once if you lose access to your authentication device.
        </p>

        <div className="bg-gray-50 dark:bg-[#0e0d12] border border-emerald-100 dark:border-emerald-900/50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-3">
            {backupCodes.map((code, index) => (
              <div
                key={index}
                className="font-mono text-sm bg-white dark:bg-[#18191b] border border-emerald-200 dark:border-emerald-800/50 rounded-md p-2.5 text-center text-gray-800 dark:text-gray-300"
              >
                {code}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <p className="mb-1">
                <strong>Important:</strong> Without access to your authenticator
                app or backup codes, you could be locked out of your account.
                Store these codes securely.
              </p>
              <p>
                If you lose access to both your authenticator app and backup
                codes, you can still recover your account using your recovery
                email or phone number that can be setup in recovery.
              </p>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render appropriate footer based on step
  const renderFooter = () => {
    if (step === "setup") {
      return (
        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#2c2934] rounded-lg transition-all duration-200 shadow-sm"
          >
            Cancel
          </motion.button>
        </div>
      );
    }

    if (step === "verify") {
      return (
        <div className="flex justify-end gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setStep("setup")}
            className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            Back
          </motion.button>
          <motion.button
            whileHover={
              verificationCode.length === 6 && !isLoading ? { scale: 1.02 } : {}
            }
            whileTap={
              verificationCode.length === 6 && !isLoading ? { scale: 0.98 } : {}
            }
            onClick={handleVerify}
            disabled={verificationCode.length !== 6 || isLoading}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm ${
              verificationCode.length === 6 && !isLoading
                ? "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white cursor-pointer"
                : "bg-emerald-400/50 dark:bg-emerald-700/50 text-white cursor-not-allowed"
            }`}
          >
            {isLoading ? "Verifying..." : "Verify & Enable"}
          </motion.button>
        </div>
      );
    }

    if (step === "backup-codes") {
      return (
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            Done
          </motion.button>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Two-Factor Authentication"
      icon={ShieldCheck}
      iconColor="emerald"
      footer={renderFooter()}
    >
      {step === "setup" && renderSetupContent()}
      {step === "verify" && renderVerifyContent()}
      {step === "backup-codes" && renderBackupCodesContent()}
    </Modal>
  );
};

export default TOTPSetupModal;
