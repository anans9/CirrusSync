import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  FileKey,
  Key,
  Lock,
  Mail,
  Phone,
  Save,
  Search,
  Shield,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiService } from "../../services/ApiService";
import { Switch } from "../Switch";
import { createPortal } from "react-dom";
import { VerifyEmailModal } from "../VerifyEmailModal";
import { DisableRecoveryModal } from "./DisableRecoveryModal";
import { RecoveryPhraseModal } from "../RecoveryPhraseModel";

// Calculate security score based on enabled recovery methods
const calculateSecurityScore = (recoveryMethod?: RecoveryMethod | null) => {
  if (!recoveryMethod) return { score: 0, label: "Weak", color: "red" };

  let score = 0;

  // Account recovery methods
  if (
    recoveryMethod.account_recovery.email.enabled &&
    recoveryMethod.account_recovery.email.email_verified
  ) {
    score += 20;
  }

  if (
    recoveryMethod.account_recovery.phone.enabled &&
    recoveryMethod.account_recovery.phone.phone_verified
  ) {
    score += 20;
  }

  // Data recovery methods
  if (recoveryMethod.data_recovery.phrase.enabled) {
    score += 30;
  }

  if (recoveryMethod.data_recovery.file.enabled) {
    score += 30;
  }

  if (score >= 100) return { score, label: "Very Strong", color: "emerald" };
  if (score >= 75) return { score, label: "Strong", color: "blue" };
  if (score >= 50) return { score, label: "Good", color: "yellow" };
  return { score, label: "Weak", color: "red" };
};

