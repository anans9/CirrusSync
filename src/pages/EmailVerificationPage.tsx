import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, Loader } from "lucide-react";
import { motion } from "framer-motion";
import TitleBar from "../TitleBar";
import { ApiService } from "../services/ApiService";

// Verification states
enum VerificationState {
  VERIFYING = 0,
  SUCCESS = 1,
  ERROR = 2,
}

const EmailVerificationPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [state, setState] = useState<VerificationState>(
    VerificationState.VERIFYING,
  );
  const [error, setError] = useState<string>("");
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    // Extract verification token from URL
    const params = new URLSearchParams(location.search);
    const token = params.get("token");

    if (!token) {
      setState(VerificationState.ERROR);
      setError(
        "Verification token is missing. Please check your email link and try again.",
      );
      return;
    }

    // Send verification token to backend
    const verifyEmail = async () => {
      try {
        // Call API to confirm email verification
        await ApiService.verifyEmail({ token });
        setState(VerificationState.SUCCESS);

        // Start countdown for automatic redirect
        startCountdown();
      } catch (error: any) {
        setState(VerificationState.ERROR);
        setError(
          error.message ||
            "We couldn't verify your email. Please try again or contact support.",
        );
      }
    };

    verifyEmail();
  }, [location.search]);

  // Start countdown for auto-redirect
  const startCountdown = () => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  };

  // Render content based on verification state
  const renderContent = () => {
    switch (state) {
      case VerificationState.VERIFYING:
        return (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-5">
              <Loader className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900 dark:text-white mb-2">
              Verifying Your Email
            </h2>
            <p className="text-emerald-700 dark:text-emerald-300 text-center max-w-md">
              Please wait while we verify your email address...
            </p>
          </div>
        );

      case VerificationState.SUCCESS:
        return (
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-5"
            >
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </motion.div>
            <h2 className="text-xl font-bold text-emerald-900 dark:text-white mb-2">
              Email Verified Successfully!
            </h2>
            <p className="text-emerald-700 dark:text-emerald-300 text-center max-w-md mb-4">
              Your email address has been verified. Please proceed to login.
            </p>
            <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/10 px-4 py-2 rounded-full text-emerald-700 dark:text-emerald-300 text-sm">
              Redirecting to login in {countdown} seconds...
            </div>
            <button
              onClick={() => navigate("/login")}
              className="mt-5 py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 shadow-sm"
            >
              Log in Now
            </button>
          </div>
        );

      case VerificationState.ERROR:
        return (
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-5">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900 dark:text-white mb-2">
              Verification Failed
            </h2>
            <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-md p-4 max-w-md mb-4">
              <div className="flex">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5 mr-2" />
                <p className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => navigate("/signup")}
                className="py-2.5 px-5 border border-emerald-200 dark:border-emerald-800/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 text-emerald-700 dark:text-emerald-300 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm"
              >
                Back to Sign Up
              </button>
              <button
                onClick={() => navigate("/support")}
                className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 shadow-sm"
              >
                Contact Support
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-[#0e0d12]">
      {/* Fixed TitleBar at the top */}
      <div className="w-full z-10 fixed top-0 left-0 right-0">
        <TitleBar />
      </div>

      {/* Main content */}
      <div className="flex-grow flex flex-col justify-center items-center px-4 pt-16 pb-8 md:px-8">
        <div className="flex items-center mb-8">
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
            <span className="text-emerald-900 dark:text-white">Cirrus</span>
            <span className="text-emerald-500">Sync</span>
            <span className="ml-1 text-emerald-900 dark:text-white">Drive</span>
          </div>
        </div>

        {/* Card container */}
        <div className="w-full max-w-md bg-white dark:bg-[#16151c] rounded-xl shadow-lg overflow-hidden border border-emerald-100 dark:border-emerald-800/20">
          <div className="py-8 px-6 md:px-8">{renderContent()}</div>
        </div>

        {/* Footer info */}
        {state === VerificationState.SUCCESS && (
          <div className="mt-6 text-xs text-emerald-600 dark:text-emerald-400 text-center">
            <p>
              Thank you for verifying your email. You can now access all
              features of CirrusSync Drive.
            </p>
            <p className="mt-1">
              Need help? Contact us at{" "}
              <a
                href="mailto:support@cirrussync.com"
                className="text-emerald-600 dark:text-emerald-400 underline"
              >
                support@cirrussync.com
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationPage;
