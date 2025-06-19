import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  KeyRound,
  ArrowLeft,
  EyeOff,
  Eye,
  AlertCircle,
  CheckCircle2,
  Loader,
  ChevronRight,
  Lock,
  KeySquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CloudStorageIllustration, Logo } from "../utils/utils";
import TitleBar from "../TitleBar";
import { useAuth } from "../context/AuthContext";
import { RecoveryPhraseModal } from "../components/RecoveryPhraseModel";
import { VerifyEmailModal } from "../components/VerifyEmailModal";
// Step types for the forgot password flow
type ForgotPasswordStep =
  | "emailValidation"
  | "otpVerification"
  | "newPassword"
  | "recoveryKey";

interface FormData {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  otp?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface PasswordRequirements {
  minLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

const ForgotPasswordPage = () => {
  // Current step state
  const [currentStep, setCurrentStep] =
    useState<ForgotPasswordStep>("emailValidation");

  // Form state
  const [formData, setFormData] = useState<FormData>({
    email: "",
    otp: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [recoveryKey, setRecoveryKey] = useState("");
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [passwordRequirements, setPasswordRequirements] =
    useState<PasswordRequirements>({
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecial: false,
    });

  // For tooltip positioning
  const [tooltipPosition, setTooltipPosition] = useState(
    "left-0 -top-2 -translate-y-full"
  );
  const [arrowPosition, setArrowPosition] = useState(
    "left-6 -bottom-2 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-[0.5rem] border-t-white/95 dark:border-t-[#040405]"
  );

  // Helper functions for dynamic tooltip positioning
  const getTooltipPosition = () => {
    const windowWidth = window.innerWidth;

    if (windowWidth < 768 || window.scrollY < 150) {
      const isTooCloseToTop = window.scrollY < 150;

      if (isTooCloseToTop) {
        return "left-0 top-full mt-2";
      } else {
        return "left-0 -top-2 -translate-y-full";
      }
    } else {
      return "left-auto top-1/2 right-[calc(100%+0.5rem)] -translate-y-1/2";
    }
  };

  const getArrowPosition = () => {
    const windowWidth = window.innerWidth;

    if (windowWidth < 768 || window.scrollY < 150) {
      const isTooCloseToTop = window.scrollY < 150;

      if (isTooCloseToTop) {
        return "left-6 -top-2 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-[0.5rem] border-b-white/95 dark:border-b-[#040405]";
      } else {
        return "left-6 -bottom-2 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-[0.5rem] border-t-white/95 dark:border-t-[#040405]";
      }
    } else {
      return "left-auto bottom-auto right-0 top-1/2 -translate-y-1/2 translate-x-[0.5rem] border-l-[0.5rem] border-l-slate-200/50 dark:border-l-[#343140] border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-0";
    }
  };

  // Optimize resize/scroll handlers with debouncing
  useEffect(() => {
    let resizeTimer: NodeJS.Timeout;
    let scrollTimer: NodeJS.Timeout;

    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        setTooltipPosition(getTooltipPosition());
        setArrowPosition(getArrowPosition());
      }, 100);
    };

    const handleScroll = () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        setTooltipPosition(getTooltipPosition());
        setArrowPosition(getArrowPosition());
      }, 100);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(resizeTimer);
      clearTimeout(scrollTimer);
    };
  }, []);

  const navigate = useNavigate();
  // Normally you'd use real auth methods from your context
  const { resetPassword } = useAuth();

  // Validate email format
  const validateEmail = (email: string): boolean => {
    return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email);
  };

  // Validate password strength
  const validatePassword = (password: string): boolean => {
    const reqs = {
      minLength: password.length >= 12,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };
    setPasswordRequirements(reqs);
    return Object.values(reqs).every(Boolean);
  };

  // Clear specific field error
  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate form based on current step
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (currentStep === "emailValidation") {
      if (!formData.email) {
        newErrors.email = "Email is required";
      } else if (!validateEmail(formData.email)) {
        newErrors.email = "Invalid email address";
      }
    } else if (currentStep === "otpVerification") {
      if (!formData.otp) {
        newErrors.otp = "Verification code is required";
      } else if (formData.otp.length !== 6 || !/^\d+$/.test(formData.otp)) {
        newErrors.otp = "Please enter a valid 6-digit code";
      }
    } else if (currentStep === "newPassword") {
      if (!formData.password) {
        newErrors.password = "Password is required";
      } else if (!validatePassword(formData.password)) {
        newErrors.password = "Password does not meet the requirements";
      }

      if (!formData.confirmPassword) {
        newErrors.confirmPassword = "Please confirm your password";
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "Passwords do not match";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission based on current step
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      if (currentStep === "emailValidation") {
        // Simulate API call to validate email
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // In a real app, you would check if the email exists
        setCurrentStep("otpVerification");
        setIsVerificationModalOpen(true);
      } else if (currentStep === "otpVerification") {
        // Simulate API call to verify OTP
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setCurrentStep("newPassword");
        setIsVerificationModalOpen(false);
      } else if (currentStep === "newPassword") {
        // Simulate API call to reset password
        await new Promise((resolve) => setTimeout(resolve, 1000));
        // Generate a dummy recovery key
        const dummyRecoveryKey =
          "cloud autumn rocket pencil seven ocean bright diamond laptop forest green";
        setRecoveryKey(dummyRecoveryKey);
        setCurrentStep("recoveryKey");
        setShowRecoveryPhrase(true);
      }
    } catch (error: any) {
      setErrors({
        ...errors,
        general: error.message || "An error occurred. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP verification from modal
  const handleVerification = async (code?: string) => {
    if (!code) return;

    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setErrors({ ...errors, otp: "Please enter a valid 6-digit code" });
      return;
    }

    setFormData((prev) => ({ ...prev, otp: code }));
    setCurrentStep("newPassword");
    setIsVerificationModalOpen(false);
  };

  // Handle input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof FormData
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Special handling for password to validate requirements
    if (field === "password") {
      validatePassword(value);
      // Clear password error when user starts typing again
      clearFieldError("password");
    } else if (field === "confirmPassword") {
      // Clear confirm password error when user starts typing again
      clearFieldError("confirmPassword");
    } else {
      // Clear field error when user starts typing again
      clearFieldError(field);
    }
  };

  // Memoize password requirement items for performance
  const passwordRequirementItems = useMemo(() => {
    return [
      {
        label: "At least 12 characters",
        met: passwordRequirements.minLength,
      },
      {
        label: "One uppercase letter",
        met: passwordRequirements.hasUppercase,
      },
      {
        label: "One lowercase letter",
        met: passwordRequirements.hasLowercase,
      },
      {
        label: "One number",
        met: passwordRequirements.hasNumber,
      },
      {
        label: "One special character",
        met: passwordRequirements.hasSpecial,
      },
    ];
  }, [passwordRequirements]);

  // Function to check if all password requirements are met
  const areAllRequirementsMet = () => {
    return Object.values(passwordRequirements).every(Boolean);
  };

  // Get step title based on current step
  const getStepTitle = () => {
    switch (currentStep) {
      case "emailValidation":
        return "Reset Password";
      case "otpVerification":
        return "Verify Code";
      case "newPassword":
        return "Create New Password";
      case "recoveryKey":
        return "Save Recovery Key";
      default:
        return "Reset Password";
    }
  };

  // Get step description based on current step
  const getStepDescription = () => {
    switch (currentStep) {
      case "emailValidation":
        return "Enter your email address to reset your password";
      case "otpVerification":
        return "Enter the 6-digit code sent to your email";
      case "newPassword":
        return "Create a new secure password for your account";
      case "recoveryKey":
        return "Keep this recovery phrase in a safe place";
      default:
        return "";
    }
  };

  return (
    <div className="h-screen flex flex-col dark:bg-[#0e0d12]">
      {/* Fixed TitleBar at the top */}
      <div className="w-full z-10 fixed top-0 left-0 right-0">
        <TitleBar />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto pt-10">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ duration: 1 }}
          className="fixed inset-0 mt-10 bg-[radial-gradient(circle_at_1px_1px,rgb(228,228,228)_1px,transparent_0)] dark:bg-[radial-gradient(circle_at_1px_1px,rgb(38,38,38)_1px,transparent_0)] [background-size:40px_40px] pointer-events-none"
        />

        <div className="min-h-full w-full flex flex-col lg:flex-row pt-6 md:pt-8 lg:pt-0">
          {/* Left side - Illustration (visible only on lg and up) */}
          <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-4 lg:p-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="w-full max-w-md"
            >
              <CloudStorageIllustration />
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="text-center mt-4"
              >
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Secure Cloud Storage
                </h2>
                <p className="mt-2 text-base text-gray-600 dark:text-gray-400">
                  Store, and share your files securely with end-to-end
                  encryption
                </p>
              </motion.div>
            </motion.div>
          </div>

          {/* Right side - Form */}
          <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-6 relative z-0">
            <div className="w-full max-w-md relative">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-white/95 dark:bg-[#040405] backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-[#343140] p-4 sm:p-6 md:p-8 relative"
              >
                {/* Logo with spacing for aligned back button */}
                <div className="flex justify-center items-center relative h-12 mb-6">
                  <div className="absolute left-0">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => navigate("/login")}
                      className="p-2 rounded-full bg-gray-50 dark:bg-[#0e0d12]/50 hover:bg-gray-100 dark:hover:bg-[#343140]/90 transition-colors cursor-pointer"
                      aria-label="Back to login"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </motion.button>
                  </div>
                  <div className="w-24 sm:w-28 md:w-32">
                    <Logo />
                  </div>
                </div>

                {/* Error message */}
                <AnimatePresence>
                  {errors.general && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/10"
                    >
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium">
                          {errors.general}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Header */}
                <div className="text-center mb-6 sm:mb-8">
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {getStepTitle()}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                    {getStepDescription()}
                  </p>
                </div>

                {/* Form */}
                <AnimatePresence mode="wait">
                  <motion.form
                    key={currentStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={handleSubmit}
                    className="space-y-4 sm:space-y-6"
                    noValidate
                  >
                    {/* Email Validation Step */}
                    {currentStep === "emailValidation" && (
                      <div className="space-y-1">
                        <label className="block text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          Email address
                        </label>
                        <div className="relative">
                          <Mail
                            className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${
                              errors.email ? "text-red-500" : "text-gray-400"
                            }`}
                          />
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange(e, "email")}
                            className={`block w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm rounded-xl bg-gray-50 dark:bg-[#0e0d12]/50 border ${
                              errors.email
                                ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                                : "border-slate-200/50 dark:border-[#343140] focus:ring-emerald-500/20 focus:border-emerald-500"
                            } placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 transition-all cursor-text`}
                            placeholder="name@example.com"
                          />
                        </div>
                        <AnimatePresence>
                          {errors.email && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.15 }}
                              className="mt-1 text-xs sm:text-sm text-red-500"
                            >
                              {errors.email}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* OTP Verification Step */}
                    {currentStep === "otpVerification" && (
                      <div className="space-y-1">
                        <label className="block text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                          Verification Code
                        </label>
                        <div className="relative">
                          <KeySquare
                            className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${
                              errors.otp ? "text-red-500" : "text-gray-400"
                            }`}
                          />
                          <input
                            type="text"
                            maxLength={6}
                            value={formData.otp}
                            onChange={(e) => handleInputChange(e, "otp")}
                            className={`block w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 text-sm rounded-xl bg-gray-50 dark:bg-[#0e0d12]/50 border ${
                              errors.otp
                                ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                                : "border-slate-200/50 dark:border-[#343140] focus:ring-emerald-500/20 focus:border-emerald-500"
                            } placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 transition-all cursor-text`}
                            placeholder="Enter 6-digit code"
                          />
                        </div>
                        <AnimatePresence>
                          {errors.otp && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              transition={{ duration: 0.15 }}
                              className="mt-1 text-xs sm:text-sm text-red-500"
                            >
                              {errors.otp}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                          className="mt-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400"
                        >
                          Didn't receive the code?
                          <button
                            type="button"
                            className="ml-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium cursor-pointer"
                            onClick={() => {
                              // In a real app, you would resend the OTP
                              alert("Verification code resent!");
                            }}
                          >
                            Resend code
                          </button>
                        </motion.p>
                      </div>
                    )}

                    {/* New Password Step */}
                    {currentStep === "newPassword" && (
                      <>
                        {/* Password field */}
                        <div className="space-y-1">
                          <label className="block text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            New Password
                          </label>
                          <div className="relative">
                            <KeyRound
                              className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${
                                errors.password
                                  ? "text-red-500"
                                  : "text-gray-400"
                              }`}
                            />
                            <input
                              type={showPassword ? "text" : "password"}
                              value={formData.password}
                              onChange={(e) => handleInputChange(e, "password")}
                              className={`block w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 text-sm rounded-xl bg-gray-50 dark:bg-[#0e0d12]/50 border ${
                                errors.password
                                  ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                                  : "border-slate-200/50 dark:border-[#343140] focus:ring-emerald-500/20 focus:border-emerald-500"
                              } placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 transition-all cursor-text`}
                              placeholder="Create a strong password"
                            />
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              onMouseDown={(e) => e.preventDefault()}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#343140]/90 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                            >
                              {showPassword ? (
                                <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                              ) : (
                                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </motion.button>

                            {/* Password requirements tooltip */}
                            <AnimatePresence>
                              {formData.password &&
                                !areAllRequirementsMet() && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{
                                      opacity: 0,
                                      scale: 0.95,
                                      transition: { duration: 0.1 },
                                    }}
                                    transition={{
                                      duration: 0.15,
                                      ease: "easeOut",
                                    }}
                                    className={`
                                    absolute w-full sm:w-72 bg-white/95 dark:bg-[#040405] backdrop-blur-sm rounded-xl 
                                    border border-slate-200/50 dark:border-[#343140] p-2 sm:p-3 shadow-lg z-50
                                    ${tooltipPosition}
                                  `}
                                  >
                                    <div
                                      className={`
                                      absolute w-0 h-0
                                      ${arrowPosition}
                                    `}
                                    />

                                    {/* Password requirements list */}
                                    <motion.div className="space-y-1 sm:space-y-1.5">
                                      {passwordRequirementItems.map(
                                        (req, index) => (
                                          <div
                                            key={index}
                                            className={`flex items-center gap-1.5 sm:gap-2 transition-colors ${
                                              req.met
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-gray-500 dark:text-gray-400"
                                            }`}
                                          >
                                            <div
                                              className={`flex items-center justify-center w-3.5 h-3.5 sm:w-4 sm:h-4 transition-all ${
                                                req.met
                                                  ? "scale-100"
                                                  : "scale-95 opacity-70"
                                              }`}
                                            >
                                              {req.met ? (
                                                <motion.div
                                                  initial={{ scale: 0 }}
                                                  animate={{ scale: 1 }}
                                                  transition={{
                                                    type: "spring",
                                                    stiffness: 500,
                                                    damping: 25,
                                                  }}
                                                >
                                                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                                </motion.div>
                                              ) : (
                                                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full border-2 border-current" />
                                              )}
                                            </div>
                                            <span className="text-xs sm:text-sm">
                                              {req.label}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </motion.div>
                                  </motion.div>
                                )}
                            </AnimatePresence>
                          </div>
                          <AnimatePresence>
                            {errors.password && (
                              <motion.p
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="mt-1 text-xs sm:text-sm text-red-500"
                              >
                                {errors.password}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Confirm Password field */}
                        <div className="space-y-1">
                          <label className="block text-xs sm:text-sm font-medium text-gray-900 dark:text-white">
                            Confirm Password
                          </label>
                          <div className="relative">
                            <Lock
                              className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 ${
                                errors.confirmPassword
                                  ? "text-red-500"
                                  : "text-gray-400"
                              }`}
                            />
                            <input
                              type={showConfirmPassword ? "text" : "password"}
                              value={formData.confirmPassword}
                              onChange={(e) =>
                                handleInputChange(e, "confirmPassword")
                              }
                              className={`block w-full pl-9 sm:pl-10 pr-10 sm:pr-12 py-2.5 sm:py-3 text-sm rounded-xl bg-gray-50 dark:bg-[#0e0d12]/50 border ${
                                errors.confirmPassword
                                  ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                                  : "border-slate-200/50 dark:border-[#343140] focus:ring-emerald-500/20 focus:border-emerald-500"
                              } placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 transition-all cursor-text`}
                              placeholder="Confirm your password"
                            />
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              type="button"
                              onClick={() =>
                                setShowConfirmPassword(!showConfirmPassword)
                              }
                              onMouseDown={(e) => e.preventDefault()}
                              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 sm:p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#343140]/90 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors cursor-pointer"
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" />
                              ) : (
                                <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
                              )}
                            </motion.button>
                          </div>
                          <AnimatePresence>
                            {errors.confirmPassword && (
                              <motion.p
                                initial={{ opacity: 0, y: -5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="mt-1 text-xs sm:text-sm text-red-500"
                              >
                                {errors.confirmPassword}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>
                      </>
                    )}

                    {/* Submit button - aligned at center */}
                    <div className="pt-2">
                      <motion.button
                        type="submit"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full px-4 py-2.5 sm:py-3 text-sm font-medium text-white bg-gradient-to-r from-emerald-400 to-blue-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-lg shadow-emerald-500/20 transition-all duration-200 cursor-pointer flex items-center justify-center"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <div className="flex items-center justify-center gap-2">
                            <Loader className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                            <span>
                              {currentStep === "emailValidation" &&
                                "Verifying Email..."}
                              {currentStep === "otpVerification" &&
                                "Verifying Code..."}
                              {currentStep === "newPassword" &&
                                "Updating Password..."}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center">
                            <span>
                              {currentStep === "emailValidation" && "Continue"}
                              {currentStep === "otpVerification" &&
                                "Verify & Continue"}
                              {currentStep === "newPassword" &&
                                "Update Password"}
                            </span>
                            <ChevronRight className="ml-1 w-4 h-4 sm:w-5 sm:h-5" />
                          </div>
                        )}
                      </motion.button>
                    </div>

                    {/* Sign in link */}
                    <div className="text-center text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Remember your password?{" "}
                      <button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium transition-colors cursor-pointer"
                      >
                        Sign in
                      </button>
                    </div>
                  </motion.form>
                </AnimatePresence>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isVerificationModalOpen && (
          <VerifyEmailModal
            isOpen={isVerificationModalOpen}
            value={formData.email}
            type="email"
            onClose={() => {
              setIsVerificationModalOpen(false);
              // If user cancels verification, go back to email step
              setCurrentStep("emailValidation");
            }}
            isRecovery={false}
            onSubmit={(code?: string) => handleVerification(code)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRecoveryPhrase && (
          <RecoveryPhraseModal
            isOpen={showRecoveryPhrase}
            onClose={() => {
              setShowRecoveryPhrase(false);
              navigate("/login");
            }}
            recoveryKey={recoveryKey}
            onContinue={() => navigate("/login")}
            continueButtonText="Continue to Login"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default ForgotPasswordPage;
