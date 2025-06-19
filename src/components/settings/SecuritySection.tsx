import React, { useState } from "react";
import { Pagination } from "../utils/Pagination";
import { SecurityEventModal } from "./SecurityEventModal";
import {
  AlertCircle,
  Clock,
  Download,
  Globe,
  Info,
  Key,
  Laptop2,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  Sparkles,
} from "lucide-react";
import { ApiService } from "../../services/ApiService";
import ClearEventsModal from "./ClearEventsModal";
import DownloadEventsModal from "./DownloadEventsModal";
import DisableFeatureModal from "./DisableFeatureModal";
import { Switch } from "../Switch";
import {
  SessionsSkeletonLoader,
  EventsSkeletonLoader,
} from "./SecuritySettingsSekeltonLoader";

type SecurityKeys = {
  dark_web_monitoring: string;
  two_factor_required: string;
  suspicious_activity_detection: string;
  detailed_events: string;
};

const SECURITY_KEYS: SecurityKeys = {
  dark_web_monitoring: "Dark Web Monitoring",
  two_factor_required: "Two-Factor Authentication",
  suspicious_activity_detection: "Suspicious Activity Detection",
  detailed_events: "Security Events",
};

interface SecuritySectionProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  subscription: Subscription | null;
  securitySettings: SecuritySettings | null;
  setSecuritySettings: React.Dispatch<
    React.SetStateAction<SecuritySettings | null>
  >;
  mfaSettings: MFASettings | null;
  setMfaSettings: React.Dispatch<React.SetStateAction<MFASettings | null>>;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
  itemsPerPage: number;
  formatTimestamp: (timestamp: any, isExpiry?: boolean) => string;
  activeSessions: Session[];
  sessionPage: number;
  totalSessions: number;
  sessionsLoading: boolean;
  fetchSessions: (page: number) => Promise<Session[]>;
  handleRevokeSession: (sessionId: string) => Promise<void>;
  handleRevokeAllSessions: () => Promise<void>;
  securityEvents: SecurityEvent[];
  eventPage: number;
  totalEvents: number;
  eventsLoading: boolean;
  fetchEvents: (page: number) => Promise<SecurityEvent[]>;
  handleClearEvents: () => Promise<void>;
  getEventIcon: (event: SecurityEvent) => React.JSX.Element;
  totpModalOpen: boolean;
  setTotpModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const SecuritySection: React.FC<SecuritySectionProps> = ({
  user,
  subscription,
  securitySettings,
  setSecuritySettings,
  mfaSettings,
  setMfaSettings,
  setToastMessage,
  setShowToast,
  setIsSaving,
  itemsPerPage,
  formatTimestamp,
  activeSessions,
  sessionPage,
  totalSessions,
  fetchSessions,
  handleRevokeSession,
  handleRevokeAllSessions,
  securityEvents,
  eventPage,
  totalEvents,
  fetchEvents,
  sessionsLoading,
  eventsLoading,
  handleClearEvents,
  getEventIcon,
  setTotpModalOpen,
}) => {
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(
    null,
  );
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [disableModalOpen, setDisableModalOpen] = useState<boolean>(false);
  const [featureToDisable, setFeatureToDisable] = useState<{
    type: "security" | "mfa";
    setting: string;
    title: string;
  } | null>(null);

  const isFreeUser = subscription?.planId === "free";

  const isSettingDisabled = (setting: string) => {
    if (
      setting === "dark_web_monitoring" ||
      setting === "suspicious_activity_detection"
    ) {
      return isFreeUser;
    }
    return false;
  };

  const isMfaMethodDisabled = (method: string) => {
    return (
      (method === "email" && !user?.emailVerified) ||
      (method === "phone" && !user?.phoneVerified)
    );
  };

  const getMfaMethodStatusText = (method: string) => {
    if (method === "email" && !user?.emailVerified) {
      return "Verify your email to enable";
    }
    if (method === "phone" && !user?.phoneVerified) {
      return "Verify your phone to enable";
    }
    return "";
  };

  const updateSecuritySetting = async (setting: string, enabled: boolean) => {
    try {
      setIsSaving(true);

      const securityData = {
        [setting]: enabled,
      };

      const response = await ApiService.updateSecuritySettings(securityData);

      setSecuritySettings(response.security);

      setToastMessage({
        type: "success",
        text: `${SECURITY_KEYS[setting as keyof SecurityKeys]} ${
          enabled ? "enabled" : "disabled"
        } successfully`,
      });
      setShowToast(true);
    } catch (error) {
      setToastMessage({
        type: "error",
        text: `Failed to update ${setting.replace(/_/g, " ")}`,
      });
      setShowToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSecurityToggle = (setting: string, currentValue: boolean) => {
    if (!isSettingDisabled(setting)) {
      if (!currentValue) {
        // Enable directly
        updateSecuritySetting(setting, true);
      } else {
        // Show confirmation before disabling
        setFeatureToDisable({
          type: "security",
          setting: setting,
          title: SECURITY_KEYS[setting as keyof SecurityKeys],
        });
        setDisableModalOpen(true);
      }
    }
  };

  const handleDisableConfirm = async () => {
    if (!featureToDisable) return;

    if (featureToDisable.type === "security") {
      updateSecuritySetting(featureToDisable.setting, false);
    } else if (featureToDisable.type === "mfa") {
      if (featureToDisable.setting === "totp") {
        updateMFAMethod("totp", {
          enabled: false,
          verified: false,
          secret: null,
        });
      } else {
        updateMFAMethod(featureToDisable.setting as "email" | "phone", {
          enabled: false,
        });
      }
    }

    setDisableModalOpen(false);
    setFeatureToDisable(null);
  };

  const handleClearEventsWithConfirmation = async () => {
    try {
      setIsProcessing(true);
      await handleClearEvents();
      setToastMessage({
        type: "success",
        text: "Security events cleared successfully",
      });
      setShowToast(true);
      setShowClearModal(false);
      fetchEvents(1);
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Failed to clear security events",
      });
      setShowToast(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerDownloadModal = () => {
    if (isFreeUser) {
      setToastMessage({
        type: "error",
        text: "Download feature is available with Pro plan",
      });
      setShowToast(true);
      return;
    }
    setShowDownloadModal(true);
  };

  const triggerClearModal = () => {
    setShowClearModal(true);
  };

  const updateMFAMethod = async <T extends "email" | "phone" | "totp">(
    method: T,
    update: T extends "totp" ? TOTPMethodUpdate : MFAMethodUpdate,
  ) => {
    try {
      setIsSaving(true);
      const payload = { methods: { [method]: update } };
      const response = await ApiService.updateMFASettings(payload);
      setMfaSettings(response.mfa);
      setToastMessage({
        type: "success",
        text: `${
          method.charAt(0).toUpperCase() + method.slice(1)
        } authentication ${
          update.enabled ? "enabled" : "disabled"
        } successfully`,
      });
      setShowToast(true);
    } catch (error) {
      setToastMessage({
        type: "error",
        text: `Failed to update ${method} authentication`,
      });
      setShowToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMfaToggle = (method: string, details: any) => {
    if (isMfaMethodDisabled(method)) return;

    if (method === "email" || method === "phone") {
      if (details.enabled) {
        // Show confirm dialog before disabling
        const title = {
          email: "Email Authentication",
          phone: "SMS Authentication",
        }[method];

        setFeatureToDisable({
          type: "mfa",
          setting: method,
          title: title,
        });
        setDisableModalOpen(true);
      } else {
        // Enable directly
        updateMFAMethod(method as "email" | "phone", {
          enabled: true,
        });
      }
    } else if (method === "totp") {
      if (!details.enabled) {
        setTotpModalOpen(true);
      } else {
        // Show confirm dialog before disabling
        setFeatureToDisable({
          type: "mfa",
          setting: "totp",
          title: "Authenticator App",
        });
        setDisableModalOpen(true);
      }
    }
  };

  const sanitizeEventType = (eventType: string): string => {
    return eventType
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  };

  return (
    <div className="flex flex-col h-full pb-6 lg:pb-2">
      {/* Static Header */}
      <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Security Settings
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your account security and authentication methods
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-grow pr-[2px]">
        <div className="space-y-6 pb-6 pr-2">
          <div className="space-y-4">
            {[
              {
                icon: Shield,
                title: "Dark Web Monitoring",
                description: "Get notified if your data appears in breaches",
                setting: "dark_web_monitoring",
                enabled: securitySettings?.darkWebMonitoring,
                isPro: true,
                tooltip: "Available with Pro subscription",
              },
              {
                icon: Key,
                title: "Two-Factor Authentication",
                description: "Add an extra layer of security to your account",
                setting: "two_factor_required",
                enabled: securitySettings?.twoFactorRequired,
              },
              {
                icon: AlertCircle,
                title: "Suspicious Activity Detection",
                description: "Get alerts for unusual login attempts",
                setting: "suspicious_activity_detection",
                enabled: securitySettings?.suspiciousActivityDetection,
                isPro: true,
                tooltip: "Available with Pro subscription",
              },
              {
                icon: Globe,
                title: "Security Events",
                description:
                  "Track authentication attempts and security-related activities",
                setting: "detailed_events",
                enabled: securitySettings?.detailedEvents,
              },
            ].map((item) => (
              <div
                key={item.setting}
                className={`relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200 ${
                  isSettingDisabled(item.setting)
                    ? "opacity-80"
                    : "hover:shadow-md"
                }`}
              >
                <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none">
                  <item.icon className="w-full h-full text-emerald-500" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0 pr-10 sm:pr-0">
                    <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                      <item.icon className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {item.title}
                        </h3>
                        {item.isPro && isFreeUser && (
                          <span className="inline-flex items-center px-2 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                            PRO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {item.description}
                      </p>
                      {item.isPro && isFreeUser && (
                        <p className="text-xs text-amber-500 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <Sparkles className="h-3.5 w-3.5" />
                          {item.tooltip}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="absolute top-4 right-4 sm:static sm:flex-shrink-0">
                    <Switch
                      enabled={!!item.enabled}
                      onChange={() =>
                        handleSecurityToggle(item.setting, !!item.enabled)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}

            {securitySettings?.twoFactorRequired && (
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Multi-Factor Authentication Methods
                </h3>

                {(!user?.emailVerified || !user?.phoneVerified) && (
                  <div className="p-4 mb-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-amber-700 dark:text-amber-400">
                      <p className="font-medium mb-1">
                        Contact information required
                      </p>
                      <p>
                        {!user?.emailVerified && !user?.phoneVerified
                          ? "You need to add both an email address and phone number to enable multi-factor authentication."
                          : !user.emailVerified
                            ? "You need to add an email address to enable email-based authentication."
                            : "You need to add a phone number to enable SMS-based authentication."}
                      </p>
                    </div>
                  </div>
                )}

                {mfaSettings?.methods &&
                  Object.entries(mfaSettings.methods).map(
                    ([method, details]: [string, any]) => {
                      const Icon = {
                        email: Mail,
                        phone: Phone,
                        totp: Key,
                      }[method];

                      const title = {
                        email: "Email Authentication",
                        phone: "SMS Authentication",
                        totp: "Authenticator App",
                      }[method];

                      const isDisabled = isMfaMethodDisabled(method);
                      const statusText = getMfaMethodStatusText(method);

                      return (
                        <div
                          key={method}
                          className={`relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200 ${
                            isDisabled ? "opacity-70" : "hover:shadow-md"
                          }`}
                        >
                          <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none">
                            {Icon && (
                              <Icon className="w-full h-full text-emerald-500" />
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-start gap-3 flex-1 min-w-0 pr-10 sm:pr-0">
                              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                                {Icon && (
                                  <Icon className="h-5 w-5 text-emerald-500" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                  {title}
                                </h3>
                                <div className="flex items-center flex-wrap gap-2 mt-0.5">
                                  <span
                                    className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                                      details.verified
                                        ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                        : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                                    }`}
                                  >
                                    {details.verified
                                      ? "Verified"
                                      : "Not verified"}
                                  </span>

                                  {statusText && (
                                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <AlertCircle className="h-3 w-3" />
                                      {statusText}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {method && (
                              <div className="absolute top-4 right-4 sm:static sm:flex-shrink-0">
                                <Switch
                                  enabled={!!details.enabled}
                                  onChange={() =>
                                    handleMfaToggle(method, details)
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
              </div>
            )}
          </div>

          <div className="mt-8">
            <div className="space-y-6">
              <div className="flex flex-col space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Session Management
                    </h3>
                  </div>
                  {totalSessions > itemsPerPage && (
                    <Pagination
                      currentPage={sessionPage}
                      onPageChange={(page) => fetchSessions(page)}
                      totalItems={totalSessions}
                      itemsPerPage={itemsPerPage}
                    />
                  )}
                </div>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Your session will remain active unless you sign out or change
                  your password. Sessions automatically expire after 30 days of
                  inactivity or 90 days in total.
                </p>
              </div>

              {/* Sessions loading state or content */}
              {sessionsLoading ? (
                <SessionsSkeletonLoader count={3} />
              ) : (
                <div className="space-y-4">
                  {activeSessions && activeSessions.length > 0 ? (
                    activeSessions.map((session) => (
                      <div
                        key={session.id}
                        className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200 hover:shadow-md"
                      >
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none">
                          <Laptop2 className="w-full h-full text-emerald-500" />
                        </div>

                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div className="flex items-start gap-3 pr-10 sm:pr-0">
                              <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                                <Laptop2 className="h-5 w-5 text-emerald-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center flex-wrap gap-2 mb-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {session.deviceName || "Unknown Device"}
                                  </span>
                                  {session.isCurrent && (
                                    <div className="flex items-center gap-2 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 rounded-md">
                                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                        Current Session
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-slate-100 dark:bg-[#2c2934] text-gray-600 dark:text-gray-400 rounded-md">
                                    <span className="font-medium">
                                      App Version:
                                    </span>{" "}
                                    {session.appVersion}
                                  </span>

                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs bg-slate-100 dark:bg-[#2c2934] text-gray-600 dark:text-gray-400 rounded-md">
                                    <Globe className="h-3 w-3 text-emerald-600" />
                                    <span className="font-medium">IP:</span>{" "}
                                    {session.ipAddress}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {!session.isCurrent && (
                              <div className="sm:flex-shrink-0">
                                <button
                                  onClick={() =>
                                    handleRevokeSession(session.id)
                                  }
                                  className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer"
                                  aria-label="Revoke session access"
                                >
                                  Revoke Access
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-slate-100 dark:bg-[#2c2934] rounded-lg">
                              <Clock className="h-3.5 w-3.5 text-emerald-500" />
                              <span>
                                Created {formatTimestamp(session.createdAt)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-slate-100 dark:bg-[#2c2934] rounded-lg">
                              <Info className="h-3.5 w-3.5 text-emerald-500" />
                              <span>
                                Expires{" "}
                                {formatTimestamp(session.expiresAt, true)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
                      <Laptop2 className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-3" />
                      <p className="text-sm font-medium">
                        No active sessions found
                      </p>
                      <p className="text-xs mt-1">
                        Any devices you log in from will appear here
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeSessions && activeSessions.length > 1 && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleRevokeAllSessions}
                    className="w-full px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-500 border border-emerald-600 dark:border-emerald-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors cursor-pointer"
                    aria-label="Revoke all other sessions"
                  >
                    Revoke All Other Sessions
                  </button>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                    This will sign you out from all devices except your current
                    one
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8">
            <div className="flex flex-col space-y-2 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Security Events
                  </h3>
                </div>

                {totalEvents > itemsPerPage && (
                  <Pagination
                    currentPage={eventPage}
                    onPageChange={(page) => fetchEvents(page)}
                    totalItems={totalEvents}
                    itemsPerPage={itemsPerPage}
                  />
                )}
              </div>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Track login attempts, password changes, and other
                security-related activities to keep your account secure.
                {isFreeUser &&
                  " Upgrade to Pro for detailed event information and enhanced security features."}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <button
                  onClick={() => fetchEvents(eventPage)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-500 bg-white dark:bg-[#1c1b23] border border-emerald-200 dark:border-emerald-900/40 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
                  aria-label="Refresh events"
                >
                  <RefreshCw className="h-4 w-4" />

                  <span>Refresh</span>
                </button>

                <button
                  onClick={triggerDownloadModal}
                  disabled={securityEvents.length === 0}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white dark:bg-[#1c1b23] border rounded-lg transition-colors
                    cursor-pointer disabled:cursor-not-allowed disabled:opacity-70
                    ${
                      isFreeUser
                        ? "text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-700"
                        : "text-emerald-600 dark:text-emerald-500 border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                    }`}
                  aria-label="Download security events"
                >
                  <Download className="h-4 w-4" />

                  <span>Download</span>

                  {isFreeUser && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                      PRO
                    </span>
                  )}
                </button>

                <button
                  onClick={triggerClearModal}
                  disabled={securityEvents.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-500 bg-white dark:bg-[#1c1b23] border border-red-200 dark:border-red-900/40 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label="Clear security events history"
                >
                  <span>Clear History</span>
                </button>
              </div>
            </div>

            {/* Events loading state or content */}
            {eventsLoading ? (
              <EventsSkeletonLoader count={5} />
            ) : (
              <div className="space-y-4">
                {!securityEvents || securityEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                    <div className="relative group animate-float">
                      <div className="absolute inset-0 bg-emerald-500/20 dark:bg-emerald-500/10 rounded-3xl blur-xl transform group-hover:scale-110 transition-transform duration-300" />
                      <div className="relative w-24 h-24 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-3xl flex items-center justify-center mb-6 transform group-hover:scale-105 transition-transform duration-300">
                        <Shield className="w-12 h-12 text-emerald-500 dark:text-emerald-400" />
                      </div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      No Security Events Yet
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md">
                      Security events like login attempts, password changes, and
                      other important account activities will appear here as
                      they occur. This helps you monitor your account security.
                    </p>
                  </div>
                ) : (
                  securityEvents.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 shadow-sm transition-all duration-200 hover:shadow-md cursor-pointer group"
                      tabIndex={0}
                      role="button"
                      aria-label={`View details for ${event.eventType} event`}
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none">
                        <Shield className="w-full h-full text-emerald-500" />
                      </div>

                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5 group-hover:border-emerald-500/30 transition-colors">
                          {getEventIcon(event)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center flex-wrap gap-2">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                  {sanitizeEventType(event.eventType)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {!isFreeUser && event?.metadata?.device && (
                                  <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 dark:bg-[#2c2934] text-gray-600 dark:text-gray-400 rounded-full">
                                    {event.metadata.device.deviceName ||
                                      "Unknown device"}
                                  </span>
                                )}
                                <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 dark:bg-[#2c2934] text-gray-600 dark:text-gray-400 rounded-full">
                                  IP:{" "}
                                  {isFreeUser
                                    ? event.metadata?.device?.ipAddress
                                    : event.metadata?.device?.ipAddress ||
                                      "Unknown"}
                                </span>
                                {!isFreeUser &&
                                  event.metadata?.device?.appVersion && (
                                    <span className="inline-flex items-center px-2 py-0.5 text-xs bg-slate-100 dark:bg-[#2c2934] text-gray-600 dark:text-gray-400 rounded-full">
                                      {event.metadata.device.appVersion}
                                    </span>
                                  )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {formatTimestamp(event.createdAt)}
                            </span>
                          </div>
                          {!isFreeUser && event.metadata?.description && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-slate-100 dark:bg-[#2c2934] rounded-lg">
                              <Info className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                              <span>{event.metadata.description}</span>
                            </div>
                          )}
                          {isFreeUser && (
                            <div className="mt-3 flex items-center gap-2 px-3 py-2 text-xs text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                              <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                              <span>
                                Upgrade to Pro to see detailed event information
                                and device details
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedEvent && (
        <SecurityEventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          formatTimestamp={formatTimestamp}
          subscriptionPlanId={subscription?.planId}
          sanitizeEventType={sanitizeEventType}
          onUpgradeClick={() => {
            setSelectedEvent(null);
          }}
        />
      )}

      <ClearEventsModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearEventsWithConfirmation}
        isProcessing={isProcessing}
      />

      <DownloadEventsModal
        isOpen={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        setShowToast={(show) => setShowToast(show)}
        setToastMessage={(message) => setToastMessage(message)}
      />

      <DisableFeatureModal
        isOpen={disableModalOpen}
        onClose={() => {
          setDisableModalOpen(false);
          setFeatureToDisable(null);
        }}
        onConfirm={handleDisableConfirm}
        featureTitle={featureToDisable?.title || ""}
        featureType={featureToDisable?.type || "security"}
      />
    </div>
  );
};

export default SecuritySection;
