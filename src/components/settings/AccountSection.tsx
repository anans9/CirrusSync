import React, { useState, useEffect } from "react";
import { useUserUpdate } from "../../hooks/useUserUpdate";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Key,
  Mail,
  Phone,
  User as UserIcon,
  Download,
  Trash2,
  Shield,
  BarChart3,
  AlertTriangle,
  HelpCircle,
  LockIcon,
  UserCircle,
} from "lucide-react";
import DeleteAccountModal from "./DeleteAccountModal";
import PasswordChangeModal from "./PasswordChangeModal";

interface AccountSectionProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
  isSaving: boolean;
  setIsSaving: (saving: boolean) => void;
}

export const AccountSection: React.FC<AccountSectionProps> = ({
  user,
  setUser,
  setToastMessage,
  setShowToast,
  isSaving,
  setIsSaving,
}) => {
  // Initialize form with user data or empty strings
  const [accountForm, setAccountForm] = useState({
    display_name: user?.display_name || "",
    company_name: user?.company_name || "",
  });

  // Update form whenever user data changes
  useEffect(() => {
    if (user) {
      setAccountForm({
        display_name: user.display_name || "",
        company_name: user.company_name || "",
      });
    }
  }, [user]);

  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] =
    useState(false);
  const [isPasswordChangeModalOpen, setIsPasswordChangeModalOpen] =
    useState(false);

  // Privacy and data collection toggles
  const [privacySettings, setPrivacySettings] = useState({
    collectDiagnostics: user?.settings?.collectDiagnostics ?? true,
    sendCrashReports: user?.settings?.sendCrashReports ?? true,
  });

  const { handleUserUpdate, debouncedUpdate } = useUserUpdate({
    user,
    setUser,
    setToastMessage,
    setShowToast,
    setIsSaving,
  });

  // Handle controlled input changes without immediate saving
  const handleInputChange = (field: string, value: string) => {
    setAccountForm({
      ...accountForm,
      [field]: value,
    });
  };

  // Handle form submission on blur
  const handleBlur = (field: string) => {
    // Only update if value has changed from user data
    if (
      field === "display_name" &&
      accountForm.display_name !== user?.display_name
    ) {
      debouncedUpdate("display_name", accountForm.display_name);
    } else if (
      field === "company_name" &&
      accountForm.company_name !== user?.company_name
    ) {
      debouncedUpdate("company_name", accountForm.company_name);
    }
  };

  // Handle password update through modal
  const handlePasswordUpdate = async (
    currentPassword: string,
    newPassword: string,
  ) => {
    setIsSaving(true);

    try {
      // Use your actual password update API call here
      const result = await handleUserUpdate(
        "password",
        JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      );

      if (result.success) {
        setToastMessage({
          type: "success",
          text: "Password updated successfully",
        });
        setShowToast(true);
        setIsPasswordChangeModalOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle privacy setting toggle
  const handleTogglePrivacySetting = async (
    setting: keyof typeof privacySettings,
  ) => {
    // Update UI state immediately for responsive feel
    setPrivacySettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));

    setIsSaving(true);

    try {
      // Update the user setting on the server
      const result = await handleUserUpdate(
        "settings",
        JSON.stringify({
          [setting]: !privacySettings[setting],
        }),
      );

      if (!result.success) {
        // Revert toggle if the update failed
        setPrivacySettings((prev) => ({
          ...prev,
          [setting]: !prev[setting],
        }));

        setToastMessage({
          type: "error",
          text: `Failed to update ${setting} setting`,
        });
        setShowToast(true);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle data download request
  const handleDownloadData = async () => {
    setIsSaving(true);

    try {
      // Sample implementation - replace with actual API call
      const response = await fetch("/api/v1/users/data-export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = "my-account-data.zip";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);

        setToastMessage({
          type: "success",
          text: "Your data has been downloaded",
        });
        setShowToast(true);
      } else {
        throw new Error("Failed to download data");
      }
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Failed to download your data. Please try again later.",
      });
      setShowToast(true);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle account deletion
  const handleDeleteAccount = async () => {
    setIsSaving(true);

    try {
      // Sample implementation - replace with actual API call
      const response = await fetch("/api/v1/users/account", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.ok) {
        // Redirect to logout or home page after account deletion
        window.location.href = "/logout";
      } else {
        throw new Error("Failed to delete account");
      }
    } catch (error) {
      setToastMessage({
        type: "error",
        text: "Failed to delete your account. Please try again later.",
      });
      setShowToast(true);
    } finally {
      setIsSaving(false);
      setIsDeleteAccountModalOpen(false);
    }
  };

  // Toggle switch component for privacy settings
  const ToggleSwitch = ({
    id,
    checked,
    onChange,
    disabled = false,
  }: {
    id: string;
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
  }) => {
    return (
      <label
        htmlFor={id}
        className={`relative inline-block h-6 w-11 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="peer sr-only"
        />
        <div className="h-6 w-11 rounded-full bg-gray-200 dark:bg-[#343140] peer-focus:ring-2 peer-focus:ring-emerald-500 dark:peer-focus:ring-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 peer-checked:after:translate-x-5"></div>
      </label>
    );
  };

  return (
    <div className="flex flex-col h-full pb-6 lg:pb-2">
      {/* Static Header */}
      <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Account Settings
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your profile information, security settings, and data
              preferences
            </p>
          </div>
          {isSaving && (
            <div className="text-sm text-emerald-600 dark:text-emerald-400 animate-pulse flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400"
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
              Saving...
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-grow pr-[2px]">
        <div className="space-y-8 pb-6 pr-2">
          {/* Profile Information Section */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Profile Information
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Update your personal details and contact information
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Display Name Field (Editable) */}
              <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200">
                <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                  <UserCircle className="w-full h-full text-emerald-500" />
                </div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">
                  Name
                </label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={accountForm.display_name}
                    onChange={(e) =>
                      handleInputChange("display_name", e.target.value)
                    }
                    onBlur={() => handleBlur("display_name")}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2c2934]/70 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all duration-200"
                    placeholder="Enter your display name"
                    aria-label="Display name"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    This is how your name will appear to other users
                  </p>
                </div>
              </div>

              {/* Username Field (Read-Only) */}
              <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 opacity-70 transition-all duration-200">
                <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                  <UserIcon className="w-full h-full text-emerald-500" />
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Username
                  </label>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-[#343140] text-gray-700 dark:text-gray-300">
                    <LockIcon className="h-3 w-3" />
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="w-full px-3 py-2 bg-gray-100 dark:bg-[#343140]/70 border-0 rounded-lg text-gray-700 dark:text-gray-300 cursor-not-allowed truncate">
                    {user?.username || "Not set"}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Your unique username that identifies your account
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email Field (Read-Only) */}
              <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 opacity-70 transition-all duration-200">
                <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                  <Mail className="w-full h-full text-emerald-500" />
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="block text-sm font-medium text-gray-900 dark:text-white">
                    Email Address
                  </label>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-[#343140] text-gray-700 dark:text-gray-300">
                    <LockIcon className="h-3 w-3" />
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="w-full px-3 py-2 bg-gray-100 dark:bg-[#343140]/70 border-0 rounded-lg text-gray-700 dark:text-gray-300 cursor-not-allowed truncate">
                    {user?.email || "Not set"}
                  </div>

                  {user?.email_verified ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>Email address has been verified</span>
                    </p>
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span>Email needs verification</span>
                      </p>
                      <button className="text-xs px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                        Verify
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Field (Editable) */}
              <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200">
                <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                  <Building2 className="w-full h-full text-emerald-500" />
                </div>
                <label className="block text-sm font-medium text-gray-900 dark:text-white mb-1.5">
                  Company
                </label>
                <input
                  type="text"
                  value={accountForm.company_name}
                  onChange={(e) =>
                    handleInputChange("company_name", e.target.value)
                  }
                  onBlur={() => handleBlur("company_name")}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-[#2c2934]/70 border-0 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all duration-200"
                  placeholder="Enter your company name"
                  aria-label="Company name"
                />
              </div>
            </div>

            {/* Phone Number Field (Read-Only) */}
            <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 opacity-70 transition-all duration-200">
              <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                <Phone className="w-full h-full text-emerald-500" />
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <label className="block text-sm font-medium text-gray-900 dark:text-white">
                  Phone Number
                </label>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-100 dark:bg-[#343140] text-gray-700 dark:text-gray-300">
                  <LockIcon className="h-3 w-3 mr-1" />
                  Coming Soon
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2 px-3 py-2 text-sm font-sans bg-gray-100 dark:bg-[#343140]/70 border-0 rounded-lg text-gray-700 dark:text-gray-300 cursor-not-allowed truncate">
                  {user?.phone || "Coming Soon"}
                </div>
                {!user?.phone && (
                  <button
                    disabled
                    className="flex-shrink-0 h-9 px-3 text-xs font-medium text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors whitespace-nowrap cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    Add Phone
                  </button>
                )}
              </div>
              {user?.phone && !user?.phone_verified && (
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>Phone needs verification</span>
                  </p>
                  <button className="text-xs px-2 py-1 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30">
                    Verify
                  </button>
                </div>
              )}
              {user?.phone && user?.phone_verified && (
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>Phone number has been verified</span>
                </p>
              )}
              {!user?.phone && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Add a phone number for additional account security
                </p>
              )}
            </div>
          </section>

          {/* Password & Security Section */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Password & Security
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage your password and account security settings
              </p>
            </div>

            <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200">
              <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                <Key className="w-full h-full text-emerald-500" />
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                    Password
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Change your password regularly to keep your account secure
                  </p>
                </div>
                <button
                  onClick={() => setIsPasswordChangeModalOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Key className="h-4 w-4" />
                  Change Password
                </button>
              </div>
            </div>
          </section>

          {/* Privacy & Data Section */}
          <section className="space-y-5">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Privacy & Data Collection
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Control how your data is collected and used to improve our
                services
              </p>
            </div>

            <div className="space-y-4">
              {/* Data Collection Settings */}
              <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200">
                <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                  <Shield className="w-full h-full text-emerald-500" />
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Data Collection Preferences
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      To continuously improve our services, we sometimes collect
                      data to monitor the proper functioning of our
                      applications. This information is not shared with any
                      3rd-party services.
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-[#343140]/40">
                      <div className="space-y-0.5">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                          <BarChart3 className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          Collect usage diagnostics
                        </h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Allow us to collect anonymous usage data to improve
                          the application
                        </p>
                      </div>
                      <ToggleSwitch
                        id="collect-diagnostics"
                        checked={privacySettings.collectDiagnostics}
                        onChange={() =>
                          handleTogglePrivacySetting("collectDiagnostics")
                        }
                        disabled={isSaving}
                      />
                    </div>

                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5">
                        <h5 className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                          Send crash reports
                        </h5>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Automatically send error reports to help us fix issues
                          faster
                        </p>
                      </div>
                      <ToggleSwitch
                        id="send-crash-reports"
                        checked={privacySettings.sendCrashReports}
                        onChange={() =>
                          handleTogglePrivacySetting("sendCrashReports")
                        }
                        disabled={isSaving}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Data Management */}
              <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200">
                <div className="absolute top-0 right-0 w-28 h-28 opacity-[0.03] pointer-events-none">
                  <HelpCircle className="w-full h-full text-emerald-500" />
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Your Data
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Manage your personal data and account
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleDownloadData}
                      disabled={isSaving}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#2c2934] hover:bg-gray-200 dark:hover:bg-[#343140] rounded-lg transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <Download className="h-4 w-4" />
                      Download your data
                    </button>

                    <button
                      onClick={() => setIsDeleteAccountModalOpen(true)}
                      disabled={isSaving}
                      className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete account
                    </button>
                  </div>

                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <p>
                      Deleting your account is permanent. All your data will be
                      permanently removed and cannot be recovered.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {isDeleteAccountModalOpen && (
        <DeleteAccountModal
          isOpen={isDeleteAccountModalOpen}
          onClose={() => setIsDeleteAccountModalOpen(false)}
          onConfirm={handleDeleteAccount}
          isProcessing={isSaving}
        />
      )}

      {/* Password Change Modal */}
      <PasswordChangeModal
        isOpen={isPasswordChangeModalOpen}
        onClose={() => setIsPasswordChangeModalOpen(false)}
        onConfirm={handlePasswordUpdate}
        isProcessing={isSaving}
      />
    </div>
  );
};
