import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import {
  CreditCard,
  User as UserIcon,
  Palette,
  Shield,
  LayoutDashboard,
  XCircle,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ApiService } from "../services/ApiService";
import { useSecurityEvents } from "../hooks/useSecurityEvents";
import { useSessions } from "../hooks/useSessions";
import { SettingsSkeletonLoader } from "../components/utils/SettingsSkeletonLoader";
import Toast from "../components/Toast";
import RecoverySection from "../components/settings/RecoverySection";
import TOTPSetupModal from "../components/settings/TOTPSetupModal";
import { BillingSection } from "../components/settings/BillingSection";
import { AppearanceSection } from "../components/settings/AppearanceSection";
import { SecuritySection } from "../components/settings/SecuritySection";
import { AccountSection } from "../components/settings/AccountSection";
import { DashboardSection } from "../components/settings/DashboardSection";
import { useSearchParams } from "react-router-dom";

type Sections =
  | "dashboard"
  | "security"
  | "recovery"
  | "account"
  | "billing"
  | "appearance";

const SettingsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<Sections>("dashboard");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    type: "success",
    text: "",
  });
  const [totpModalOpen, setTotpModalOpen] = useState(false);

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [securitySettings, setSecuritySettings] =
    useState<SecuritySettings | null>(null);
  const [mfaSettings, setMfaSettings] = useState<MFASettings | null>(null);
  const [recoveryMethod, setRecoveryMethod] = useState<RecoveryMethod | null>(
    null,
  );
  const [availablePlans, setAvailablePlans] = useState<FeaturedPlans | null>(
    null,
  );

  const [searchParams, setSearchParams] = useSearchParams();

  // Ref for the main content area to control scrolling
  const mainContentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const itemsPerPage = 5;

  const { user, setUser } = useAuth();

  const sections = useMemo(
    () => [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "security", label: "Security", icon: Shield },
      { id: "recovery", label: "Recovery", icon: ShieldCheck },
      { id: "account", label: "Account", icon: UserIcon },
      { id: "billing", label: "Billing", icon: CreditCard },
      { id: "appearance", label: "Appearance", icon: Palette },
    ],
    [],
  );

  const {
    securityEvents,
    eventPage,
    totalEvents,
    isLoading: eventsLoading,
    fetchEvents,
    handleClearEvents,
  } = useSecurityEvents({
    itemsPerPage,
    setToastMessage,
    setShowToast,
  });

  const {
    activeSessions,
    sessionPage,
    totalSessions,
    isLoading: sessionsLoading,
    fetchSessions,
    handleRevokeSession,
    handleRevokeAllSessions,
  } = useSessions({
    itemsPerPage,
    setToastMessage,
    setShowToast,
  });

  // Handle section changes from URL params
  useEffect(() => {
    const sectionParam = searchParams.get("section");

    const validSectionIds = sections.map((section) => section.id);

    if (sectionParam && validSectionIds.includes(sectionParam)) {
      setActiveSection(sectionParam as Sections);
    } else {
      setActiveSection("dashboard");
    }
  }, [sections, searchParams]);

  // Scroll to top when section changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [activeSection]);

  // Handle layout adjustments
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && mainContentRef.current) {
        // Recalculate available height
        adjustContentHeight();
      }
    };

    const adjustContentHeight = () => {
      if (!containerRef.current || !mainContentRef.current) return;

      const containerHeight = containerRef.current.clientHeight;
      const headerHeight = 48; // 12 * 4 (3rem)

      // For large screens, add bottom padding
      const bottomGap = window.innerWidth >= 1024 ? 24 : 0; // Add bottom gap for lg screens
      const paddingHeight = window.innerWidth >= 1024 ? 48 : 0; // 6 * 8 (3rem) for lg screens

      // Calculate available height with bottom gap
      const availableHeight =
        containerHeight - headerHeight - paddingHeight - bottomGap;

      mainContentRef.current.style.maxHeight = `${availableHeight}px`;
    };

    window.addEventListener("resize", handleResize);

    // Initial adjustment
    handleResize();

    // Adjust after content loads
    setTimeout(adjustContentHeight, 100);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [isLoading, activeSection]);

  const formatBytes = (bytes: number) => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatTimestamp = (timestamp: number, isExpiry = false) => {
    if (!timestamp) return "N/A";

    const date = new Date(timestamp * 1000);
    const now = new Date();

    const timestampNum =
      typeof timestamp === "string" ? Date.parse(timestamp) / 1000 : timestamp;

    if (isExpiry) {
      return new Date(timestampNum * 1000)
        .toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(",", " at");
    }

    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return "just now";
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  const getEventIcon = (event: SecurityEvent) => {
    if (!event.success) {
      return <XCircle className="h-4 w-4 text-red-400" />;
    }
    return <ShieldCheck className="h-4 w-4 text-emerald-400" />;
  };

  const fetchSubscription = useCallback(async () => {
    try {
      const response = await ApiService.getSubscriptionStatus();
      if (response.code === 1000) {
        setSubscription(response.subscription);
        setUser((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            max_drive_space: response.subscription.storage.total,
          };
        });
      }
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Error fetching plan. Please try again.",
      });
      setShowToast(true);
    }
  }, [setUser]);

  const fetchSecuritySettings = useCallback(async () => {
    try {
      const [securityResponse, mfaResponse] = await Promise.all([
        ApiService.securitySettings(),
        ApiService.MFASettings(),
      ]);
      setSecuritySettings(securityResponse.security);
      setMfaSettings(mfaResponse.mfa);
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Failed to fetch security settings",
      });
      setShowToast(true);
    }
  }, []);

  const fetchRecoveryMethod = useCallback(async () => {
    try {
      const response = await ApiService.recoveryMethods();

      if (!response?.recovery_methods) {
        const defaultMethod: RecoveryMethod = {
          account_recovery: {
            email: {
              email: null,
              enabled: false,
              last_used: null,
              created_at: Math.floor(Date.now() / 1000),
              modified_at: Math.floor(Date.now() / 1000),
              email_verified: false,
            },
            phone: {
              phone: null,
              enabled: false,
              last_used: null,
              created_at: Math.floor(Date.now() / 1000),
              modified_at: Math.floor(Date.now() / 1000),
              phone_verified: false,
            },
          },
          data_recovery: {
            file: {
              enabled: false,
              last_used: null,
              created_at: Math.floor(Date.now() / 1000),
              modified_at: Math.floor(Date.now() / 1000),
              recovery_key: null,
              recovery_key_signature: null,
            },
            phrase: {
              enabled: false,
              last_used: null,
              created_at: Math.floor(Date.now() / 1000),
              modified_at: Math.floor(Date.now() / 1000),
            },
          },
          created_at: Math.floor(Date.now() / 1000),
          last_updated: Math.floor(Date.now() / 1000),
        };
        setRecoveryMethod(defaultMethod);
      } else {
        setRecoveryMethod(response.recovery_methods as RecoveryMethod);
      }
    } catch (error) {
      const fallbackMethod: RecoveryMethod = {
        account_recovery: {
          email: {
            email: null,
            enabled: false,
            last_used: null,
            created_at: Math.floor(Date.now() / 1000),
            modified_at: Math.floor(Date.now() / 1000),
            email_verified: false,
          },
          phone: {
            phone: null,
            enabled: false,
            last_used: null,
            created_at: Math.floor(Date.now() / 1000),
            modified_at: Math.floor(Date.now() / 1000),
            phone_verified: false,
          },
        },
        data_recovery: {
          file: {
            enabled: false,
            last_used: null,
            created_at: Math.floor(Date.now() / 1000),
            modified_at: Math.floor(Date.now() / 1000),
            recovery_key: null,
            recovery_key_signature: null,
          },
          phrase: {
            enabled: false,
            last_used: null,
            created_at: Math.floor(Date.now() / 1000),
            modified_at: Math.floor(Date.now() / 1000),
          },
        },
        created_at: Math.floor(Date.now() / 1000),
        last_updated: Math.floor(Date.now() / 1000),
      };
      setRecoveryMethod(fallbackMethod);

      setToastMessage({
        type: "error",
        text: "Error fetching recovery methods. Please try again.",
      });
      setShowToast(true);
    }
  }, []);

  const fetchUserPreferences = useCallback(async () => {
    try {
      const response = await ApiService.preferences();
      setPreferences(response.preferences);
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Error fetching user settings. Please try again.",
      });
      setShowToast(true);
    }
  }, []);

  const fetchAvailablePlans = useCallback(async () => {
    try {
      const response = await ApiService.getAvailablePlans();

      if (response.code === 1000 && response.plans) {
        setAvailablePlans(response.plans);
      }
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Unable to load plans. Please try again.",
      });
      setShowToast(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        fetchEvents(1),
        fetchSessions(1),
        fetchSubscription(),
        fetchSecuritySettings(),
        fetchRecoveryMethod(),
        fetchUserPreferences(),
        fetchAvailablePlans(),
      ]);
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Error loading settings. Please try again.",
      });
      setShowToast(true);
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchEvents,
    fetchSessions,
    fetchSubscription,
    fetchSecuritySettings,
    fetchRecoveryMethod,
    fetchUserPreferences,
    fetchAvailablePlans,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle section change with scrollTop
  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId as Sections);
    setSearchParams({ section: sectionId });

    // Ensure immediate scroll to top
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  };

  return (
    <>
      <div className="flex flex-col h-screen" ref={containerRef}>
        <header className="sticky top-0 z-10 bg-white/95 dark:bg-[#040405] border-b border-slate-400/20 dark:border-[#343140] backdrop-blur-sm h-12">
          <div className="px-2 sm:px-4 h-full flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-md font-bold text-gray-900 dark:text-white">
                Settings
              </h1>
            </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col lg:flex-row lg:px-6 lg:pt-6 lg:pb-6 lg:gap-6 overflow-hidden max-w-full">
          {/* Sidebar navigation */}
          <div className="w-full lg:w-64 flex-none">
            <nav className="bg-white/95 dark:bg-[#040405] lg:rounded-xl border-b lg:border border-slate-400/20 dark:border-[#343140] lg:shadow-sm">
              <div className="p-2">
                <div className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={(e) => {
                        e.preventDefault();
                        handleSectionChange(section.id);
                      }}
                      className={`p-3 mx-auto lg:mx-0 flex items-center space-x-3 rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap
                        ${
                          activeSection === section.id
                            ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium"
                            : "hover:bg-slate-100 dark:hover:bg-[#343140]/70 text-slate-700 dark:text-slate-300"
                        }`}
                      aria-current={
                        activeSection === section.id ? "page" : undefined
                      }
                    >
                      <section.icon className="w-5 h-5 flex-shrink-0" />
                      <span>{section.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </nav>
          </div>

          {/* Main content area */}
          {isLoading ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <SettingsSkeletonLoader
                activeSection={activeSection}
                mainContentRef={mainContentRef}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div
                ref={mainContentRef}
                className="bg-white/95 dark:bg-[#040405] lg:rounded-xl shadow-sm lg:border border-slate-400/20 dark:border-[#343140] p-4 sm:p-6 overflow-y-auto overscroll-none flex-1 lg:mb-4"
              >
                {activeSection === "dashboard" && (
                  <DashboardSection
                    user={user}
                    subscription={subscription}
                    setSubscription={setSubscription}
                    availablePlans={availablePlans}
                    preferences={preferences}
                    setPreferences={setPreferences}
                    setToastMessage={setToastMessage}
                    setShowToast={setShowToast}
                    formatBytes={formatBytes}
                  />
                )}

                {activeSection === "security" && (
                  <SecuritySection
                    user={user}
                    setUser={setUser}
                    subscription={subscription}
                    securitySettings={securitySettings}
                    setSecuritySettings={setSecuritySettings}
                    mfaSettings={mfaSettings}
                    setMfaSettings={setMfaSettings}
                    setToastMessage={setToastMessage}
                    setShowToast={setShowToast}
                    isSaving={isSaving}
                    setIsSaving={setIsSaving}
                    itemsPerPage={itemsPerPage}
                    formatTimestamp={formatTimestamp}
                    activeSessions={activeSessions}
                    sessionPage={sessionPage}
                    totalSessions={totalSessions}
                    sessionsLoading={sessionsLoading}
                    fetchSessions={fetchSessions}
                    handleRevokeSession={handleRevokeSession}
                    handleRevokeAllSessions={handleRevokeAllSessions}
                    securityEvents={securityEvents}
                    eventPage={eventPage}
                    totalEvents={totalEvents}
                    eventsLoading={eventsLoading}
                    fetchEvents={fetchEvents}
                    handleClearEvents={handleClearEvents}
                    getEventIcon={getEventIcon}
                    totpModalOpen={totpModalOpen}
                    setTotpModalOpen={setTotpModalOpen}
                  />
                )}

                {activeSection === "recovery" && (
                  <RecoverySection
                    recoveryMethod={recoveryMethod}
                    setRecoveryMethod={setRecoveryMethod}
                  />
                )}

                {activeSection === "account" && (
                  <AccountSection
                    user={user}
                    setUser={setUser}
                    setToastMessage={setToastMessage}
                    setShowToast={setShowToast}
                    isSaving={isSaving}
                    setIsSaving={setIsSaving}
                  />
                )}

                {activeSection === "billing" && (
                  <BillingSection
                    subscription={subscription}
                    setSubscription={setSubscription}
                    availablePlans={availablePlans}
                    setShowToast={setShowToast}
                    setToastMessage={setToastMessage}
                  />
                )}

                {activeSection === "appearance" && (
                  <AppearanceSection
                    setToastMessage={setToastMessage}
                    setShowToast={setShowToast}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {totpModalOpen && (
        <TOTPSetupModal
          isOpen={totpModalOpen}
          onClose={() => setTotpModalOpen(false)}
          onComplete={() => {
            setToastMessage({
              type: "success",
              text: "TOTP is now enabled. Please save your recovery codes.",
            });
            setShowToast(true);
            fetchSecuritySettings();
          }}
        />
      )}

      {showToast && (
        <Toast
          toastMessage={toastMessage}
          setToastMessage={setToastMessage}
          setShowToast={setShowToast}
        />
      )}
    </>
  );
};

export default SettingsPage;