const countries = [
  { code: "US", name: "United States", flag: "🇺🇸", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", dialCode: "+44" },
  { code: "IN", name: "India", flag: "🇮🇳", dialCode: "+91" },
  { code: "CA", name: "Canada", flag: "🇨🇦", dialCode: "+1" },
  { code: "AU", name: "Australia", flag: "🇦🇺", dialCode: "+61" },
  { code: "DE", name: "Germany", flag: "🇩🇪", dialCode: "+49" },
  { code: "FR", name: "France", flag: "🇫🇷", dialCode: "+33" },
  { code: "IT", name: "Italy", flag: "🇮🇹", dialCode: "+39" },
  { code: "ES", name: "Spain", flag: "🇪🇸", dialCode: "+34" },
  { code: "BR", name: "Brazil", flag: "🇧🇷", dialCode: "+55" },
];

interface RecoverySecurityScore {
  score: number;
  label: string;
  color: string;
}

interface RecoveryInputProps {
  type: "email" | "phone";
  icon: React.ElementType;
  title: string;
  subtitle: string;
  value: string;
  verified: boolean;
  enabled: boolean;
  disabled?: boolean;
  onToggle: (enabled: boolean) => void;
  onChange: (value: string, verified: boolean) => void;
  setRecoveryMethod?: React.Dispatch<
    React.SetStateAction<RecoveryMethod | null>
  >;
}

interface Country {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
}

interface CountrySelectProps {
  selectedCountry: Country;
  onSelect: (country: Country) => void;
  disabled?: boolean;
}

interface DropdownPosition {
  top: number;
  left: number;
  height: string;
}

const CountrySelect = ({
  selectedCountry,
  onSelect,
  disabled = false,
}: CountrySelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] =
    useState<DropdownPosition | null>(null);

  const updatePosition = useCallback(() => {
    if (buttonRef.current && dropdownRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      const dropdownHeight = dropdownRef.current.getBoundingClientRect().height;
      const searchHeight = 60;
      const filteredCountries = countries.filter(
        (country) =>
          country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          country.dialCode.includes(searchQuery),
      );
      const minHeight = searchHeight + (filteredCountries.length ? 50 : 0);
      const windowHeight = window.innerHeight;
      const bottomSpace = windowHeight - rect.bottom;
      const minBottomPadding = 20;
      const actualHeight = Math.max(minHeight, Math.min(dropdownHeight, 300));
      const topPosition =
        bottomSpace < actualHeight + minBottomPadding
          ? rect.top + scrollY - actualHeight - 8
          : rect.bottom + scrollY + 8;

      setDropdownPosition({
        top: topPosition,
        left: rect.left + scrollX,
        height: String(actualHeight),
      });
    }
  }, [searchQuery]);

  const handleToggleDropdown = () => {
    if (disabled) return;

    if (!isOpen) {
      const rect = buttonRef?.current?.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;

      setDropdownPosition({
        top: (rect?.bottom ?? 0) + scrollY + 8,
        left: (rect?.left ?? 0) + scrollX,
        height: "auto",
      });

      setIsOpen(true);

      setTimeout(updatePosition, 10);
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCountries = countries.filter(
    (country) =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      country.dialCode.includes(searchQuery),
  );

  const dropdown =
    isOpen &&
    dropdownPosition &&
    createPortal(
      <div
        ref={dropdownRef}
        style={{
          position: "absolute",
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          height: `${dropdownPosition.height}px`,
          zIndex: 9999,
          opacity: 1,
          transition: "opacity 150ms ease-in-out",
        }}
        className="w-64 bg-white dark:bg-[#1c1b23] rounded-lg shadow-lg border border-gray-200 dark:border-gray-800 max-h-[300px] overflow-hidden mb-5"
      >
        <div className="p-2 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              autoFocus
              className="w-full pl-9 pr-3 py-2 bg-gray-50 dark:bg-[#2c2934]/70 border-0 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-200"
              placeholder="Search countries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
        <div className="overflow-y-auto max-h-[250px]">
          {filteredCountries.map((country) => (
            <button
              key={country.code}
              className="flex items-center gap-3 w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-[#2c2934] transition-colors"
              onClick={() => {
                onSelect(country);
                setIsOpen(false);
                setSearchQuery("");
              }}
            >
              <span className="text-xl flex-shrink-0">{country.flag}</span>
              <span className="text-sm text-gray-900 dark:text-white flex-1 truncate">
                {country.name}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                {country.dialCode}
              </span>
            </button>
          ))}
        </div>
      </div>,
      document.body,
    );

  return (
    <div className="flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 ${disabled ? "bg-gray-100 dark:bg-[#2c2934]/50 cursor-not-allowed" : "bg-transparent hover:bg-gray-100 dark:hover:bg-[#343140] cursor-pointer"} transition-colors rounded-lg`}
        onClick={handleToggleDropdown}
      >
        <span className="text-xl">{selectedCountry.flag}</span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {selectedCountry.dialCode}
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {dropdown}
    </div>
  );
};

const RecoveryInput = ({
  type,
  icon: Icon,
  title,
  subtitle,
  value,
  verified,
  enabled,
  disabled = false,
  onToggle,
  onChange,
  setRecoveryMethod,
}: RecoveryInputProps) => {
  const [selectedCountry, setSelectedCountry] = useState(countries[0]);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [currentValue, setCurrentValue] = useState(value || "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localEnabled, setLocalEnabled] = useState(enabled);

  // Store original value to revert if user toggles off without saving
  const [originalValue, setOriginalValue] = useState(value || "");

  useEffect(() => {
    setCurrentValue(value || "");
    setOriginalValue(value || "");
    setIsDirty(false);
    setLocalEnabled(enabled);
  }, [value, enabled]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;

    const newValue =
      type === "phone" ? e.target.value.replace(/\D/g, "") : e.target.value;
    setCurrentValue(newValue);
    setIsDirty(true);
  };

  const handleToggle = () => {
    if (disabled) return;

    if (localEnabled) {
      // If enabled and has a value, show disable modal
      if (originalValue && originalValue.length > 0) {
        setShowDisableModal(true);
      } else {
        // If no value set yet or just unsaved changes, just disable directly
        // If turning off and there are unsaved changes, revert to original
        if (isDirty) {
          setCurrentValue(originalValue);
          setIsDirty(false);
        }

        // Disable locally first
        setLocalEnabled(false);

        // Then notify parent
        onToggle(false);
      }
    } else {
      // Enable locally
      setLocalEnabled(true);

      // Notify parent - but don't actually send the API call yet
      // This will be handled when user saves
      onToggle(true);
    }
  };

  const handleSave = async () => {
    if (disabled || !isValidInput) return;

    setIsSaving(true);
    try {
      // Create payload using the updated API structure
      const updateData: RecoveryMethodUpdate =
        type === "email"
          ? {
              account_recovery: {
                email: {
                  enabled: true,
                  email: currentValue,
                  email_verified: false,
                },
              },
            }
          : {
              account_recovery: {
                phone: {
                  enabled: true,
                  phone: currentValue,
                  phone_verified: false,
                },
              },
            };

      // Call API to update recovery method
      await ApiService.updateRecoveryMethods(updateData);

      // Update parent state with new value (and unverified state)
      onChange(currentValue, false);

      // Update original value
      setOriginalValue(currentValue);

      // Show verification modal
      setShowVerifyModal(true);
      setIsDirty(false);
    } catch (error) {
      console.error(`Error saving ${type}:`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerificationComplete = async (code: string) => {
    if (code) {
      // Only if verification succeeded, update the parent state
      // to set verified flag to true
      onChange(currentValue, true);

      // Close modal
      setShowVerifyModal(false);
    }
  };

  const handleCancel = () => {
    if (disabled) return;

    setCurrentValue(originalValue);
    setIsDirty(false);

    // If this was a new entry and user cancels, toggle off
    if (originalValue === "" && !verified) {
      setLocalEnabled(false);
      onToggle(false);
    }
  };

  const isValidInput =
    type === "email"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentValue)
      : /^\d{10}$/.test(currentValue);

  const hasChanges = currentValue !== originalValue;
  const showSaveButtons = localEnabled && hasChanges;

  return (
    <div
      className={`relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 ${disabled ? "opacity-70" : ""}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-emerald-500" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {title}
            </h4>
            {verified && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
            {disabled && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 rounded-full">
                <Lock className="w-3.5 h-3.5" />
                Coming Soon
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {subtitle}
          </p>

          {localEnabled && (
            <div className="space-y-3">
              <div className="relative">
                {type === "phone" ? (
                  <div className="relative">
                    <div
                      className={`flex bg-gray-50 dark:bg-[#2c2934]/70 rounded-lg ${
                        currentValue && !disabled
                          ? currentValue !== originalValue
                            ? isValidInput
                              ? "ring-2 ring-emerald-500"
                              : "ring-2 ring-red-500"
                            : ""
                          : "focus-within:ring-2 focus-within:ring-emerald-500"
                      }`}
                    >
                      <CountrySelect
                        selectedCountry={selectedCountry}
                        onSelect={setSelectedCountry}
                        disabled={disabled}
                      />
                      <div className="w-px h-full bg-gray-200 dark:bg-gray-700/50" />
                      <input
                        type="tel"
                        value={currentValue}
                        onChange={handleChange}
                        disabled={disabled || isSaving}
                        className={`flex-1 min-w-0 px-3 py-2 bg-transparent border-0 text-gray-900 dark:text-white focus:outline-none focus:ring-0 ${disabled ? "cursor-not-allowed" : ""}`}
                        placeholder={
                          disabled ? "Coming soon" : "Enter phone number"
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <input
                    type={type}
                    value={currentValue}
                    onChange={handleChange}
                    disabled={disabled || isSaving}
                    className={`w-full px-3 py-2 bg-gray-50 dark:bg-[#2c2934]/70 border-0 rounded-lg text-gray-900 dark:text-white transition-all outline-none ${
                      currentValue && !disabled
                        ? currentValue !== originalValue
                          ? isValidInput
                            ? "ring-2 ring-emerald-500"
                            : "ring-2 ring-red-500"
                          : ""
                        : "focus:ring-2 focus:ring-emerald-500"
                    } ${disabled ? "cursor-not-allowed" : ""}`}
                    placeholder={`Enter ${type}`}
                  />
                )}
              </div>

              {showSaveButtons && !disabled && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={
                        !hasChanges || !isValidInput || isSaving || disabled
                      }
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        hasChanges && isValidInput && !isSaving && !disabled
                          ? "bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer"
                          : "bg-gray-100 dark:bg-[#4a4658] text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <Save className="h-4 w-4" />
                      {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving || disabled}
                      className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {hasChanges && isValidInput && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      <span>
                        You'll need to verify this {type} after saving
                      </span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="absolute top-4 right-4 sm:static sm:ml-2">
          <Switch
            enabled={localEnabled}
            onChange={handleToggle}
            disabled={disabled}
          />
        </div>
      </div>

      {showVerifyModal && (
        <VerifyEmailModal
          isOpen={showVerifyModal}
          onClose={() => setShowVerifyModal(false)}
          type={type}
          value={currentValue}
          onSubmit={(code) => handleVerificationComplete(code)}
          setRecoveryMethod={setRecoveryMethod}
        />
      )}

      {showDisableModal && (
        <DisableRecoveryModal
          isOpen={showDisableModal}
          onClose={() => setShowDisableModal(false)}
          type={type}
          onConfirm={() => {
            // Disable locally first
            setLocalEnabled(false);
            setShowDisableModal(false);

            // Then notify parent
            onToggle(false);
          }}
          setRecoveryMethod={setRecoveryMethod}
        />
      )}
    </div>
  );
};

interface RecoveryCardProps {
  type: "phrase" | "file";
  icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
  generated: boolean;
  onGenerate: () => void;
  setRecoveryMethod: React.Dispatch<
    React.SetStateAction<RecoveryMethod | null>
  >;
}

const RecoveryCard = ({
  type,
  icon: Icon,
  title,
  description,
  enabled,
  generated,
  onGenerate,
  setRecoveryMethod,
}: RecoveryCardProps) => {
  const [showDisableModal, setShowDisableModal] = useState(false);

  const handleToggle = () => {
    if (enabled && generated) {
      setShowDisableModal(true);
    } else if (!enabled) {
      onGenerate();
    }
  };

  return (
    <div className="relative overflow-hidden p-4 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="h-10 w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon className="h-5 w-5 text-emerald-500" />
        </div>

        <div className="flex-1 min-w-0 pr-10 sm:pr-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              {title}
            </h4>
            {generated && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Generated
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {description}
          </p>
          {!enabled && !generated && (
            <button
              onClick={onGenerate}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-500 dark:hover:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg transition-colors cursor-pointer"
            >
              <Icon className="w-3.5 h-3.5" />
              Generate{" "}
              {type === "phrase" ? "New Recovery Phrase" : "New Recovery File"}
            </button>
          )}
        </div>

        <div className="absolute top-4 right-4 sm:static sm:ml-2">
          <Switch enabled={enabled} onChange={handleToggle} />
        </div>
      </div>

      <DisableRecoveryModal
        isOpen={showDisableModal}
        onClose={() => setShowDisableModal(false)}
        type={type}
        onConfirm={() => setShowDisableModal(false)}
        setRecoveryMethod={setRecoveryMethod}
      />
    </div>
  );
};

interface RecoverySectionProps {
  recoveryMethod: RecoveryMethod | null;
  setRecoveryMethod: React.Dispatch<
    React.SetStateAction<RecoveryMethod | null>
  >;
}

const RecoverySection = ({
  recoveryMethod,
  setRecoveryMethod,
}: RecoverySectionProps) => {
  const [securityScore, setSecurityScore] = useState<RecoverySecurityScore>(
    recoveryMethod
      ? calculateSecurityScore(recoveryMethod)
      : { score: 0, label: "Weak", color: "red" },
  );
  const [showRecoveryPhraseModal, setShowRecoveryPhraseModal] =
    useState<boolean>(false);

  const handleMethodToggle = async (
    methodType: "email" | "phone",
    enabled: boolean,
  ) => {
    if (!recoveryMethod) return;

    // Create updated method for state update
    const updatedMethod = { ...recoveryMethod };

    if (!enabled) {
      // When disabling a method, create payload for API call
      const updateData: RecoveryMethodUpdate = {
        account_recovery: {
          [methodType]: {
            enabled: false,
            [methodType]: null,
            [`${methodType}_verified`]: false,
          },
        },
      };

      try {
        await ApiService.updateRecoveryMethods(updateData);

        // Update state after successful API call
        if (methodType === "email") {
          updatedMethod.account_recovery.email.enabled = false;
          updatedMethod.account_recovery.email.email = null;
          updatedMethod.account_recovery.email.email_verified = false;
          updatedMethod.account_recovery.email.modified_at = Math.floor(
            Date.now() / 1000,
          );
        } else {
          updatedMethod.account_recovery.phone.enabled = false;
          updatedMethod.account_recovery.phone.phone = null;
          updatedMethod.account_recovery.phone.phone_verified = false;
          updatedMethod.account_recovery.phone.modified_at = Math.floor(
            Date.now() / 1000,
          );
        }
      } catch (error) {
        console.error(`Error toggling ${methodType}:`, error);
        // If the API call fails,
        // If the API call fails, return without updating state
        return;
      }
    } else {
      // When enabling, set up the initial state but don't make API call yet
      if (methodType === "email") {
        updatedMethod.account_recovery.email.enabled = true;
        updatedMethod.account_recovery.email.email = "";
        updatedMethod.account_recovery.email.email_verified = false;
      } else {
        updatedMethod.account_recovery.phone.enabled = true;
        updatedMethod.account_recovery.phone.phone = "";
        updatedMethod.account_recovery.phone.phone_verified = false;
      }
    }

    // Update UI
    updatedMethod.last_updated = Math.floor(Date.now() / 1000);
    setRecoveryMethod(updatedMethod);
    setSecurityScore(calculateSecurityScore(updatedMethod));
  };

  const handleRecoveryInputChange = (
    methodType: "email" | "phone",
    value: string,
    verified: boolean,
  ) => {
    if (!recoveryMethod) return;

    // Update local state
    const updatedMethod = { ...recoveryMethod };
    const currentTime = Math.floor(Date.now() / 1000);

    if (methodType === "email") {
      updatedMethod.account_recovery.email.email = value || null;
      updatedMethod.account_recovery.email.email_verified = verified;
      updatedMethod.account_recovery.email.modified_at = currentTime;
    } else {
      updatedMethod.account_recovery.phone.phone = value || null;
      updatedMethod.account_recovery.phone.phone_verified = verified;
      updatedMethod.account_recovery.phone.modified_at = currentTime;
    }

    updatedMethod.last_updated = currentTime;
    setRecoveryMethod(updatedMethod);
    setSecurityScore(calculateSecurityScore(updatedMethod));
  };

  const handleGenerateRecoveryItem = async (type: "phrase" | "file") => {
    if (type === "phrase") {
      setShowRecoveryPhraseModal(true);
    } else {
      try {
        // Update recovery file in API using partial update
        await ApiService.updateRecoveryMethods({
          data_recovery: {
            file: {
              recovery_key: "",
              recovery_key_signature: "",
              enabled: true,
              // Other fields will be handled by backend
            },
          },
        });

        // Update local state
        if (recoveryMethod) {
          const updatedMethod = { ...recoveryMethod };
          updatedMethod.data_recovery.file.enabled = true;
          updatedMethod.data_recovery.file.modified_at = Math.floor(
            Date.now() / 1000,
          );
          updatedMethod.last_updated = Math.floor(Date.now() / 1000);
          setRecoveryMethod(updatedMethod);
          setSecurityScore(calculateSecurityScore(updatedMethod));
        }
      } catch (error) {
        console.error("Error generating recovery file:", error);
      }
    }
  };

  // Show loading state if no recovery method yet
  if (!recoveryMethod) {
    return (
      <div className="p-8 flex flex-col items-center justify-center">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-gray-200 dark:bg-gray-700 h-12 w-12"></div>
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Loading account recovery options...
        </p>
      </div>
    );
  }

  // Get the security color class
  const getColorClass = (color: string) => {
    // This ensures that the color classes are not stripped by Tailwind
    const colorMap: Record<string, string> = {
      red: "text-red-500 bg-red-100 dark:bg-red-900/30",
      yellow: "text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30",
      blue: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
      emerald: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30",
    };

    return colorMap[color] || colorMap.red;
  };

  return (
    <div className="flex flex-col h-full pb-6 lg:pb-2">
      {/* Static Header */}
      <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Recovery Settings
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Set up methods to recover your account and data in case you lose
              access
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-grow pr-[2px]">
        <div className="space-y-6 pb-6 pr-2">
          <div className="relative overflow-hidden p-5 bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`h-12 w-12 rounded-full flex items-center justify-center ${getColorClass(
                    securityScore.color,
                  )
                    .split(" ")
                    .filter((c) => c.includes("bg-"))
                    .join(" ")}`}
                >
                  <Shield
                    className={`h-6 w-6 ${getColorClass(securityScore.color)
                      .split(" ")
                      .filter((c) => c.includes("text-"))
                      .join(" ")}`}
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Account Recovery Security Score
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-32 h-2 bg-gray-100 dark:bg-[#343140] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          securityScore.color === "red"
                            ? "bg-red-500"
                            : securityScore.color === "yellow"
                              ? "bg-yellow-500"
                              : securityScore.color === "blue"
                                ? "bg-blue-500"
                                : "bg-emerald-500"
                        }`}
                        style={{ width: `${securityScore.score}%` }}
                      />
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        securityScore.color === "red"
                          ? "text-red-500"
                          : securityScore.color === "yellow"
                            ? "text-yellow-500"
                            : securityScore.color === "blue"
                              ? "text-blue-500"
                              : "text-emerald-500"
                      }`}
                    >
                      {securityScore.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {securityScore.score >= 75
                      ? "Your account has strong recovery options enabled"
                      : "Enable more recovery methods to improve account security"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">
              Account Recovery Methods
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Set up methods to recover your account access
            </p>
          </div>

          <div className="space-y-4">
            <RecoveryInput
              type="email"
              icon={Mail}
              title="Recovery Email"
              subtitle="Use your email to recover account access"
              value={recoveryMethod.account_recovery.email.email || ""}
              verified={recoveryMethod.account_recovery.email.email_verified}
              enabled={recoveryMethod.account_recovery.email.enabled}
              onToggle={(enabled) => handleMethodToggle("email", enabled)}
              onChange={(value, verified) =>
                handleRecoveryInputChange("email", value, verified)
              }
              setRecoveryMethod={setRecoveryMethod}
            />

            <RecoveryInput
              type="phone"
              icon={Phone}
              title="Recovery Phone"
              subtitle="Use your phone number to recover account access"
              value={recoveryMethod.account_recovery.phone.phone || ""}
              verified={recoveryMethod.account_recovery.phone.phone_verified}
              enabled={recoveryMethod.account_recovery.phone.enabled}
              disabled={true}
              onToggle={(enabled) => handleMethodToggle("phone", enabled)}
              onChange={(value, verified) =>
                handleRecoveryInputChange("phone", value, verified)
              }
              setRecoveryMethod={setRecoveryMethod}
            />

            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Data Recovery
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Enable at least one method to recover your encrypted data
                  after a password reset
                </p>
              </div>

              <RecoveryCard
                type="phrase"
                icon={Key}
                title="Recovery Phrase"
                description="A recovery phrase lets you unlock your data after a password reset"
                enabled={recoveryMethod.data_recovery.phrase.enabled}
                generated={recoveryMethod.data_recovery.phrase.enabled}
                onGenerate={() => handleGenerateRecoveryItem("phrase")}
                setRecoveryMethod={setRecoveryMethod}
              />

              <RecoveryCard
                type="file"
                icon={FileKey}
                title="Recovery File"
                description="A recovery file lets you unlock your data after a password reset"
                enabled={recoveryMethod.data_recovery.file.enabled}
                generated={recoveryMethod.data_recovery.file.enabled}
                onGenerate={() => handleGenerateRecoveryItem("file")}
                setRecoveryMethod={setRecoveryMethod}
              />
            </div>
          </div>
        </div>
      </div>

      {showRecoveryPhraseModal && (
        <RecoveryPhraseModal
          isOpen={showRecoveryPhraseModal}
          onClose={() => setShowRecoveryPhraseModal(false)}
          recoveryMethod={recoveryMethod}
          setRecoveryMethod={setRecoveryMethod}
        />
      )}
    </div>
  );
};

export default RecoverySection;
