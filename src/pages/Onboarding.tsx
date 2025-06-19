import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ArrowRight,
  HardDrive,
  FolderPlus,
  Folder,
  File,
  Image,
  FileText,
  Shield,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiService } from "../services/ApiService";
import Toast from "../components/Toast";
import TitleBar from "../TitleBar";
import keyManager from "../context/KeyManager";

// Onboarding steps
enum OnboardingStep {
  DRIVE_SETUP = 0,
  ROOT_FOLDER = 1,
  SETUP_COMPLETE = 2,
}

// Toast message type
interface ToastMessage {
  text: string;
  type: "success" | "error" | "warning" | "caution" | "info";
}

// Custom emerald spinner component props
interface EmeraldSpinnerProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

// Custom emerald spinner component
const EmeraldSpinner: React.FC<EmeraldSpinnerProps> = ({
  className = "",
  size = "sm",
}) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-8 h-8",
  };

  return (
    <svg
      className={`animate-spin text-emerald-500 ${sizeClasses[size]} ${className}`}
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
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
};

// Component for drive name input props
interface DriveNameInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

// Component for drive name input
const DriveNameInput: React.FC<DriveNameInputProps> = ({
  value,
  onChange,
  error,
  onKeyDown,
}) => (
  <div className="mb-2 sm:mb-4">
    <label
      htmlFor="driveName"
      className="block text-sm font-medium text-black dark:text-white mb-1"
    >
      Drive Name
    </label>
    <div className="relative">
      <input
        id="driveName"
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={`block w-full px-3 sm:px-4 py-2 sm:py-3 rounded-md border
          ${error ? "border-red-500 dark:border-red-500" : "border-slate-200/50 dark:border-[#343140]"}
          focus:ring-emerald-500 focus:outline-none focus:border-emerald-500 dark:bg-[#0e0d12]/50 dark:text-white`}
        placeholder="My Cloud Drive"
        autoFocus
      />
    </div>
    <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-black/60 dark:text-white/60">
      This is how your drive will appear in your dashboard and shared links.
    </p>
  </div>
);

// Component for root folder input props
interface RootFolderInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error: string | null;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

// Component for root folder input
const RootFolderInput: React.FC<RootFolderInputProps> = ({
  value,
  onChange,
  error,
  onKeyDown,
}) => (
  <div className="mb-2 sm:mb-4">
    <label
      htmlFor="rootFolder"
      className="block text-sm font-medium text-black dark:text-white mb-1"
    >
      Root Folder Name
    </label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
        <Folder className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
      </div>
      <input
        id="rootFolder"
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className={`block w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-3 rounded-md border
          ${error ? "border-red-500 dark:border-red-500" : "border-slate-200/50 dark:border-[#343140]"}
          focus:ring-emerald-500 focus:outline-none focus:border-emerald-500 dark:bg-[#0e0d12]/50 dark:text-white`}
        placeholder="My Files"
        autoFocus
      />
    </div>
    <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-black/60 dark:text-white/60">
      This folder will contain all your files and subfolders.
    </p>
  </div>
);

// Folder structure animation component props
interface FolderStructureAnimationProps {
  folderName: string;
  isCreating: boolean;
}

// Folder structure animation component
const FolderStructureAnimation: React.FC<FolderStructureAnimationProps> = ({
  folderName,
  isCreating,
}) => {
  return (
    <div className="relative w-full h-full flex justify-center">
      <motion.div className="bg-white dark:bg-[#16151c] rounded-lg p-3 sm:p-4 w-full border border-slate-200/50 dark:border-[#343140] shadow-md">
        <div className="flex items-center justify-between mb-2 sm:mb-3 border-b border-slate-200/50 dark:border-[#343140] pb-2">
          <div className="flex items-center">
            <motion.div
              animate={isCreating ? { rotate: [0, 10, -10, 10, 0] } : {}}
              transition={{ duration: 0.5, repeat: isCreating ? Infinity : 0 }}
            >
              <Folder className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 mr-1.5 sm:mr-2" />
            </motion.div>
            <span className="font-medium text-black dark:text-white text-sm sm:text-base truncate max-w-[120px] sm:max-w-[180px]">
              {folderName || "My Files"}
            </span>
          </div>
        </div>

        <div className="space-y-1 sm:space-y-2">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center p-1.5 sm:p-2 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-md cursor-pointer group"
          >
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 mr-1.5 sm:mr-2 flex-shrink-0 group-hover:scale-105 transition-transform" />
            <span className="text-xs sm:text-sm text-black/80 dark:text-white/80 truncate">
              Documents
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="flex items-center p-1.5 sm:p-2 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-md cursor-pointer group"
          >
            <Image className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500 mr-1.5 sm:mr-2 flex-shrink-0 group-hover:scale-105 transition-transform" />
            <span className="text-xs sm:text-sm text-black/80 dark:text-white/80 truncate">
              Photos
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 }}
            className="flex items-center p-1.5 sm:p-2 hover:bg-slate-100/50 dark:hover:bg-white/5 rounded-md cursor-pointer group"
          >
            <File className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-violet-500 mr-1.5 sm:mr-2 flex-shrink-0 group-hover:scale-105 transition-transform" />
            <span className="text-xs sm:text-sm text-black/80 dark:text-white/80 truncate">
              Other Files
            </span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

