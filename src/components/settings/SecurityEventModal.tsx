import React, { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Globe,
  Info,
  Laptop2,
  Navigation,
  Shield,
  ShieldCheck,
  Lock,
  CreditCard,
  Sparkles,
  AlertCircle,
  Key,
} from "lucide-react";
import { Modal } from "../Modal";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";

interface SecurityEvent {
  id: string;
  user_id: string;
  event_type: string;
  success: boolean;
  metadata: {
    nonce?: string;
    device?: {
      device_id?: string;
      ip_address?: string;
      user_agent?: string;
      app_version?: string;
      device_name?: string;
    };
    location?: {
      ip?: string;
      isp?: string;
      city?: string;
      region?: string;
      country?: string;
      timezone?: string;
    };
    method?: string | null;
    attempts?: number | null;
    description?: string | null;
    session_id?: string;
    [key: string]: any; // To allow for any other metadata fields
  };
  created_at: number;
}

interface SystemIdentifier {
  hash: string;
}

interface SecurityEventModalProps {
  event: SecurityEvent;
  onClose: () => void;
  formatTimestamp: (timestamp: any, isExpiry?: boolean) => string;
  subscriptionPlanId: string | undefined;
  sanitizeEventType: (eventType: string) => string;
  onUpgradeClick: () => void;
}

