import React, { useState, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Loader,
  Mail,
  KeyRound,
  EyeOff,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import TitleBar from "../TitleBar";
import { openUrl } from "@tauri-apps/plugin-opener";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    detail?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const validateForm = useCallback((): boolean => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email";
    }
    if (!password.trim()) {
      newErrors.password = "Password is required";
    }
    // Only update errors if they've changed to prevent unnecessary re-renders
    const hasErrorChanged =
      Object.keys(newErrors).length !== Object.keys(errors).length ||
      Object.keys(newErrors).some(
        (key) =>
          newErrors[key as keyof typeof newErrors] !==
          errors[key as keyof typeof errors],
      );
    if (hasErrorChanged) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
    }
    return Object.keys(newErrors).length === 0;
  }, [email, password, errors]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      setErrors({});
      setLoading(true);
      // Login with the provided email and password
      await login(email, password);
      // Navigate to the intended destination upon successful login
      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err) {
      const error = err as ApiError;
      setErrors({
        detail: error.message || "Invalid credentials. Please try again.",
      });
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-[#0e0d12]">
      {/* Fixed TitleBar at the top */}
      <div className="w-full z-10 fixed top-0 left-0 right-0">
        <TitleBar />
      </div>

      {/* Main content with fixed layout */}
      <div className="fixed inset-0 flex flex-col bg-white dark:bg-[#0e0d12] overflow-hidden text-gray-900 dark:text-white">
        {/* Top section with logo - optimized height */}
        <div className="h-[90px] w-full flex justify-center items-center pt-12">
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
        <div className="flex-grow flex flex-col justify-center items-center px-4 -mt-4">
          <div className="w-full max-w-sm">
            {/* Error container - only takes space when visible */}
            <AnimatePresence>
              {errors.detail && (
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
                          There were errors with your submission
                        </h3>
                        <div className="mt-1 text-xs text-red-700 dark:text-red-300">
                          {errors.detail}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form container */}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-white/90"
                >
                  Email or username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail
                      className={`h-4 w-4 ${errors.email ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}
                    />
                  </div>
                  <input
                    className={`w-full pl-9 pr-3 py-2.5 text-sm border ${
                      errors.email
                        ? "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "bg-white dark:bg-[#0e0d12]/50 border-slate-200/50 dark:border-[#343140] focus:border-emerald-500 focus:ring-emerald-500"
                    } rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 shadow-sm`}
                    placeholder="Your email or username"
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        email: undefined,
                        detail: undefined,
                      }));
                    }}
                    disabled={loading}
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
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrors((prev) => ({
                        ...prev,
                        password: undefined,
                        detail: undefined,
                      }));
                    }}
                    disabled={loading}
                    className={`w-full pl-9 pr-9 py-2.5
                    ${
                      errors.password
                        ? "bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-500 focus:border-red-500 focus:ring-red-500"
                        : "bg-white dark:bg-[#0e0d12]/50 border-slate-200/50 dark:border-[#343140] focus:border-emerald-500 focus:ring-emerald-500"
                    }
                    text-sm border rounded-md text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-neutral-500 focus:outline-none focus:ring-1 shadow-sm`}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    onMouseDown={(e) => e.preventDefault()}
                    className="absolute inset-y-0 right-0 w-9 flex items-center justify-center text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-300 focus:outline-none"
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
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-neutral-900 disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </div>
                ) : (
                  <span>Sign in</span>
                )}
              </motion.button>
            </form>
          </div>
        </div>

        {/* Footer section - fixed height */}
        <div className="h-[60px] w-full flex justify-center items-center">
          <div className="w-full max-w-sm flex justify-between items-center text-xs px-4">
            <Link
              to="/signup"
              className="text-emerald-600 dark:text-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Create account
            </Link>
            <button
              onClick={() => openUrl("https://cirrussync.me/support")}
              className="text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