// SVG Illustration for cloud storage
const CloudStorageIllustration: React.FC = () => (
  <motion.svg
    viewBox="0 0 400 240"
    xmlns="http://www.w3.org/2000/svg"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.5 }}
    className="w-full h-full"
  >
    <defs>
      <linearGradient id="cloudGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#047857" stopOpacity="0.5" />
      </linearGradient>
      <linearGradient id="folderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#10b981" />
        <stop offset="100%" stopColor="#047857" />
      </linearGradient>
    </defs>

    {/* Background cloud */}
    <motion.path
      d="M320,120 Q360,70 300,50 Q290,20 250,30 Q220,0 180,30 Q120,10 100,60 Q50,50 60,110 Q30,140 70,170 Q80,210 130,190 Q170,230 230,180 Q270,230 310,180 Q370,190 350,140 Q380,110 320,120 Z"
      fill="url(#cloudGradient)"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.7 }}
    />

    {/* Folder */}
    <motion.path
      d="M230,120 L290,120 Q300,120 300,130 L300,180 Q300,190 290,190 L110,190 Q100,190 100,180 L100,130 Q100,120 110,120 L180,120 L190,110 Q195,105 200,105 L220,105 Q225,105 230,110 Z"
      fill="url(#folderGradient)"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
    />

    {/* Documents */}
    <motion.rect
      x="120"
      y="140"
      width="40"
      height="30"
      rx="2"
      fill="white"
      opacity="0.8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 0.8, y: 0 }}
      transition={{ duration: 0.3, delay: 0.5 }}
    />
    <motion.rect
      x="170"
      y="140"
      width="40"
      height="30"
      rx="2"
      fill="white"
      opacity="0.8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 0.8, y: 0 }}
      transition={{ duration: 0.3, delay: 0.6 }}
    />
    <motion.rect
      x="220"
      y="140"
      width="40"
      height="30"
      rx="2"
      fill="white"
      opacity="0.8"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 0.8, y: 0 }}
      transition={{ duration: 0.3, delay: 0.7 }}
    />

    {/* Small icons on documents */}
    <motion.rect
      x="125"
      y="145"
      width="30"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 30 }}
      transition={{ duration: 0.3, delay: 0.8 }}
    />
    <motion.rect
      x="125"
      y="150"
      width="20"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 20 }}
      transition={{ duration: 0.3, delay: 0.85 }}
    />
    <motion.rect
      x="125"
      y="155"
      width="25"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 25 }}
      transition={{ duration: 0.3, delay: 0.9 }}
    />

    <motion.rect
      x="175"
      y="145"
      width="30"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 30 }}
      transition={{ duration: 0.3, delay: 0.95 }}
    />
    <motion.rect
      x="175"
      y="150"
      width="20"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 20 }}
      transition={{ duration: 0.3, delay: 1.0 }}
    />
    <motion.rect
      x="175"
      y="155"
      width="25"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 25 }}
      transition={{ duration: 0.3, delay: 1.05 }}
    />

    <motion.rect
      x="225"
      y="145"
      width="30"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 30 }}
      transition={{ duration: 0.3, delay: 1.1 }}
    />
    <motion.rect
      x="225"
      y="150"
      width="20"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 20 }}
      transition={{ duration: 0.3, delay: 1.15 }}
    />
    <motion.rect
      x="225"
      y="155"
      width="25"
      height="2"
      rx="1"
      fill="#10b981"
      initial={{ width: 0 }}
      animate={{ width: 25 }}
      transition={{ duration: 0.3, delay: 1.2 }}
    />
  </motion.svg>
);