export const SecurityEventModal: React.FC<SecurityEventModalProps> = ({
  event,
  onClose,
  formatTimestamp,
  subscriptionPlanId = "free",
  sanitizeEventType,
  onUpgradeClick,
}) => {
  const [isCurrentDevice, setIsCurrentDevice] = useState(false);
  const isPaidUser = [
    "plus",
    "pro",
    "max",
    "family",
    "business",
    "enterprise",
  ].includes(subscriptionPlanId || "");
  const tooltipRef = useRef<HTMLDivElement>(null);
  const tooltipTriggerRef = useRef<HTMLButtonElement>(null);
  const systemIdentifierCheckRef = useRef<boolean>(false);

  // Function to mask sensitive values - only used for device ID and user agent
  const maskSensitiveValue = (
    value: string | undefined,
    showChars: number = 4,
  ): string => {
    if (!value) return "Unknown";
    if (value.length <= showChars * 2) return value; // Don't mask if very short

    const firstPart = value.substring(0, showChars);
    const lastPart = value.substring(value.length - showChars);
    return `${firstPart}...${lastPart}`;
  };

  // Close tooltip on scroll
  useEffect(() => {
    const handleScroll = () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.display = "none";
      }
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, []);

  // Check if current device matches the event device
  useEffect(() => {
    // Check if we've already run this check
    if (systemIdentifierCheckRef.current) {
      return;
    }

    // Mark as running to prevent duplicate calls
    systemIdentifierCheckRef.current = true;

    // Run the actual check
    const checkCurrentDevice = async () => {
      try {
        // Safely access device_id and handle missing values
        const eventDeviceId = event.metadata?.device?.device_id;

        if (!eventDeviceId) {
          setIsCurrentDevice(false);
          return;
        }

        const response: SystemIdentifier = await invoke(
          "generate_system_identifier",
        );

        if (response && response.hash) {
          const isCurrentDevice = response.hash === eventDeviceId;
          setIsCurrentDevice(isCurrentDevice);
        } else {
          setIsCurrentDevice(false);
        }
      } catch (error) {
        console.error("Error checking system identifier:", error);
        setIsCurrentDevice(false);
      }
    };

    checkCurrentDevice();
  }, [event.metadata?.device?.device_id]); // Only depend on the device ID

  const showTooltip = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = "block";
      const rect = e.currentTarget.getBoundingClientRect();
      tooltipRef.current.style.left = `${
        rect.left + window.scrollX - 125 + rect.width / 2
      }px`;
      tooltipRef.current.style.top = `${rect.top + window.scrollY - 70}px`;
    }
  };

  const hideTooltip = () => {
    if (tooltipRef.current) {
      tooltipRef.current.style.display = "none";
    }
  };

  // Extract device info from event data
  const getDeviceInfo = () => {
    const deviceNameRaw =
      event.metadata?.device?.device_name || "Unknown Device";

    // Default values
    let deviceType = "Unknown";
    let system = "Unknown";
    let osVersion = "Unknown";

    // Handle macOS format specifically: "macOS 15.3.2 Sequoia"
    const macOSMatch = deviceNameRaw.match(/^(macOS)\s+([\d.]+)\s+(.+)$/);
    if (macOSMatch) {
      deviceType = "Mac";
      system = macOSMatch[1]; // Just "macOS"
      osVersion = `${macOSMatch[3]} ${macOSMatch[2]}`; // "Sequoia 15.3.2"
    }
    // Handle Windows format
    else if (deviceNameRaw.includes("Windows")) {
      deviceType = "PC";
      system = "Windows";
      osVersion = deviceNameRaw.replace("Windows", "").trim();
    }
    // Handle standard format with parentheses: "Device Name (OS Info)"
    else {
      const deviceMatch = deviceNameRaw.match(/(.*)\s*\((.*)\)/);
      if (deviceMatch) {
        deviceType = deviceMatch[1].trim();
        const osParts = deviceMatch[2].trim().split(" ");
        if (osParts.length > 1) {
          system = osParts[0];
          osVersion = osParts.slice(1).join(" ");
        } else {
          system = deviceMatch[2].trim();
        }
      } else {
        // Fall back to using the whole string
        const parts = deviceNameRaw.split(" ");
        if (parts.length > 1) {
          system = parts[0];
          osVersion = parts.slice(1).join(" ");
        } else {
          system = deviceNameRaw;
        }
      }
    }

    return {
      deviceType: deviceType,
      system: system,
      osVersion: osVersion,
      appVersion: event.metadata?.device?.app_version || null,
      userAgent: event.metadata?.device?.user_agent || null,
      eventStatus: event.success,
    };
  };

  const deviceInfo = getDeviceInfo();

  // Get a status badge color based on event success
  const getStatusColor = () => {
    return event.success ? "emerald" : "rose";
  };

  const getStatusBadge = () => {
    const color = getStatusColor();
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-400 rounded-full`}
      >
        {event.success ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5" />
            Success
          </>
        ) : (
          <>
            <AlertCircle className="w-3.5 h-3.5" />
            Failed
          </>
        )}
      </span>
    );
  };

  const DeviceSection = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Laptop2 className={`w-4 h-4 text-${getStatusColor()}-500`} />
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Device Info
          </h4>
        </div>
        {isCurrentDevice && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Current Device
          </span>
        )}
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">Device Type</span>
          <span className="text-gray-900 dark:text-white">
            {deviceInfo.deviceType}
          </span>
        </div>
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">System</span>
          <span className="text-gray-900 dark:text-white">
            {deviceInfo.system}
          </span>
        </div>
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">OS Version</span>
          <span className="text-gray-900 dark:text-white">
            {deviceInfo.osVersion}
          </span>
        </div>
        {deviceInfo.appVersion && (
          <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
            <span className="text-gray-500 dark:text-gray-400">
              App Version
            </span>
            <span className="text-gray-900 dark:text-white">
              {deviceInfo.appVersion}
            </span>
          </div>
        )}
        {!deviceInfo.appVersion && deviceInfo.userAgent && isPaidUser && (
          <div className="p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
            <div className="flex justify-between mb-1">
              <span className="text-gray-500 dark:text-gray-400">
                User Agent
              </span>
            </div>
            <p className="text-xs text-gray-900 dark:text-white break-all">
              {maskSensitiveValue(deviceInfo.userAgent, 15)}
            </p>
          </div>
        )}
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">Device ID</span>
          <span
            className="text-gray-900 dark:text-white max-w-[200px] truncate text-right hover:overflow-visible hover:whitespace-normal hover:text-clip cursor-help"
            title="Device ID (partially masked for security)"
          >
            {maskSensitiveValue(event.metadata?.device?.device_id, 6)}
          </span>
        </div>
      </div>
    </div>
  );

  const NetworkSection = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Globe className={`w-4 h-4 text-${getStatusColor()}-500`} />
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          Network Info
        </h4>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg relative">
          <span className="text-gray-500 dark:text-gray-400">IP Address</span>
          <div className="flex items-center gap-2">
            <span
              className="text-gray-900 dark:text-white max-w-[60%] truncate text-right hover:overflow-visible hover:whitespace-normal hover:text-clip cursor-help"
              title={
                event.metadata?.location?.ip ||
                event.metadata?.device?.ip_address ||
                "Unknown"
              }
            >
              {event.metadata?.location?.ip ||
                event.metadata?.device?.ip_address ||
                "Unknown"}
            </span>
            <div className="inline-block">
              <button
                ref={tooltipTriggerRef}
                className="p-1 rounded-full hover:bg-zinc-100 hover:dark:bg-zinc-800 transition-colors relative cursor-pointer"
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  className="text-zinc-400"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">ISP</span>
          <span className="text-gray-900 dark:text-white">
            {event.metadata?.location?.isp || "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );

  const LocationSection = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Navigation className={`w-4 h-4 text-${getStatusColor()}-500`} />
        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
          Location Details
        </h4>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">City</span>
          <span className="text-gray-900 dark:text-white">
            {event.metadata?.location?.city || "Unknown"}
          </span>
        </div>
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">Region</span>
          <span className="text-gray-900 dark:text-white">
            {event.metadata?.location?.region || "Unknown"}
          </span>
        </div>
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">Country</span>
          <span className="text-gray-900 dark:text-white">
            {event.metadata?.location?.country || "Unknown"}
          </span>
        </div>
        <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
          <span className="text-gray-500 dark:text-gray-400">Timezone</span>
          <span className="text-gray-900 dark:text-white">
            {event.metadata?.location?.timezone || "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );

  const SessionSection = () => {
    if (!event.metadata?.session_id && !event.metadata?.nonce) {
      return null;
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Key className={`w-4 h-4 text-${getStatusColor()}-500`} />
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Session Info
          </h4>
        </div>
        <div className="space-y-2 text-sm">
          {event.metadata?.session_id && (
            <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
              <span className="text-gray-500 dark:text-gray-400">
                Session ID
              </span>
              <span
                className="text-gray-900 dark:text-white max-w-[60%] truncate text-right hover:overflow-visible hover:whitespace-normal hover:text-clip cursor-help"
                title="Session ID (masked by server)"
              >
                {event.metadata.session_id}
              </span>
            </div>
          )}
          {event.metadata?.nonce && (
            <div className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg">
              <span className="text-gray-500 dark:text-gray-400">Nonce</span>
              <span
                className="text-gray-900 dark:text-white max-w-[60%] truncate text-right hover:overflow-visible hover:whitespace-normal hover:text-clip cursor-help"
                title="Nonce (masked by server)"
              >
                {event.metadata.nonce}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const AdditionalDetailsSection = () => {
    // Get all metadata entries for display
    const metadataEntries = Object.entries(event.metadata || {}).filter(
      ([key, value]) => {
        // Skip already handled objects and null/undefined values
        if (key === "device" || key === "location") return false;
        if (value === null || value === undefined) return false;
        if (typeof value === "object" && Object.keys(value).length === 0)
          return false;
        return true;
      },
    );

    // Only render section if there's something to show
    if (metadataEntries.length === 0) {
      return null;
    }

    // Format a metadata value for display
    const formatValue = (value: any) => {
      if (value === null || value === undefined) return "N/A";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    };

    // Format the key for display
    const formatKey = (key: string) => {
      return key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Info className={`w-4 h-4 text-${getStatusColor()}-500`} />
          <h4 className="text-sm font-medium text-gray-900 dark:text-white">
            Additional Details
          </h4>
        </div>
        <div className="space-y-2 text-sm">
          {metadataEntries.map(([key, value]) => {
            const formattedKey = formatKey(key);
            let formattedValue = formatValue(value);
            const isLongValue = formattedValue.length > 30;

            // No need to mask sensitive values as they're already masked by the server
            // Only show them as received from the backend

            // For longer text values (like descriptions)
            if (
              isLongValue &&
              ["description", "message", "reason", "details", "error"].includes(
                key,
              )
            ) {
              return (
                <div
                  key={key}
                  className="p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg"
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500 dark:text-gray-400">
                      {formattedKey}
                    </span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-white break-all">
                    {formattedValue}
                  </p>
                </div>
              );
            }

            // For shorter values or key-value pairs
            return (
              <div
                key={key}
                className="flex justify-between p-2 bg-gray-100 dark:bg-[#2c2934]/70 rounded-lg"
              >
                <span className="text-gray-500 dark:text-gray-400">
                  {formattedKey}
                </span>
                <span
                  className="text-gray-900 dark:text-white max-w-[60%] truncate text-right hover:overflow-visible hover:whitespace-normal hover:text-clip cursor-help"
                  title={formattedValue}
                >
                  {formattedValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderUpgradeOverlay = () => (
    <div className="absolute inset-0 z-10 backdrop-blur-sm bg-white/40 dark:bg-black/40 rounded-xl flex items-center justify-center">
      <div className="text-center p-6 max-w-md">
        <div className="relative inline-block mb-4">
          <Sparkles
            className={`w-12 h-12 text-${getStatusColor()}-500 mx-auto`}
          />
          <div className="absolute -top-1 -right-1">
            <Lock className={`w-5 h-5 text-${getStatusColor()}-400`} />
          </div>
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          Upgrade to Pro for Full Access
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Get detailed security insights including:
        </p>
        <ul className="text-left text-gray-600 dark:text-gray-300 mb-6 space-y-2">
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 text-${getStatusColor()}-500 flex-shrink-0`}
            />
            <span>Complete device information</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 text-${getStatusColor()}-500 flex-shrink-0`}
            />
            <span>Detailed location tracking</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 text-${getStatusColor()}-500 flex-shrink-0`}
            />
            <span>Network security monitoring</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle2
              className={`w-4 h-4 text-${getStatusColor()}-500 flex-shrink-0`}
            />
            <span>Advanced security analytics</span>
          </li>
        </ul>
        <button
          onClick={onUpgradeClick}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3 bg-${getStatusColor()}-600 hover:bg-${getStatusColor()}-700 text-white rounded-lg transition-colors text-sm font-medium group cursor-pointer`}
        >
          <CreditCard className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
          Upgrade to Pro
        </button>
      </div>
    </div>
  );

  // Determine header background color based on event success
  const headerBgColor = event.success
    ? "bg-emerald-50 dark:bg-emerald-900/10"
    : "bg-rose-50 dark:bg-rose-900/10";

  return (
    <Modal
      isOpen={Boolean(event)}
      onClose={onClose}
      title="Security Event Details"
      icon={Shield}
      iconColor={getStatusColor()}
      footer={
        <div className="flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className={`px-6 py-2.5 text-sm font-medium bg-${getStatusColor()}-600 hover:bg-${getStatusColor()}-700 dark:bg-${getStatusColor()}-600 dark:hover:bg-${getStatusColor()}-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer`}
          >
            Close
          </motion.button>
        </div>
      }
    >
      <div className="p-6 overflow-y-auto relative">
        <div
          className={`mb-6 p-4 ${headerBgColor} rounded-lg border-l-4 border-${getStatusColor()}-500`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`p-2 bg-${getStatusColor()}-100 dark:bg-${getStatusColor()}-900/30 rounded-lg`}
            >
              <ShieldCheck
                className={`w-5 h-5 text-${getStatusColor()}-600 dark:text-${getStatusColor()}-400`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Security Event
                </h4>
                {getStatusBadge()}
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Event Type
                  </p>
                  <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                    {isPaidUser
                      ? sanitizeEventType(event.event_type)
                      : "Security Event"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Timestamp
                  </p>
                  <p className="text-base font-medium text-gray-900 dark:text-white mt-1">
                    {formatTimestamp(event.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`space-y-6 ${!isPaidUser && "filter blur-sm select-none"}`}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <DeviceSection />
              <NetworkSection />
              <SessionSection />
            </div>
            <div className="space-y-6">
              <LocationSection />
              <AdditionalDetailsSection />
            </div>
          </div>
        </div>

        {!isPaidUser && renderUpgradeOverlay()}

        {/* Tooltip positioned fixed but hidden by default */}
        <div
          ref={tooltipRef}
          style={{
            display: "none",
            position: "fixed",
            zIndex: 9999,
            left: 0,
            top: 0,
            width: "250px",
          }}
          className="text-center pointer-events-none"
        >
          <div className="relative bg-white dark:bg-[#2c2934] text-gray-800 dark:text-white text-sm rounded-lg p-3 shadow-lg border border-slate-200/60 dark:border-[#343140]/60">
            IP address may not be accurate if using a VPN connection
            <svg
              className="absolute -bottom-2 left-1/2 -translate-x-1/2 rotate-180 text-white dark:text-[#2c2934]"
              width="16"
              height="8"
              viewBox="0 0 16 8"
              fill="currentColor"
            >
              <path d="M0 8L8 0L16 8H0Z" />
            </svg>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SecurityEventModal;
