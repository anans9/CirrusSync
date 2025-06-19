import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Loader,
  Mail,
  KeyRound,
  Eye,
  EyeOff,
  User,
  AlertTriangle,
  Clock,
  CheckCircle,
  Copy,
  ShieldAlert,
  Check,
  KeySquare,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import TitleBar from "../TitleBar";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { ApiService } from "../services/ApiService";

// Define steps for the simplified signup flow
enum SignupStep {
  USER_INFO = 0,
  EMAIL_VERIFICATION_SENT = 1,
  RECOVERY_KEY = 2,
}

const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();

  const signupPageRef = useRef<boolean>(false);
  const verificationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const verificationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Core state
  const [currentStep, setCurrentStep] = useState<SignupStep>(
    SignupStep.USER_INFO,
  );
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isCheckingVerification, setIsCheckingVerification] =
    useState<boolean>(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [verificationTimeLeft, setVerificationTimeLeft] = useState<number>(600);

  // Success states
  const [resendSuccess, setResendSuccess] = useState<boolean>(false);
  const [accountCreated, setAccountCreated] = useState<boolean>(false);

  // Recovery key states
  const [recoveryKey, setRecoveryKey] = useState<string>("");
  const [keyCopied, setKeyCopied] = useState<boolean>(false);
  const [confirmSaved, setConfirmSaved] = useState<boolean>(false);

  useEffect(() => {
    if (!signupPageRef.current) {
      signupPageRef.current = true;
      setTimeout(() => {
        invoke("resize_window", { session: false });
      }, 100);
    }

    return () => {
      if (verificationCheckIntervalRef.current) {
        clearInterval(verificationCheckIntervalRef.current);
      }
      if (verificationTimeoutRef.current) {
        clearTimeout(verificationTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when going back to USER_INFO step
  const resetState = () => {
    if (verificationCheckIntervalRef.current) {
      clearInterval(verificationCheckIntervalRef.current);
    }
    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
    }

    setErrors({});
    setIsLoading(false);
    setIsCheckingVerification(false);
    setResendSuccess(false);
    setCurrentStep(SignupStep.USER_INFO);
  };

  // Handle basic form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: string,
  ): void => {
    const value =
      field === "username" ? e.target.value.toLowerCase() : e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate the email, username and password
  const validateUserInfo = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Email validation
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)
    ) {
      newErrors.email = "Invalid email address";
    }

    // Username validation
    if (!formData.username) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-z0-9._]+$/.test(formData.username)) {
      newErrors.username = "Only letters, numbers, dots and underscores";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 12) {
      newErrors.password = "Password must be at least 12 characters";
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = "Password needs at least one uppercase letter";
    } else if (!/[a-z]/.test(formData.password)) {
      newErrors.password = "Password needs at least one lowercase letter";
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = "Password needs at least one number";
    } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
      newErrors.password = "Password needs at least one special character";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Request email verification and start checking
  const requestEmailVerification = async (resend?: boolean): Promise<void> => {
    try {
      setIsLoading(true);

      // Call API to request email verification
      await ApiService.sendEmail({
        email: formData.email,
        username: formData.username,
        intent: "signup",
      });

      if (resend) {
        setErrors({});
        // Show resend success message and hide after 3 seconds
        setResendSuccess(true);
        setTimeout(() => {
          setResendSuccess(false);
        }, 5000);
      } else {
        // Move to email verification sent step
        setCurrentStep(SignupStep.EMAIL_VERIFICATION_SENT);
      }

      // Start checking for email verification
      startVerificationCheck();

      // Start countdown
      startVerificationCountdown();
    } catch (error) {
      const err = error as ApiError;
      setErrors({
        general:
          err.message || "Failed to send verification email. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Start checking if email has been verified
  const startVerificationCheck = () => {
    if (verificationCheckIntervalRef.current) {
      clearInterval(verificationCheckIntervalRef.current);
    }

    verificationCheckIntervalRef.current = setInterval(() => {
      checkEmailVerification();
    }, 5000);
  };

  // Start countdown for verification timeout
  const startVerificationCountdown = () => {
    setVerificationTimeLeft(600);

    if (verificationTimeoutRef.current) {
      clearTimeout(verificationTimeoutRef.current);
    }

    const countdownInterval = setInterval(() => {
      setVerificationTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          handleVerificationTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    verificationTimeoutRef.current = setTimeout(() => {
      handleVerificationTimeout();
      clearInterval(countdownInterval);
    }, 600000); // 10 minutes
  };

  // Handle verification timeout
  const handleVerificationTimeout = () => {
    if (verificationCheckIntervalRef.current) {
      clearInterval(verificationCheckIntervalRef.current);
    }

    setErrors({
      timeout: "Verification time expired. Please try signing up again.",
    });
  };

  // Check if email has been verified
  const checkEmailVerification = async (): Promise<void> => {
    if (isCheckingVerification) return;

    try {
      setIsCheckingVerification(true);

      const response = await ApiService.checkEmailVerificationStatus({
        email: formData.email,
      });

      if (response && response.data.verified) {
        // Email is verified, clear the interval and timeout
        if (verificationCheckIntervalRef.current) {
          clearInterval(verificationCheckIntervalRef.current);
        }
        if (verificationTimeoutRef.current) {
          clearTimeout(verificationTimeoutRef.current);
        }

        // Proceed with account creation
        await createAccount();
      }
    } catch (error) {
      const err = error as ApiError;
      setCurrentStep(SignupStep.USER_INFO);

      setErrors({
        general:
          err.message || "Failed to create account. Please try again later.",
      });
    } finally {
      setIsCheckingVerification(false);
    }
  };

  // Create account after email verification
  const createAccount = async (): Promise<void> => {
    try {
      setIsLoading(true);

      // Generate SRP credentials, keys, create user, setup drive and folders
      const { recoveryPhrase } = await signup(
        formData.username,
        formData.email,
        formData.password,
      );

      // Set recovery key and move to recovery key step
      setRecoveryKey(recoveryPhrase);
      setAccountCreated(true);
      setCurrentStep(SignupStep.RECOVERY_KEY);
    } catch (error) {
      const err = error as ApiError;

      setCurrentStep(SignupStep.USER_INFO);
      setFormData({
        username: "",
        email: "",
        password: "",
      });

      setErrors({
        general:
          err.message || "Failed to create account. Please try again later.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Copy recovery key to clipboard
  const copyRecoveryKey = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setKeyCopied(true);
      setTimeout(() => {
        setKeyCopied(false);
      }, 3000);
    } catch (error) {
      console.error("Failed to copy recovery key:", error);
    }
  };

  // Handle continue button action
  const handleContinue = async () => {
    if (currentStep === SignupStep.USER_INFO) {
      if (!validateUserInfo()) return;
      await requestEmailVerification();
    }
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Navigate to login page
  const goToLogin = () => {
    navigate("/login");
  };

  // Render different content based on the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case SignupStep.USER_INFO:
        return (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleContinue();
            }}
            className="space-y-4"
            noValidate
          >
            <AnimatePresence>
              {errors.general && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 shadow-sm"
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-xs font-medium text-red-800 dark:text-red-200">
                          Error
                        </h3>
                        <div className="mt-1 text-xs text-red-700 dark:text-red-300">
                          {errors.general}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label
                htmlFor="email"
                className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-white/90"
              >
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail
                    className={`h-4 w-4 ${errors.email ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}
                  />
                </div>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange(e, "email")}
                  className={`w-full pl-9 pr-3 py-2.5 text-sm border ${
                    errors.email
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "bg-white dark:bg-[#0e0d12]/50 border-slate-200/50 dark:border-[#343140] focus:border-emerald-500 focus:ring-emerald-500"
                  } rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 shadow-sm`}
                  placeholder="Your email address"
                />
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-500 flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {errors.email}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label
                htmlFor="username"
                className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-white/90"
              >
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User
                    className={`h-4 w-4 ${errors.username ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}
                  />
                </div>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleInputChange(e, "username")}
                  className={`w-full pl-9 pr-3 py-2.5 text-sm border ${
                    errors.username
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "bg-white dark:bg-[#0e0d12]/50 border-slate-200/50 dark:border-[#343140] focus:border-emerald-500 focus:ring-emerald-500"
                  } rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 shadow-sm`}
                  placeholder="Choose a username"
                />
              </div>
              <AnimatePresence>
                {errors.username && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-500 flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {errors.username}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-white/90"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound
                    className={`h-4 w-4 ${errors.password ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}
                  />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleInputChange(e, "password")}
                  className={`w-full pl-9 pr-9 py-2.5 text-sm border ${
                    errors.password
                      ? "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500"
                      : "bg-white dark:bg-[#0e0d12]/50 border-slate-200/50 dark:border-[#343140] focus:border-emerald-500 focus:ring-emerald-500"
                  } rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 shadow-sm`}
                  placeholder="Create a strong password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  onMouseDown={(e) => e.preventDefault()}
                  className="absolute inset-y-0 right-0 w-9 flex items-center justify-center text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <AnimatePresence>
                {errors.password && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-500 flex items-center gap-1"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {errors.password}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm cursor-pointer"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Please wait...</span>
                </div>
              ) : (
                <span>Create Account</span>
              )}
            </motion.button>
          </form>
        );

      case SignupStep.EMAIL_VERIFICATION_SENT:
        return (
          <div className="space-y-4">
            <AnimatePresence>
              {accountCreated && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 shadow-sm"
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                          Success
                        </h3>
                        <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                          Your account has been created successfully!
                          Redirecting to login...
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {resendSuccess && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 shadow-sm"
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-xs font-medium text-emerald-800 dark:text-emerald-200">
                          Email Sent
                        </h3>
                        <div className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                          Verification email has been resent successfully!
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {errors.timeout && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 shadow-sm"
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-xs font-medium text-red-800 dark:text-red-200">
                          Verification timed out
                        </h3>
                        <div className="mt-1 text-xs text-red-700 dark:text-red-300">
                          {errors.timeout}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {errors.general && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 shadow-sm"
                >
                  <div className="p-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h3 className="text-xs font-medium text-red-800 dark:text-red-200">
                          Error
                        </h3>
                        <div className="mt-1 text-xs text-red-700 dark:text-red-300">
                          {errors.general}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="bg-white dark:bg-[#16151c] border border-slate-200 dark:border-[#343140] rounded-md p-5 shadow-sm">
              <div className="text-center mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  A verification link has been sent to
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formData.email}
                </p>
              </div>

              <div className="flex items-start">
                <div className="mt-1 mr-3 flex-shrink-0">
                  {errors.timeout ? (
                    <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                  ) : isLoading || isCheckingVerification ? (
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <Loader className="w-5 h-5 animate-spin text-emerald-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-emerald-500" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white mb-1">
                    {errors.timeout
                      ? "Verification link expired"
                      : isLoading
                        ? "Sending verification email..."
                        : "Check your inbox"}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                    {errors.timeout
                      ? "Please try again or contact support if the problem persists."
                      : "Click the verification link in the email we just sent you. We'll automatically redirect you once verified."}
                  </p>
                  {!errors.timeout && (
                    <div className="mt-3 flex items-center text-xs text-gray-500 dark:text-gray-400 bg-emerald-50 dark:bg-emerald-900/10 py-1.5 px-2.5 rounded-md">
                      <Clock className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                      <span>
                        Expires in: {formatTimeRemaining(verificationTimeLeft)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-center pt-2">
              {errors.timeout ? (
                <button
                  type="button"
                  onClick={resetState}
                  className="mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 shadow-sm cursor-pointer"
                >
                  Try Again
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => requestEmailVerification(true)}
                  disabled={isLoading}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 cursor-pointer"
                >
                  {isLoading
                    ? "Sending..."
                    : "Didn't receive the email? Resend"}
                </button>
              )}
            </div>
          </div>
        );

      case SignupStep.RECOVERY_KEY:
        return (
          <div className="space-y-4">
            {/* Header section with proper background */}
            <div className="pt-8">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="inline-flex items-center justify-center mb-4">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 }}
                    className="w-16 h-16 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center"
                  >
                    <ShieldAlert className="w-8 h-8 text-amber-500" />
                  </motion.div>
                </div>

                <motion.h2
                  initial={{ y: -10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.2 }}
                  className="text-xl font-bold text-gray-900 dark:text-white mb-2"
                >
                  Save Your Recovery Key
                </motion.h2>

                <motion.p
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.4, delay: 0.3 }}
                  className="text-sm text-gray-600 dark:text-gray-300 mb-2 px-2"
                >
                  This is your <span className="font-medium">only</span> way to
                  recover access if you forget your password. We cannot reset it
                  for you.
                </motion.p>
              </motion.div>
            </div>

            {/* Scrollable content area */}
            <div className="overflow-y-auto pb-5 -mx-4 px-4 mt-2">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-4 shadow-inner relative"
              >
                <div className="absolute top-3 right-3">
                  <button
                    type="button"
                    onClick={copyRecoveryKey}
                    className="flex items-center justify-center w-7 h-7 rounded-md bg-white dark:bg-[#16151c] hover:bg-gray-100 dark:hover:bg-[#1c1b24] border border-amber-200 dark:border-amber-700/30 text-amber-700 dark:text-amber-400 transition-colors"
                  >
                    {keyCopied ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="flex justify-center mb-2">
                  <KeySquare className="w-5 h-5 text-amber-700 dark:text-amber-500" />
                </div>

                <div className="font-mono text-center text-sm sm:text-base text-amber-800 dark:text-amber-300 break-all tracking-wider leading-relaxed select-all">
                  {recoveryKey}
                </div>

                {keyCopied && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute inset-x-0 -bottom-8 flex justify-center"
                  >
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-800/30">
                      Copied to clipboard!
                    </span>
                  </motion.div>
                )}
              </motion.div>

              {/* Warning box */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="bg-white dark:bg-[#16151c] border-l-4 border-amber-500 rounded-r-md p-3 shadow-sm mt-6"
              >
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5 mr-2" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Important
                    </h3>
                    <ul className="mt-1 text-xs text-gray-600 dark:text-gray-300 space-y-1.5">
                      <li>
                        • Store this key somewhere secure like a password
                        manager
                      </li>
                      <li>• Anyone with this key can access your data</li>
                      <li>
                        • We cannot recover your data if you lose both your
                        password and this key
                      </li>
                    </ul>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="pt-4"
              >
                <label className="flex items-start cursor-pointer mb-5 select-none">
                  <div className="flex items-center h-5 relative">
                    <input
                      type="checkbox"
                      checked={confirmSaved}
                      onChange={(e) => setConfirmSaved(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded border ${
                        confirmSaved
                          ? "bg-emerald-500 border-emerald-500"
                          : "bg-white dark:bg-[#16151c] border-gray-300 dark:border-neutral-600"
                      }
                                transition-colors duration-200`}
                    >
                      {confirmSaved && (
                        <svg
                          className="w-5 h-5 text-white"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>
                  <div className="ml-2 text-sm">
                    <span className="font-medium text-gray-900 dark:text-white">
                      I have securely saved my recovery key
                    </span>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      I understand that if I lose this key and my password, my
                      data will be permanently inaccessible.
                    </p>
                  </div>
                </label>

                <motion.button
                  whileHover={{ scale: confirmSaved ? 1.02 : 1 }}
                  whileTap={{ scale: confirmSaved ? 0.98 : 1 }}
                  type="button"
                  disabled={!confirmSaved}
                  onClick={goToLogin}
                  className="w-full flex items-center justify-center py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
                >
                  Continue to Login
                  <ArrowRight className="ml-2 w-4 h-4" />
                </motion.button>
              </motion.div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0e0d12]">
      {/* Fixed TitleBar at the top with higher z-index */}
      <div className="w-full z-20 fixed top-0 left-0 right-0">
        <TitleBar />
      </div>

      {/* Main content with fixed layout */}
      <div className="fixed inset-0 flex flex-col bg-white dark:bg-[#0e0d12] overflow-hidden text-gray-900 dark:text-white">
        {/* Top section with logo - optimized height with solid background */}
        <div className="h-[90px] w-full flex justify-center items-center pt-12 bg-white dark:bg-[#0e0d12] z-10">
          <div className="flex items-center">
            <div className="mr-3">
              <svg
                width="40"
                height="40"
                viewBox="0 0 48 48"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 40h32a4 4 0 0 0 4-4V16a4 4 0 0 0-4-4H24.14a4 4 0 0 1-3.32-1.76L19.16 8A4 4 0 0 0 15.86 6H8a4 4 0 0 0-4 4v26a4 4 0 0 0 4 4Z"
                  fill="url(#folder-gradient)"
                />
                <defs>
                  <linearGradient
                    id="folder-gradient"
                    x1="4"
                    y1="6"
                    x2="44"
                    y2="40"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#047857" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="text-xl font-bold">
              <span className="text-gray-900 dark:text-white">Cirrus</span>
              <span className="text-emerald-500">Sync</span>
              <span className="ml-1 text-gray-900 dark:text-white">Drive</span>
            </div>
          </div>
        </div>

        {/* Middle section with form - takes remaining space */}
        <div className="flex-grow flex flex-col justify-center items-center px-4 -mt-4 max-w-full overflow-y-auto">
          {/* Added padding bottom */}
          <div className="w-full max-w-sm">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer section with links - fixed height */}
        <div className="h-[60px] w-full flex justify-center items-center bg-white dark:bg-[#0e0d12] z-10">
          <div className="w-full max-w-sm flex justify-between items-center text-xs px-4">
            {currentStep === SignupStep.USER_INFO ? (
              <>
                <Link
                  to="/login"
                  className="text-emerald-600 dark:text-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Sign in
                </Link>
                <button
                  onClick={() => openUrl("https://cirrussync.me/support")}
                  className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Support
                </button>
              </>
            ) : currentStep === SignupStep.EMAIL_VERIFICATION_SENT ? (
              <>
                <button
                  onClick={resetState}
                  className="text-emerald-600 dark:text-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  Go back
                </button>
                <button
                  onClick={() => openUrl("https://cirrussync.me/support")}
                  className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  Support
                </button>
              </>
            ) : (
              <button
                onClick={() => openUrl("https://cirrussync.me/support")}
                className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer mx-auto"
              >
                Support
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