// Setup Success Animation
const SetupSuccessAnimation: React.FC = () => (
  <motion.div className="relative w-60 h-60 mx-auto">
    <svg
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full"
    >
      <defs>
        <linearGradient
          id="successGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background circle with pulse animation */}
      <motion.circle
        cx="100"
        cy="100"
        r="70"
        fill="url(#successGradient)"
        opacity="0.1"
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 1.2, 1],
          opacity: [0, 0.2, 0.1],
        }}
        transition={{ duration: 1, ease: "easeOut" }}
      />

      {/* Secondary circle */}
      <motion.circle
        cx="100"
        cy="100"
        r="55"
        fill="url(#successGradient)"
        opacity="0.2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      />

      {/* Main circle with checkmark */}
      <motion.circle
        cx="100"
        cy="100"
        r="40"
        fill="url(#successGradient)"
        filter="url(#glow)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.5, delay: 0.6, type: "spring" }}
      />

      {/* Check mark */}
      <motion.path
        d="M80,100 L95,115 L120,85"
        stroke="white"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 1, ease: "easeOut" }}
      />

      {/* Orbit elements */}
      <motion.g>
        <motion.circle
          cx="100"
          cy="30"
          r="8"
          fill="#10b981"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.2 }}
        />
        <motion.circle
          cx="170"
          cy="100"
          r="8"
          fill="#059669"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.4 }}
        />
        <motion.circle
          cx="100"
          cy="170"
          r="8"
          fill="#047857"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.6 }}
        />
        <motion.circle
          cx="30"
          cy="100"
          r="8"
          fill="#10b981"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 1.8 }}
        />
      </motion.g>

      {/* Connecting lines with animation */}
      <motion.path
        d="M100,40 L100,60"
        stroke="#10b981"
        strokeWidth="2"
        strokeDasharray="20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.3 }}
      />
      <motion.path
        d="M160,100 L140,100"
        stroke="#059669"
        strokeWidth="2"
        strokeDasharray="20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.5 }}
      />
      <motion.path
        d="M100,160 L100,140"
        stroke="#047857"
        strokeWidth="2"
        strokeDasharray="20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.7 }}
      />
      <motion.path
        d="M40,100 L60,100"
        stroke="#10b981"
        strokeWidth="2"
        strokeDasharray="20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.9 }}
      />
    </svg>
  </motion.div>
);

