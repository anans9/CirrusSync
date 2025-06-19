import React, { useState, useRef, useEffect } from "react";
import {
  Key,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Shield,
} from "lucide-react";
import { Modal } from "../Modal";
import { motion } from "framer-motion";

interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (currentPassword: string, newPassword: string) => Promise<void>;
  isProcessing?: boolean;
}

// Password strength levels
type StrengthLevel = "weak" | "medium" | "strong" | "very-strong";

const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isProcessing = false,
}) => {
  // Form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password generator state
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [passwordLength, setPasswordLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);

  // States for password breach checking
  const [isCheckingBreach, setIsCheckingBreach] = useState(false);
  const [breachStatus, setBreachStatus] = useState<{
    checked: boolean;
    breached: boolean;
    message: string;
  }>({
    checked: false,
    breached: false,
    message: "",
  });

  // Form validation
  const [errors, setErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  // Password strength
  const [strength, setStrength] = useState<StrengthLevel>("weak");

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Submit on Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isProcessing) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Reset all states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Clear everything when modal closes
      resetAllState();
    } else {
      // Generate a password on first open
      handleGeneratePassword();
    }
  }, [isOpen]);

  // Reset all form state and errors
  const resetAllState = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrors({});
    setIsGeneratorOpen(false);
    setPasswordCopied(false);
    setBreachStatus({
      checked: false,
      breached: false,
      message: "",
    });
    setStrength("weak");
  };

  // Calculate password strength whenever newPassword changes
  useEffect(() => {
    setStrength(calculatePasswordStrength(newPassword));

    // Validate passwords match when either changes
    if (confirmPassword && newPassword !== confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "Passwords don't match",
      }));
    } else {
      setErrors((prev) => {
        const { confirmPassword, ...rest } = prev;
        return rest;
      });
    }
  }, [newPassword, confirmPassword]);

  // Generate a password based on criteria
  const handleGeneratePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?~`'\"\\/";

    let chars = "";
    if (includeUppercase) chars += uppercase;
    if (includeLowercase) chars += lowercase;
    if (includeNumbers) chars += numbers;
    if (includeSymbols) chars += symbols;

    // Fallback if nothing selected
    if (!chars) {
      chars = lowercase + uppercase + numbers + symbols;
      setIncludeLowercase(true);
      setIncludeUppercase(true);
      setIncludeNumbers(true);
      setIncludeSymbols(true);
    }

    // Get crypto-secure random values
    const array = new Uint32Array(passwordLength * 3);
    window.crypto.getRandomValues(array);

    let password = "";

    // Generate initial password
    for (let i = 0; i < passwordLength; i++) {
      password += chars.charAt(array[i] % chars.length);
    }

    // Ensure at least one character from each required set
    let finalPassword = password;

    if (includeUppercase && !/[A-Z]/.test(finalPassword)) {
      const pos = Math.floor(array[passwordLength] % finalPassword.length);
      finalPassword =
        finalPassword.substring(0, pos) +
        uppercase.charAt(array[passwordLength + 1] % uppercase.length) +
        finalPassword.substring(pos + 1);
    }

    if (includeLowercase && !/[a-z]/.test(finalPassword)) {
      const pos = Math.floor(array[passwordLength + 2] % finalPassword.length);
      finalPassword =
        finalPassword.substring(0, pos) +
        lowercase.charAt(array[passwordLength + 3] % lowercase.length) +
        finalPassword.substring(pos + 1);
    }

    if (includeNumbers && !/[0-9]/.test(finalPassword)) {
      const pos = Math.floor(array[passwordLength + 4] % finalPassword.length);
      finalPassword =
        finalPassword.substring(0, pos) +
        numbers.charAt(array[passwordLength + 5] % numbers.length) +
        finalPassword.substring(pos + 1);
    }

    if (
      includeSymbols &&
      !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?~`'"\\/]/.test(finalPassword)
    ) {
      const pos = Math.floor(array[passwordLength + 6] % finalPassword.length);
      finalPassword =
        finalPassword.substring(0, pos) +
        symbols.charAt(array[passwordLength + 7] % symbols.length) +
        finalPassword.substring(pos + 1);
    }

    setGeneratedPassword(finalPassword);
    setPasswordCopied(false);
    setBreachStatus({
      checked: false,
      breached: false,
      message: "",
    });
  };

  // Check if password has been exposed in data breaches
  const checkPasswordBreach = async () => {
    if (!generatedPassword) return;

    setIsCheckingBreach(true);

    try {
      // Using the k-anonymity model to check breaches without sending the full password
      // We send only the first 5 characters of the SHA-1 hash
      const encoder = new TextEncoder();
      const data = encoder.encode(generatedPassword);
      const hashBuffer = await crypto.subtle.digest("SHA-1", data);

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Send only first 5 chars of hash (k-anonymity)
      const hashPrefix = hashHex.substring(0, 5).toUpperCase();
      const hashSuffix = hashHex.substring(5).toUpperCase();

      // Use the HaveIBeenPwned API
      const response = await fetch(
        `https://api.pwnedpasswords.com/range/${hashPrefix}`,
      );
      if (!response.ok) throw new Error("API request failed");

      const text = await response.text();
      const breachData = text.split("\n");

      // Check if our hash suffix exists in the returned data
      const match = breachData.find(
        (line) => line.split(":")[0] === hashSuffix,
      );

      if (match) {
        const occurrences = parseInt(match.split(":")[1]);
        setBreachStatus({
          checked: true,
          breached: true,
          message: `This password has been exposed in ${occurrences.toLocaleString()} data breaches. Please generate a new one.`,
        });
      } else {
        setBreachStatus({
          checked: true,
          breached: false,
          message:
            "Great! This password hasn't been found in any known data breaches.",
        });
      }
    } catch (error) {
      console.error("Error checking password breach:", error);
      setBreachStatus({
        checked: true,
        breached: false,
        message:
          "Couldn't verify breach status. The password should still be secure.",
      });
    } finally {
      setIsCheckingBreach(false);
    }
  };

  // Copy generated password to clipboard
  const handleCopyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  // Apply generated password to the form
  const handleUseGeneratedPassword = () => {
    setNewPassword(generatedPassword);
    setConfirmPassword(generatedPassword);
    setIsGeneratorOpen(false);
  };

  // Calculate password strength
  const calculatePasswordStrength = (password: string): StrengthLevel => {
    if (!password) return "weak";

    const length = password.length;

    // Return level based primarily on length
    if (length >= 32) return "very-strong";
    if (length >= 16) return "strong";
    if (length >= 8) return "medium";
    return "weak";
  };

  // Get info about password strength
  const getStrengthInfo = () => {
    switch (strength) {
      case "weak":
        return {
          color: "bg-red-500",
          percent: "w-1/4",
          text: "Weak",
          textColor: "text-red-500",
          description:
            "Your password is too weak. Consider using our password generator.",
        };
      case "medium":
        return {
          color: "bg-amber-500",
          percent: "w-2/4",
          text: "Medium",
          textColor: "text-amber-500",
          description: "Your password is acceptable, but could be stronger.",
        };
      case "strong":
        return {
          color: "bg-green-500",
          percent: "w-3/4",
          text: "Strong",
          textColor: "text-green-500",
          description: "Good job! Your password is strong.",
        };
      case "very-strong":
        return {
          color: "bg-emerald-500",
          percent: "w-full",
          text: "Very Strong",
          textColor: "text-emerald-500",
          description: "Excellent! Your password is very secure.",
        };
      default:
        return {
          color: "bg-gray-500",
          percent: "w-0",
          text: "None",
          textColor: "text-gray-500",
          description: "Please enter a password.",
        };
    }
  };

  // Submit handler
  const handleSubmit = async () => {
    // Reset all errors first
    setErrors({});

    // New validation object
    const newErrors: typeof errors = {};

    // Validate current password
    if (!currentPassword) {
      newErrors.currentPassword = "Current password is required";
    }

    // Validate new password
    if (!newPassword) {
      newErrors.newPassword = "New password is required";
    } else if (newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters";
    }

    // Validate password match
    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = "Passwords don't match";
    }

    // If we have errors, set them and return
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Submit the form
    try {
      await onConfirm(currentPassword, newPassword);

      // Reset everything on success
      resetAllState();
    } catch (error) {
      // Clear errors but keep form data
      setErrors({});
      console.error("Password update failed:", error);
    }
  };

  const strengthInfo = getStrengthInfo();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Change Password"
      icon={Key}
      iconColor="emerald"
      preventCloseOnOutsideClick={isProcessing}
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
          <button
            onClick={!isProcessing ? handleSubmit : undefined}
            disabled={isProcessing}
            className="px-6 py-2.5 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
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
                Verifying...
              </>
            ) : (
              "Update Password"
            )}
          </button>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="p-6"
      >
        <div className="space-y-6">
          {/* Info Alerts */}
          <div className="space-y-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 flex items-start gap-2">
              <Info className="h-5 w-5 text-emerald-500 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Changing your password will log you out of all other devices.
                You'll need to use your new password to log back in.
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex items-start gap-2">
              <Shield className="h-5 w-5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-600 dark:text-amber-400">
                <p className="mb-1">
                  For better security, your password should:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-xs pl-1">
                  <li>Be at least 12 characters long</li>
                  <li>Include uppercase and lowercase letters</li>
                  <li>Include numbers and special characters</li>
                  <li>Avoid common patterns and repeated characters</li>
                  <li>Not be used on multiple websites</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Password Form */}
          <div className="space-y-4">
            {/* Current Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Current Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-emerald-500/70 dark:text-emerald-500/70" />
                </div>
                <input
                  onKeyDown={handleKeyDown}
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2 bg-white dark:bg-[#1c1b23] border ${
                    errors.currentPassword
                      ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500"
                      : "border-slate-200/60 dark:border-[#343140]/60 focus:ring-emerald-500 focus:border-emerald-500"
                  } rounded-lg text-gray-900 dark:text-white focus:outline-none transition-all duration-200 cursor-text`}
                  placeholder="Enter your current password"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{errors.currentPassword}</span>
                </p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                New Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Key className="h-4 w-4 text-emerald-500/70 dark:text-emerald-500/70" />
                </div>
                <input
                  onKeyDown={handleKeyDown}
                  ref={passwordInputRef}
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2 bg-white dark:bg-[#1c1b23] border ${
                    errors.newPassword
                      ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500"
                      : "border-slate-200/60 dark:border-[#343140]/60 focus:ring-emerald-500 focus:border-emerald-500"
                  } rounded-lg text-gray-900 dark:text-white focus:outline-none transition-all duration-200 cursor-text`}
                  placeholder="Enter new password"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{errors.newPassword}</span>
                </p>
              )}

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Password strength:
                    </span>
                    <span
                      className={`text-xs font-medium ${strengthInfo.textColor}`}
                    >
                      {strengthInfo.text}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strengthInfo.color} rounded-full transition-all duration-300 ease-out ${strengthInfo.percent}`}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {strengthInfo.description}
                  </p>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <ShieldCheck className="h-4 w-4 text-emerald-500/70 dark:text-emerald-500/70" />
                </div>
                <input
                  onKeyDown={handleKeyDown}
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full pl-10 pr-10 py-2 bg-white dark:bg-[#1c1b23] border ${
                    errors.confirmPassword
                      ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500"
                      : "border-slate-200/60 dark:border-[#343140]/60 focus:ring-emerald-500 focus:border-emerald-500"
                  } rounded-lg text-gray-900 dark:text-white focus:outline-none transition-all duration-200 cursor-text`}
                  placeholder="Confirm new password"
                  disabled={isProcessing}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1.5 mt-1">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{errors.confirmPassword}</span>
                </p>
              )}
            </div>
          </div>

          {/* Password Generator */}
          <div className="mt-8 rounded-lg border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden bg-white dark:bg-[#1c1b23] shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1c1b23] border-b border-slate-200/60 dark:border-[#343140]/60">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                <Key className="h-4 w-4 text-emerald-500" />
                Password Generator
              </h3>
              <button
                type="button"
                onClick={() => setIsGeneratorOpen(!isGeneratorOpen)}
                className="p-1.5 rounded-md text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer"
              >
                {isGeneratorOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="p-4">
              <div className="flex flex-col space-y-4">
                {/* Generated Password Display */}
                {/* Generated Password Display with integrated buttons */}
                <div className="relative">
                  <div className="flex w-full overflow-hidden rounded-lg border border-slate-200/60 dark:border-[#343140]/60">
                    <input
                      type="text"
                      value={generatedPassword}
                      readOnly
                      className="flex-grow py-2 px-3 font-mono text-sm bg-white dark:bg-[#1c1b23] border-0 text-gray-900 dark:text-white focus:ring-0 focus:outline-none cursor-default"
                    />
                    <div className="flex border-l border-slate-200/60 dark:border-[#343140]/60 bg-white dark:bg-[#1c1b23]">
                      <button
                        type="button"
                        onClick={handleCopyPassword}
                        className="px-3 h-full flex items-center justify-center text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
                        title="Copy password"
                      >
                        {passwordCopied ? (
                          <Check className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <div className="w-px h-full bg-slate-200/60 dark:bg-[#343140]/60"></div>
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="px-3 h-full flex items-center justify-center text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
                        title="Generate new password"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Breach Status */}
                {breachStatus.checked && (
                  <div
                    className={`mb-4 p-2 text-xs rounded-md flex items-start gap-1.5 ${
                      breachStatus.breached
                        ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                        : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {breachStatus.breached ? (
                      <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    )}
                    <span>{breachStatus.message}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  {/* Quick Apply Button */}
                  <button
                    type="button"
                    onClick={handleUseGeneratedPassword}
                    className="flex-1 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Use This Password
                  </button>

                  {/* Check Breach Button */}
                  <button
                    type="button"
                    onClick={checkPasswordBreach}
                    disabled={isCheckingBreach || !generatedPassword}
                    className="flex-1 py-2 text-sm font-medium border border-emerald-600 dark:border-emerald-500 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
                  >
                    {isCheckingBreach ? (
                      <>
                        <svg
                          className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-500"
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
                        Checking...
                      </>
                    ) : (
                      "Check for Breaches"
                    )}
                  </button>
                </div>

                {/* Generator Options */}
                {isGeneratorOpen && (
                  <div className="pt-4 border-t border-slate-200/60 dark:border-[#343140]/60 space-y-4 mt-2">
                    {/* Length Slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Password Length: {passwordLength}
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          8
                        </span>
                        <input
                          type="range"
                          min="8"
                          max="32"
                          value={passwordLength}
                          onChange={(e) =>
                            setPasswordLength(parseInt(e.target.value))
                          }
                          className="w-full h-2 bg-slate-200 dark:bg-[#343140] rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          32
                        </span>
                      </div>
                    </div>

                    {/* Character Types */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Include:
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeUppercase}
                            onChange={() =>
                              setIncludeUppercase(!includeUppercase)
                            }
                            className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            Uppercase (A-Z)
                          </span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeLowercase}
                            onChange={() =>
                              setIncludeLowercase(!includeLowercase)
                            }
                            className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            Lowercase (a-z)
                          </span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeNumbers}
                            onChange={() => setIncludeNumbers(!includeNumbers)}
                            className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            Numbers (0-9)
                          </span>
                        </label>

                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={includeSymbols}
                            onChange={() => setIncludeSymbols(!includeSymbols)}
                            className="rounded text-emerald-500 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          />
                          <span className="text-xs text-gray-700 dark:text-gray-300">
                            Symbols (!@#$)
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      type="button"
                      onClick={handleGeneratePassword}
                      className="w-full py-1.5 px-3 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Generate New Password
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default PasswordChangeModal;
