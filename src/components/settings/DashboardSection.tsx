import React, { useState, useCallback, useMemo, useRef } from "react";
import {
  Clock,
  CreditCard,
  Upload,
  Gift,
  ArrowRight,
  Check,
  Plus,
  Mail,
  Phone,
  Key,
  ArrowDown,
} from "lucide-react";
import DisableFeatureModal from "./DisableFeatureModal";
import { ApiError, ApiService } from "../../services/ApiService";
import PlansModal from "../PlanModal";
import { Switch } from "../Switch";
import { format } from "date-fns";

// Define types for the subscription updater
interface SubscriptionUpdaterRef {
  isUpdatingFromModal: boolean;
  update: React.Dispatch<React.SetStateAction<Subscription | null>>;
}

interface VoucherState {
  value: string | null;
  isLoading: boolean;
}

// Main Dashboard Component
export const DashboardSection: React.FC<DashboardProps> = ({
  user,
  subscription,
  setSubscription,
  availablePlans,
  formatBytes,
  preferences,
  setPreferences,
  setToastMessage,
  setShowToast,
}) => {
  // Define current plan
  const currentPlan = subscription?.plan_id || "free";
  const isFreeUser = currentPlan === "free";
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [voucher, setVoucher] = useState<VoucherState>({
    value: null,
    isLoading: false,
  });

  // Add ref to store the latest subscription data
  const latestSubscriptionRef = useRef<Subscription | null>(subscription);
  // Keep ref updated with latest subscription
  latestSubscriptionRef.current = subscription;

  // Create a subscription updater that doesn't cause re-renders during modal interaction
  const subscriptionUpdaterRef = useRef<SubscriptionUpdaterRef>({
    isUpdatingFromModal: false,
    update: (newSubscription) => {
      console.log("Setting subscription from modal");
      subscriptionUpdaterRef.current.isUpdatingFromModal = true;
      setSubscription(newSubscription);
      // Reset flag after a delay to ensure state updates have propagated
      setTimeout(() => {
        subscriptionUpdaterRef.current.isUpdatingFromModal = false;
      }, 500);
    },
  });

  // Use the current value of the ref for the component
  const subscriptionUpdater = subscriptionUpdaterRef.current;

  // Storage calculation
  const usedStorage = user?.used_drive_space || 0;
  const maxStorage = user?.max_drive_space || 3 * 1024 * 1024 * 1024; // Default 3GB
  const storagePercentage = (usedStorage / maxStorage) * 100;
  const availableStorage = maxStorage - usedStorage;

  // Get current plan features from available plans
  const currentPlanDetails = useMemo(() => {
    if (!availablePlans) return null;

    if (currentPlan === "free") {
      return availablePlans.individual.find((p) => p.id === "free");
    } else if (subscription?.plan_type === "family" && availablePlans.family) {
      return availablePlans.family;
    } else if (
      subscription?.plan_type === "business" &&
      availablePlans.business
    ) {
      return availablePlans.business;
    } else {
      return availablePlans.individual.find((p) => p.id === currentPlan);
    }
  }, [availablePlans, currentPlan, subscription?.plan_type]);

  // Calculate the next plan or previous plan to display
  const nextOrPreviousPlan = useMemo(() => {
    if (!availablePlans) return null;

    // First determine current plan tier
    const getCurrentTier = () => {
      if (currentPlan === "free") return 1;
      if (currentPlan === "plus") return 2;
      if (currentPlan === "pro") return 3;
      if (currentPlan === "max") return 4;
      if (currentPlan === "family") return 3;
      if (currentPlan === "business") return 4;
      return 1;
    };

    const currentTier = getCurrentTier();

    // If at max plan, show previous plan
    if (currentTier === 4) {
      // Downgrade option
      if (subscription?.plan_type === "individual") {
        const previousPlan = availablePlans.individual.find(
          (p) => p.tier === 3,
        );
        if (previousPlan) {
          return {
            id: previousPlan.id,
            name: previousPlan.name,
            price: previousPlan.price.monthly,
            features: previousPlan.features.slice(0, 4),
            actionType: "downgrade",
          };
        }
      } else if (subscription?.plan_type === "business") {
        // From business to individual max
        const maxPlan = availablePlans.individual.find((p) => p.id === "max");
        if (maxPlan) {
          return {
            id: maxPlan.id,
            name: maxPlan.name,
            price: maxPlan.price.monthly,
            features: maxPlan.features.slice(0, 4),
            actionType: "downgrade",
          };
        }
      }
    }

    // For all other plans, show next upgrade
    if (currentTier < 4) {
      if (
        subscription?.plan_type === "individual" ||
        subscription?.plan_type === undefined
      ) {
        // Find next individual plan
        const nextPlan = availablePlans.individual.find(
          (p) => p.tier === currentTier + 1,
        );
        if (nextPlan) {
          return {
            id: nextPlan.id,
            name: nextPlan.name,
            price: nextPlan.price.monthly,
            features: nextPlan.features.slice(0, 4),
            actionType: "upgrade",
          };
        }
      } else if (currentPlan === "free") {
        // Free users should see Plus plan
        const plusPlan = availablePlans.individual.find((p) => p.id === "plus");
        if (plusPlan) {
          return {
            id: plusPlan.id,
            name: plusPlan.name,
            price: plusPlan.price.monthly,
            features: plusPlan.features.slice(0, 4),
            actionType: "upgrade",
          };
        }
      }
    }

    // Fallback to Max plan for upgrades if no match
    const fallbackPlan = availablePlans.individual.find((p) => p.id === "max");
    if (fallbackPlan) {
      return {
        id: fallbackPlan.id,
        name: fallbackPlan.name,
        price: fallbackPlan.price.monthly,
        features: fallbackPlan.features.slice(0, 4),
        actionType: "upgrade",
      };
    }

    return null;
  }, [availablePlans, currentPlan, subscription?.plan_type]);

  const [disableFeatureModal, setDisableFeatureModal] = useState({
    isOpen: false,
    featureTitle: "",
    featureType: "security" as "security" | "mfa",
    notificationType: "",
  });

  // Handle opening the plans modal
  const handleOpenPlansModal = useCallback(() => {
    if (availablePlans) {
      setShowPlansModal(true);
    }
  }, [availablePlans]);

  // Function to handle notification toggle with confirmation modal for disabling
  const handleNotificationToggle = (
    notificationType: string,
    currentValue: boolean,
  ) => {
    // If turning off a notification, show confirmation modal
    if (currentValue) {
      let featureTitle = "";

      switch (notificationType) {
        case "email":
          featureTitle = "Email Notifications";
          break;
        case "push":
          featureTitle = "App Notifications";
          break;
        case "security":
          featureTitle = "Security Alerts";
          break;
        default:
          featureTitle = "This Feature";
      }

      setDisableFeatureModal({
        isOpen: true,
        featureTitle,
        featureType: "security",
        notificationType,
      });
    } else {
      // If turning on, no confirmation needed
      updateNotificationSettings(notificationType, true);
    }
  };

  // Function to actually update the notification setting
  const updateNotificationSettings = async (
    notificationType: string,
    enabled: boolean,
  ) => {
    // Create a copy of current notifications with default values
    const currentNotifications = preferences?.notifications || {
      push: false,
      email: false,
      security: false,
    };

    // Create updated notifications object
    const updatedNotifications = {
      ...currentNotifications,
      [notificationType]: enabled,
    };

    // Update preferences locally first for immediate UI feedback
    setPreferences((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        notifications: updatedNotifications,
      };
    });

    // Send to server
    await ApiService.updatePreferences({
      notifications: updatedNotifications,
    });
    setToastMessage({
      type: "success",
      text: "Notification preferences updated successfully",
    });
    setShowToast(true);
  };

  const calculateHash = async (value: string): Promise<string> => {
    try {
      const normalizedName = value.toLowerCase().trim();

      // Create a simple hash of just the name itself
      const encoder = new TextEncoder();
      const nameBytes = encoder.encode(normalizedName);

      // Hash the name bytes
      const hashBuffer = await crypto.subtle.digest("SHA-256", nameBytes);

      // Convert to hex string
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      return hashHex;
    } catch (error) {
      throw error;
    }
  };

  const handleVoucherRedeem = async () => {
    setVoucher((prev) => ({
      ...prev,
      isLoading: true,
    }));

    try {
      if (!voucher.value) throw new Error("Voucher is required");

      const voucherValue = await calculateHash(String(voucher.value));
      await ApiService.redeemVoucher(voucherValue);
      setToastMessage({
        type: "success",
        text: "Voucher redeemed successfully",
      });
      setShowToast(true);
    } catch (err) {
      const error = err as ApiError;
      setToastMessage({
        type: "error",
        text: `${error.message}`,
      });
      setShowToast(true);
    } finally {
      setVoucher({
        value: null,
        isLoading: false,
      });
    }
  };

  // Handle confirmation from disable modal
  const handleDisableConfirm = () => {
    updateNotificationSettings(disableFeatureModal.notificationType, false);
    setDisableFeatureModal((prev) => ({ ...prev, isOpen: false }));
  };

  // Handle closing plan modal with cleanup
  const handleClosePlansModal = useCallback(() => {
    setShowPlansModal(false);
  }, []);

  return (
    <div className="flex flex-col h-full pb-6 lg:pb-2">
      {/* Static Header */}
      <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Dashboard
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your storage, subscription plan, payments, and notification
              preferences
            </p>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="overflow-y-auto flex-grow">
        <div className="space-y-6 pb-6">
          {/* Storage Section */}
          <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden w-full">
            <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 sm:px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Your Storage
              </h2>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-4 xl:space-y-0 xl:grid xl:grid-cols-3 xl:gap-5">
                {/* Storage Usage Content */}
                <div className="xl:col-span-2">
                  <div className="space-y-3 sm:space-y-4">
                    <div className="flex flex-wrap justify-between items-start sm:items-baseline gap-2">
                      <div>
                        <div className="flex flex-wrap items-baseline gap-1 sm:gap-2">
                          <span className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            {formatBytes(usedStorage)}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            of {formatBytes(maxStorage)}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Used storage space
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                          {storagePercentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 sm:h-2.5 w-full bg-slate-100 dark:bg-[#343140] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          storagePercentage > 90
                            ? "bg-red-500"
                            : storagePercentage > 75
                              ? "bg-amber-500"
                              : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${Math.min(storagePercentage, 100)}%`,
                        }}
                      ></div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                        <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                        <span>{formatBytes(availableStorage)} available</span>
                      </div>

                      {isFreeUser && (
                        <button
                          onClick={handleOpenPlansModal}
                          className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-medium hover:underline flex items-center gap-1"
                        >
                          Upgrade storage
                          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Storage Upgrade or Premium Info */}
                <div className="xl:col-span-1">
                  {isFreeUser ? (
                    <div className="h-full bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/20 p-3 sm:p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Try out Drive to its full potential
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">
                        Upgrade your plan to increase your storage.
                      </p>
                      <div className="mt-3 sm:mt-4 pt-2 sm:pt-3 border-t border-emerald-100 dark:border-emerald-800/20">
                        <div className="space-y-1.5 sm:space-y-2">
                          {nextOrPreviousPlan?.features
                            .slice(0, 2)
                            .map((feature, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-1.5 sm:gap-2"
                              >
                                <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                                <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                  {feature}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                      <button
                        onClick={handleOpenPlansModal}
                        className="w-full py-1.5 sm:py-2 mt-3 sm:mt-4 px-3 sm:px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-md sm:rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Get more storage
                        <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-full bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/20 p-3 sm:p-4">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Premium Storage
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1 sm:mt-2">
                        You're enjoying enhanced storage as part of your premium
                        plan.
                      </p>
                      <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
                        {currentPlanDetails?.features
                          .slice(0, 3)
                          .map((feature, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1.5 sm:gap-2"
                            >
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-500" />
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">
                                {feature}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Plan Section */}
          <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden w-full">
            <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 sm:px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Your Plan
              </h2>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-6 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-6">
                {/* Current Plan Card */}
                <div className="bg-white dark:bg-[#1c1b23] rounded-lg border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden">
                  <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200/60 dark:border-[#343140]/60 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="h-7 w-7 sm:h-8 sm:w-8 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                        <CreditCard className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                        Current Plan
                      </h3>
                    </div>
                    <span className="px-2 py-0.5 sm:py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full">
                      {(subscription?.status ?? "active")
                        .charAt(0)
                        .toLocaleUpperCase() +
                        (subscription?.status ?? "active").slice(1)}
                    </span>
                  </div>

                  <div className="p-4 sm:p-5">
                    {currentPlanDetails ? (
                      <>
                        <div className="flex items-baseline gap-1 sm:gap-2 mb-3 sm:mb-4">
                          <span className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                            $
                            {subscription?.billing_cycle === "yearly"
                              ? (currentPlanDetails.price.yearly / 12).toFixed(
                                  2,
                                )
                              : currentPlanDetails.price.monthly.toFixed(2)}
                          </span>
                          <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                            /month
                          </span>
                          {subscription?.billing_cycle === "yearly" && (
                            <span className="ml-1 text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded">
                              Yearly
                            </span>
                          )}
                        </div>

                        <div className="space-y-2 sm:space-y-3">
                          <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                            Plan Features
                          </h4>
                          <div className="space-y-1.5 sm:space-y-2">
                            {currentPlanDetails.features
                              .slice(0, 5)
                              .map((feature, index) => (
                                <div
                                  key={index}
                                  className="flex items-center gap-1.5 sm:gap-2"
                                >
                                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0" />
                                  <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                    {feature}
                                  </span>
                                </div>
                              ))}
                          </div>

                          {subscription?.current_period_end && (
                            <div className="pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-slate-200 dark:border-slate-700 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
                              <span className="truncate">
                                {subscription.auto_renew
                                  ? "Renews on"
                                  : "Expires on"}{" "}
                                {format(
                                  new Date(
                                    subscription.current_period_end * 1000,
                                  ),
                                  "MMMM d, yyyy",
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="animate-pulse">
                        <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-4"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-40"></div>
                          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-36"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Next Plan Card */}
                {nextOrPreviousPlan && (
                  <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/10 rounded-lg border border-emerald-200/60 dark:border-emerald-800/30 overflow-hidden">
                    <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-emerald-200/60 dark:border-emerald-800/30 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="h-7 w-7 sm:h-8 sm:w-8 bg-white dark:bg-[#2c2934] rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-200 dark:border-emerald-800/30">
                          {nextOrPreviousPlan.actionType === "upgrade" ? (
                            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">
                          {nextOrPreviousPlan.name}
                        </h3>
                      </div>
                      <span className="px-2 py-0.5 sm:py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-full whitespace-nowrap">
                        {nextOrPreviousPlan.actionType === "upgrade"
                          ? "Recommended"
                          : "Downgrade Option"}
                      </span>
                    </div>

                    <div className="p-4 sm:p-5">
                      <div className="flex items-baseline gap-1 sm:gap-2 mb-3 sm:mb-4">
                        <span className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
                          ${nextOrPreviousPlan.price.toFixed(2)}
                        </span>
                        <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          /month
                        </span>
                      </div>

                      <div className="space-y-2 sm:space-y-3">
                        <h4 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                          What You Get
                        </h4>
                        <div className="space-y-1.5 sm:space-y-2">
                          {nextOrPreviousPlan.features.map((feature, index) => (
                            <div
                              key={index}
                              className="flex items-center gap-1.5 sm:gap-2"
                            >
                              <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0" />
                              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                                {feature}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className="pt-2 sm:pt-3 mt-2 sm:mt-3 border-t border-emerald-200/60 dark:border-emerald-800/20">
                          <button
                            onClick={handleOpenPlansModal}
                            className="w-full py-1.5 sm:py-2 px-3 sm:px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-md sm:rounded-lg flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {nextOrPreviousPlan.actionType === "upgrade"
                              ? "Upgrade now"
                              : "Change plan"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Credits & Vouchers Section */}
          <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden w-full">
            <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 sm:px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Credits & Vouchers
              </h2>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-5 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-5">
                {/* Account balance */}
                <div className="bg-white dark:bg-[#2c2934] rounded-lg border border-slate-200/60 dark:border-[#343140]/60 p-4 sm:p-5">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                      <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Account Balance
                    </h3>
                  </div>

                  <div className="flex items-baseline gap-1 sm:gap-2">
                    <span className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                      ${user?.credit}
                    </span>
                    <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      available
                    </span>
                  </div>

                  <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Your account credits will be automatically applied to your
                    next invoice.
                  </p>
                </div>

                {/* Voucher code */}
                <div className="bg-white dark:bg-[#2c2934] rounded-lg border border-slate-200/60 dark:border-[#343140]/60 p-4 sm:p-5">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                      <Gift className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                    </div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Redeem Voucher
                    </h3>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter voucher code here"
                      className="flex-1 min-w-0 px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-100 dark:bg-[#343140] border border-slate-200 dark:border-[#1c1b23]/60 rounded-md sm:rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                      value={voucher.value || ""}
                      onChange={(e) =>
                        setVoucher({ value: e.target.value, isLoading: false })
                      }
                      onKeyUp={(e) => {
                        if (e.key === "Enter") {
                          handleVoucherRedeem();
                        }
                      }}
                    />
                    <button
                      onClick={handleVoucherRedeem}
                      disabled={voucher.isLoading}
                      className="px-2 sm:px-3 py-1.5 sm:py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs sm:text-sm font-medium rounded-md sm:rounded-lg whitespace-nowrap cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {voucher.isLoading ? "Validating..." : "Apply"}
                    </button>
                  </div>

                  <p className="mt-2 sm:mt-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                    Apply a voucher to add credits to your account for future
                    payments.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Notification Toggles Section */}
          <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden w-full">
            <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 sm:px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Notifications
              </h2>
            </div>

            <div className="p-4 sm:p-6">
              <div className="space-y-3 sm:space-y-4">
                {[
                  {
                    key: "email" as const,
                    title: "Email Notifications",
                    description:
                      "Receive important news and product updates via email",
                    icon: Mail,
                  },
                  {
                    key: "push" as const,
                    title: "App Notifications",
                    description:
                      "Receive updates via push notifications on your devices",
                    icon: Phone,
                  },
                  {
                    key: "security" as const,
                    title: "Security Alerts",
                    description:
                      "Get notified about dark web alerts and security events",
                    icon: Key,
                  },
                ].map((notification) => (
                  <div
                    key={notification.key}
                    className="relative overflow-hidden p-3 sm:p-4 bg-white dark:bg-[#1c1b23] rounded-lg sm:rounded-xl border border-slate-200/60 dark:border-[#343140]/60 transition-all duration-200 hover:shadow-md"
                  >
                    <div className="absolute top-0 right-0 w-24 sm:w-32 h-24 sm:h-32 opacity-[0.03] pointer-events-none">
                      <notification.icon className="w-full h-full text-emerald-500" />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0 pr-12 sm:pr-0">
                        <div className="h-8 w-8 sm:h-10 sm:w-10 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                          <notification.icon className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {notification.description}
                          </p>
                        </div>
                      </div>
                      <div className="absolute top-3 right-3 sm:static sm:flex-shrink-0">
                        <Switch
                          enabled={
                            preferences?.notifications?.[notification.key] ===
                            true
                          }
                          onChange={() =>
                            handleNotificationToggle(
                              notification.key,
                              preferences?.notifications?.[notification.key] ===
                                true,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Plans Modal - KEY CHANGE: Use wrapped subscription updater function */}
      {showPlansModal && (
        <PlansModal
          isOpen={showPlansModal}
          onClose={handleClosePlansModal}
          subscription={subscription}
          setSubscription={subscriptionUpdater.update}
          availablePlans={availablePlans}
          setToastMessage={setToastMessage}
          setShowToast={setShowToast}
        />
      )}

      <DisableFeatureModal
        isOpen={disableFeatureModal.isOpen}
        onClose={() =>
          setDisableFeatureModal((prev) => ({ ...prev, isOpen: false }))
        }
        onConfirm={handleDisableConfirm}
        featureTitle={disableFeatureModal.featureTitle}
        featureType={disableFeatureModal.featureType}
      />
    </div>
  );
};

export default DashboardSection;