// Main Onboarding Page Component
const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser, getSessionDerivedKey } = useAuth();

  // Core state
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(
    OnboardingStep.DRIVE_SETUP,
  );
  const [driveName, setDriveName] = useState<string>("");
  const [rootFolder, setRootFolder] = useState<string>("My Files");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    text: "",
    type: "success",
  });
  const [showToast, setShowToast] = useState<boolean>(false);
  const [derivedKey, setDerivedKey] = useState<string | null>(null);
  const [setupProgress, setSetupProgress] = useState<number>(0);

  useEffect(() => {
    getSessionDerivedKey({ userId: user?.id }).then((key) => {
      setDerivedKey(key);
    });
  }, [getSessionDerivedKey, user?.id]);

  // Initialize drive name based on user
  useEffect(() => {
    if (user?.username) {
      setDriveName(`${user.username}'s Drive`);
    }
  }, [user]);

  // Check if user needs onboarding and navigate to the correct step
  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }

    // Get onboarding flags
    const onboardingFlags = user?.onboardingFlags;

    if (!onboardingFlags) {
      // No onboarding needed, go to dashboard
      navigate("/");
      return;
    }

    // Check if all steps are completed
    if (
      onboardingFlags.driveSetup?.completed === true &&
      onboardingFlags.rootFolder?.completed === true
    ) {
      // All necessary steps completed, go to dashboard
      navigate("/");
      return;
    }

    // Find the first incomplete step and navigate there
    if (!onboardingFlags.driveSetup?.completed) {
      setCurrentStep(OnboardingStep.DRIVE_SETUP);
    } else if (!onboardingFlags.rootFolder?.completed) {
      setCurrentStep(OnboardingStep.ROOT_FOLDER);
    }
  }, [user, navigate]);

  // Handle drive setup completion
  const handleDriveSetup = async (): Promise<void> => {
    if (!driveName.trim()) {
      setToastMessage({
        text: "Please enter a name for your drive",
        type: "error",
      });
      setShowToast(true);
      return;
    }

    setIsLoading(true);

    try {
      const driveKeys = await keyManager.generateInitialDriveShareKeys(
        driveName,
        user as User,
        String(derivedKey),
      );

      // Send API request to save drive name
      await ApiService.initalizeDrive({
        driveVolume: {
          name: driveKeys.name,
          hash: driveKeys.hash,
        },
        driveShare: {
          shareKey: driveKeys.shareKey,
          sharePassphrase: driveKeys.sharePassphrase,
          sharePassphraseSignature: driveKeys.sharePassphraseSignature,
        },
        driveShareMembership: {
          keyPacket: driveKeys.shareKeyPacket,
          keyPacketSignature: driveKeys.keyPacketSignature,
          sessionKeySignature: driveKeys.sessionKeySignature,
        },
      });

      // Show success toast
      setToastMessage({
        text: "Drive name saved successfully!",
        type: "success",
      });
      setShowToast(true);

      setUser((prev) => ({
        ...prev!,
        onboardingFlags: {
          ...prev!.onboardingFlags,
          driveSetup: {
            completed: true,
          },
        },
      }));

      // Move directly to next step
      setCurrentStep(OnboardingStep.ROOT_FOLDER);
    } catch (error) {
      setToastMessage({
        text: "Failed to save drive name. Please try again.",
        type: "error",
      });
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle root folder setup completion
  const handleRootFolderSetup = async (): Promise<void> => {
    if (!rootFolder.trim()) {
      setToastMessage({
        text: "Please enter a name for your root folder",
        type: "error",
      });
      setShowToast(true);
      return;
    }

    setIsLoading(true);

    try {
      const folderKeys = await keyManager.generateRootFolderKeys(
        rootFolder,
        user as User,
        String(derivedKey),
      );

      const shareId = folderKeys.shareId;

      delete folderKeys.shareId;

      const folder = {
        ...folderKeys,
        parentId: null,
        signatureEmail: String(user?.email),
      };

      // Send API request to create root folder
      await ApiService.createFolder(String(shareId), folder);

      setUser((prev) => ({
        ...prev!,
        onboardingFlags: {
          ...prev!.onboardingFlags,
          rootFolder: {
            completed: true,
          },
        },
      }));

      // Show success toast
      setToastMessage({
        text: "Root folder created successfully!",
        type: "success",
      });
      setShowToast(true);

      // Move to completion step and show final animation
      setCurrentStep(OnboardingStep.SETUP_COMPLETE);

      // Simulate final setup progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setSetupProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
        }
      }, 150);
    } catch (error) {
      setToastMessage({
        text: "Failed to create root folder. Please try again.",
        type: "error",
      });
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press
  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    step: OnboardingStep,
  ): void => {
    if (event.key === "Enter") {
      event.preventDefault();

      switch (step) {
        case OnboardingStep.DRIVE_SETUP:
          handleDriveSetup();
          break;
        case OnboardingStep.ROOT_FOLDER:
          handleRootFolderSetup();
          break;
        default:
          break;
      }
    }
  };

  // Handle completion and navigation to dashboard
  const handleCompleteSetup = () => {
    navigate("/", { replace: true });
  };

  // Render drive setup step
  const renderDriveSetup = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="max-w-md w-full mx-auto px-4"
    >
      <div className="text-center mb-6 sm:mb-8">
        <motion.div
          className="flex justify-center mb-4 sm:mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-4">
            <HardDrive className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 dark:text-emerald-500" />
          </div>
        </motion.div>
        <motion.h2
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-2"
        >
          Set up your personal cloud
        </motion.h2>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="text-black/70 dark:text-white/70 text-sm sm:text-base"
        >
          Your secure space for all your important files. Let's give it a name
          to get started.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="bg-white dark:bg-[#16151c] rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-slate-200/50 dark:border-[#343140]"
      >
        <DriveNameInput
          value={driveName}
          onChange={(e) => setDriveName(e.target.value)}
          error={null}
          onKeyDown={(e) => handleKeyDown(e, OnboardingStep.DRIVE_SETUP)}
        />
      </motion.div>
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
          className="w-full max-w-[250px] mx-auto my-4 sm:my-6"
        >
          <CloudStorageIllustration />
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          onClick={handleDriveSetup}
          disabled={isLoading}
          className="mt-2 sm:mt-4 flex items-center justify-center w-full py-2.5 sm:py-3 px-4
            bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium
            disabled:opacity-70 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-300
            active:bg-emerald-800 active:ring-0 active:ring-offset-0"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <EmeraldSpinner className="mr-2" />
              <span>Processing...</span>
            </div>
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 w-4 h-4" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );

  // Render root folder creation step
  const renderRootFolderSetup = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="max-w-md w-full mx-auto px-4"
    >
      <div className="text-center mb-6 sm:mb-8">
        <motion.div
          className="flex justify-center mb-4 sm:mb-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{
            scale: [0.8, 1.1, 1],
            opacity: 1,
          }}
          transition={{ duration: 0.5 }}
        >
          <div className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 p-4">
            <FolderPlus className="w-8 h-8 sm:w-10 sm:h-10 text-emerald-600 dark:text-emerald-500" />
          </div>
        </motion.div>
        <motion.h2
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-2"
        >
          Create your root folder
        </motion.h2>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="text-black/70 dark:text-white/70 text-sm sm:text-base"
        >
          This will be the main folder where all your files and subfolders are
          stored.
        </motion.p>
      </div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="bg-white dark:bg-[#16151c] rounded-lg shadow-lg p-4 sm:p-6 mb-4 sm:mb-6 border border-slate-200/50 dark:border-[#343140]"
      >
        <RootFolderInput
          value={rootFolder}
          onChange={(e) => setRootFolder(e.target.value)}
          error={null}
          onKeyDown={(e) => handleKeyDown(e, OnboardingStep.ROOT_FOLDER)}
        />
      </motion.div>

      <div className="text-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="w-full max-w-[280px] mx-auto my-4 sm:my-6 overflow-hidden"
        >
          <FolderStructureAnimation
            folderName={rootFolder}
            isCreating={isLoading}
          />
        </motion.div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          onClick={handleRootFolderSetup}
          disabled={isLoading}
          className="mt-2 sm:mt-4 flex items-center justify-center w-full py-2.5 sm:py-3 px-4
            bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium
            disabled:opacity-70 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-300
            active:bg-emerald-800 active:ring-0 active:ring-offset-0"
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <EmeraldSpinner className="mr-2" />
              <span>Creating folder...</span>
            </div>
          ) : (
            <>
              Continue
              <ArrowRight className="ml-2 w-4 h-4" />
            </>
          )}
        </motion.button>
      </div>
    </motion.div>
  );

  // Render completion step
  const renderSetupComplete = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="max-w-md w-full mx-auto px-4"
    >
      <div className="text-center mb-6 sm:mb-8">
        <motion.h2
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="text-xl sm:text-2xl font-bold text-black dark:text-white mb-2"
        >
          {setupProgress < 100 ? "Finalizing Your Setup" : "Setup Complete!"}
        </motion.h2>
        <motion.p
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="text-black/70 dark:text-white/70 text-sm sm:text-base"
        >
          {setupProgress < 100
            ? "We're encrypting your data and preparing your secure cloud storage..."
            : "Your secure drive is ready to use. All files you store will be end-to-end encrypted."}
        </motion.p>
      </div>

      {setupProgress < 100 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-[280px] mx-auto my-8 sm:my-10"
        >
          <div className="flex flex-col items-center justify-center">
            <EmeraldSpinner size="lg" className="mb-6" />
            <div className="w-full bg-gray-200 dark:bg-[#343140] h-2 rounded-full mb-3">
              <motion.div
                className="bg-emerald-500 h-2 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${setupProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {setupProgress < 100
                ? `Setting up your drive (${setupProgress}%)...`
                : "Setup complete (100%)"}
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full mx-auto my-8 sm:my-10"
        >
          <SetupSuccessAnimation />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2 }}
            className="text-center mt-2 mb-6"
          >
            <motion.div className="flex justify-center items-center text-emerald-600 dark:text-emerald-500 font-medium mb-1">
              <Shield className="w-4 h-4 mr-1.5" />
              <span>Your files are protected</span>
            </motion.div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Only you have the keys to access your data
            </p>
          </motion.div>
        </motion.div>
      )}

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0 }}
        animate={{
          opacity: setupProgress === 100 ? 1 : 0,
          y: setupProgress === 100 ? 0 : 10,
        }}
        transition={{ duration: 0.4, delay: 2.5 }}
        onClick={handleCompleteSetup}
        className="mt-2 sm:mt-4 flex items-center justify-center w-full py-2.5 sm:py-3 px-4
          bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-medium
          cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-300
          active:bg-emerald-800 active:ring-0 active:ring-offset-0"
      >
        Continue to Dashboard
        <ArrowRight className="ml-2 w-4 h-4" />
      </motion.button>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0e0d12] overflow-y-auto">
      <div className="w-full z-10 fixed top-0 left-0 right-0">
        <TitleBar />
      </div>
      <div className="pt-8 sm:pt-12 pb-12 sm:pb-16 mt-4">
        {/* Progress indicator */}
        <div className="max-w-3xl mx-auto mb-8 sm:mb-12 px-4">
          <div className="flex items-center justify-center gap-2 sm:gap-3 overflow-x-auto py-1 no-scrollbar">
            <div className="flex items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{
                  scale: currentStep >= OnboardingStep.DRIVE_SETUP ? 1 : 0.8,
                  opacity: currentStep >= OnboardingStep.DRIVE_SETUP ? 1 : 0.7,
                }}
                className={`rounded-full ${
                  user?.onboardingFlags?.driveSetup?.completed
                    ? "bg-emerald-600 text-white"
                    : currentStep >= OnboardingStep.DRIVE_SETUP
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200/50 dark:bg-[#343140] text-black/70 dark:text-white/70"
                } w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-semibold text-xs sm:text-sm`}
              >
                {user?.onboardingFlags?.driveSetup?.completed ? (
                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  "1"
                )}
              </motion.div>
              <span className="ml-1.5 sm:ml-2 font-medium text-black dark:text-white text-xs sm:text-sm whitespace-nowrap">
                Drive Setup
              </span>
            </div>
            <div className="h-0.5 w-4 sm:w-8 bg-slate-200/50 dark:bg-[#343140] flex-shrink-0"></div>
            <div className="flex items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{
                  scale: currentStep >= OnboardingStep.ROOT_FOLDER ? 1 : 0.8,
                  opacity: currentStep >= OnboardingStep.ROOT_FOLDER ? 1 : 0.7,
                }}
                className={`rounded-full ${
                  user?.onboardingFlags?.rootFolder?.completed
                    ? "bg-emerald-600 text-white"
                    : currentStep >= OnboardingStep.ROOT_FOLDER
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200/50 dark:bg-[#343140] text-black/70 dark:text-white/70"
                } w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-semibold text-xs sm:text-sm`}
              >
                {user?.onboardingFlags?.rootFolder?.completed ? (
                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  "2"
                )}
              </motion.div>
              <span className="ml-1.5 sm:ml-2 font-medium text-black dark:text-white text-xs sm:text-sm whitespace-nowrap">
                Root Folder
              </span>
            </div>
            <div className="h-0.5 w-4 sm:w-8 bg-slate-200/50 dark:bg-[#343140] flex-shrink-0"></div>
            <div className="flex items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0.5 }}
                animate={{
                  scale: currentStep >= OnboardingStep.SETUP_COMPLETE ? 1 : 0.8,
                  opacity:
                    currentStep >= OnboardingStep.SETUP_COMPLETE ? 1 : 0.7,
                }}
                className={`rounded-full ${
                  setupProgress >= 100
                    ? "bg-emerald-600 text-white"
                    : currentStep >= OnboardingStep.SETUP_COMPLETE
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200/50 dark:bg-[#343140] text-black/70 dark:text-white/70"
                } w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center font-semibold text-xs sm:text-sm`}
              >
                {setupProgress >= 100 ? (
                  <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                ) : (
                  "3"
                )}
              </motion.div>
              <span className="ml-1.5 sm:ml-2 font-medium text-black dark:text-white text-xs sm:text-sm whitespace-nowrap">
                Completion
              </span>
            </div>
          </div>
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          {currentStep === OnboardingStep.DRIVE_SETUP && renderDriveSetup()}
          {currentStep === OnboardingStep.ROOT_FOLDER &&
            renderRootFolderSetup()}
          {currentStep === OnboardingStep.SETUP_COMPLETE &&
            renderSetupComplete()}
        </AnimatePresence>
      </div>

      {/* Toast for notifications */}
      {showToast && (
        <Toast
          toastMessage={toastMessage}
          setToastMessage={setToastMessage}
          setShowToast={setShowToast}
          showUndo={false}
          duration={5000}
        />
      )}
    </div>
  );
};

export default OnboardingPage;
