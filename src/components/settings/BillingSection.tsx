import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  CreditCard,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  XCircle,
  Database,
  DollarSign,
  Calendar,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { ApiService } from "../../services/ApiService";
import { useAuth } from "../../context/AuthContext";
import PlansModal from "../PlanModal";
import BillingHistorySection from "./BillingHistorySection";
import CardUpdateModal from "./CardUpdateModal";

interface BillingSectionProps {
  subscription: Subscription | null;
  setSubscription: React.Dispatch<React.SetStateAction<Subscription | null>>;
  availablePlans: FeaturedPlans | null;
  setToastMessage: React.Dispatch<React.SetStateAction<ToastMessage>>;
  setShowToast: React.Dispatch<React.SetStateAction<boolean>>;
}

export const BillingSection: React.FC<BillingSectionProps> = ({
  subscription,
  setSubscription,
  availablePlans,
  setToastMessage,
  setShowToast,
}) => {
  const { user } = useAuth() as { user: User | null };
  const [updateCardModalOpen, setUpdateCardModalOpen] =
    useState<boolean>(false);
  const [showPlansModal, setShowPlansModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [isLoadingPayment, setIsLoadingPayment] = useState<boolean>(false);
  const [isUpdatingAutoRenew, setIsUpdatingAutoRenew] =
    useState<boolean>(false);
  const [isRemovingCard, setIsRemovingCard] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Add a ref for the scrollable content area to control scrolling
  const scrollableContentRef = useRef<HTMLDivElement>(null);

  // Determine user state
  const isFreeUser = subscription?.plan_id === "free";
  const isDelinquent = user?.delinquent;
  const canRemoveCard =
    isDelinquent ||
    (subscription && !subscription.auto_renew && user?.type === 1);

  // Format helpers
  const formatDate = (timestamp?: number): string => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatBytes = (bytes: number, decimals = 2): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Find current plan details
  const currentPlanDetails = useMemo((): PlanFeature | null => {
    if (!subscription || !availablePlans) return null;

    if (subscription.plan_id === "free") {
      return availablePlans.individual?.find((p) => p.id === "free") || null;
    } else if (subscription.plan_type === "family" && availablePlans.family) {
      return availablePlans.family;
    } else if (
      subscription.plan_type === "business" &&
      availablePlans.business
    ) {
      return availablePlans.business;
    } else {
      return (
        availablePlans.individual?.find((p) => p.id === subscription.plan_id) ||
        null
      );
    }
  }, [subscription, availablePlans]);

  // Get recommended plan for upgrade
  const recommendedPlan = useMemo((): PlanFeature | null => {
    if (!availablePlans?.individual) return null;

    if (isFreeUser) {
      return (
        availablePlans.individual.find((p) => p.id === "plus") ||
        availablePlans.individual.find((p) => p.id !== "free") ||
        null
      );
    } else if (subscription?.plan_type === "individual") {
      const currentTier = currentPlanDetails?.tier || 0;
      return (
        availablePlans.individual.find((p) => (p.tier || 0) > currentTier) ||
        null
      );
    }

    return null;
  }, [availablePlans, subscription, isFreeUser, currentPlanDetails]);

  // Calculate storage information
  const storageInfo = useMemo(() => {
    if (!subscription || !currentPlanDetails) {
      return {
        base: 0,
        additional: 0,
        total: 0,
        used: 0,
        percentage: 0,
      };
    }

    const baseStorage =
      subscription.storage.base_quota ||
      currentPlanDetails.storage ||
      3 * 1024 * 1024 * 1024; // 3GB default

    const additionalStorage = subscription.storage.additional || 0;
    const usedStorage = user?.used_drive_space || 0;
    const totalStorage = baseStorage + additionalStorage;
    const percentage =
      totalStorage > 0 ? (usedStorage / totalStorage) * 100 : 0;

    return {
      base: baseStorage,
      additional: additionalStorage,
      total: totalStorage,
      used: usedStorage,
      percentage: percentage,
    };
  }, [subscription, currentPlanDetails, user]);

  // Load payment method on component mount
  useEffect(() => {
    if (!isFreeUser) {
      const fetchPaymentMethod = async (): Promise<void> => {
        setIsLoadingPayment(true);
        try {
          const response = await ApiService.getPaymentMethod();
          if (response && response.code === 1000) {
            setPaymentMethod(response.payment_method);
          }
        } catch (error) {
          console.error("Error fetching payment method:", error);
        } finally {
          setIsLoadingPayment(false);
        }
      };

      fetchPaymentMethod();
    }
  }, [isFreeUser]);

  // Handle auto-renew toggle
  const handleAutoRenewToggle = async (): Promise<void> => {
    if (!subscription) return;
    setIsUpdatingAutoRenew(true);

    try {
      if (!subscription.auto_renew) {
        // Enable auto-renewal
        const response = await ApiService.resumeSubscription();
        if (response && response.code === 1000) {
          setSubscription((prev) =>
            prev ? { ...prev, auto_renew: true } : prev,
          );
          setToastMessage({
            type: "success",
            text: "Auto-renewal has been enabled",
          });
          setShowToast(true);
        } else {
          throw new Error(response?.detail || "Failed to enable auto-renewal");
        }
      } else {
        // Disable auto-renewal
        const response = await ApiService.cancelSubscription();
        if (response && response.code === 1000) {
          setSubscription((prev) =>
            prev ? { ...prev, auto_renew: false } : prev,
          );
          setToastMessage({
            type: "success",
            text: `Auto-renewal has been disabled. Your subscription will end on ${formatDate(
              response.end_date,
            )}`,
          });
          setShowToast(true);
        } else {
          throw new Error(response?.detail || "Failed to disable auto-renewal");
        }
      }
    } catch (err) {
      setToastMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to update auto-renewal setting. Please try again later.",
      });
      setShowToast(true);
    } finally {
      setIsUpdatingAutoRenew(false);
    }
  };

  // Handle removing payment method
  const handleRemovePaymentMethod = async (): Promise<void> => {
    if (!canRemoveCard) return;

    setIsRemovingCard(true);
    try {
      const response = await ApiService.removePaymentMethod();
      if (response && response.code === 1000) {
        setPaymentMethod(null);
        setToastMessage({
          type: "success",
          text: "Payment method has been removed successfully",
        });
        setShowToast(true);
      } else {
        throw new Error(response?.detail || "Failed to remove payment method");
      }
    } catch (err) {
      setToastMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to remove payment method. Please try again later.",
      });
      setShowToast(true);
    } finally {
      setIsRemovingCard(false);
    }
  };

  // Handle opening plans modal
  const handleOpenPlansModal = (): void => {
    if (availablePlans) {
      setShowPlansModal(true);
    } else {
      setToastMessage({
        type: "error",
        text: "Unable to load plans. Please try again later.",
      });
      setShowToast(true);
    }
  };

  // Handle closing plans modal
  const handleClosePlansModal = (): void => {
    setShowPlansModal(false);
  };

  // Handle scroll to top of content area when billing history pages change
  const handleBillingHistoryPageChange = () => {
    // Add a 100ms delay before scrolling
    setTimeout(() => {
      if (scrollableContentRef.current) {
        // Use smooth scrolling behavior
        scrollableContentRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  const handleTabClick = (tabName: string): void => {
    setActiveTab(tabName);

    // Add a small delay before scrolling to ensure the tab content has been rendered
    setTimeout(() => {
      if (scrollableContentRef.current) {
        // Use smooth scrolling behavior
        scrollableContentRef.current.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      }
    }, 100);
  };

  return (
    <div className="flex flex-col h-full pb-6 lg:pb-2">
      {/* Static Header - With flex-shrink-0 to prevent it from shrinking */}
      <div className="pb-4 mb-6 border-b border-slate-200/60 dark:border-[#343140]/60 flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Billing & Subscription
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage your plan, payment methods, and billing history
            </p>
          </div>
        </div>
      </div>

      {/* Alert for delinquent accounts - Static, shows on all tabs */}
      {isDelinquent && (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 rounded-lg mb-6 flex-shrink-0">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                Payment Issue Detected
              </h3>
              <div className="mt-1 text-xs text-red-700 dark:text-red-200">
                Your last payment attempt failed. Please update your payment
                method to continue using premium features.
              </div>
              <div className="mt-3">
                <button
                  onClick={handleOpenPlansModal}
                  className="text-xs font-medium text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg cursor-pointer transition-colors duration-200"
                >
                  Update payment method
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation - Static, with flex-shrink-0 to prevent it from scrolling */}
      <div className="mb-6 -mx-2 sm:mx-0 flex-shrink-0">
        <div className="relative flex border-b border-slate-200/60 dark:border-[#343140]/60 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => handleTabClick("overview")}
            className={`py-2 px-4 text-sm font-medium whitespace-nowrap cursor-pointer relative flex-shrink-0 ${
              activeTab === "overview"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Overview
            {activeTab === "overview" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></span>
            )}
          </button>
          <button
            onClick={() => handleTabClick("payment")}
            className={`py-2 px-4 text-sm font-medium whitespace-nowrap cursor-pointer relative flex-shrink-0 ${
              activeTab === "payment"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Payment Methods
            {activeTab === "payment" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></span>
            )}
          </button>
          <button
            onClick={() => handleTabClick("usage")}
            className={`py-2 px-4 text-sm font-medium whitespace-nowrap cursor-pointer relative flex-shrink-0 ${
              activeTab === "usage"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            Usage
            {activeTab === "usage" && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></span>
            )}
          </button>
          {!isFreeUser && (
            <button
              onClick={() => handleTabClick("history")}
              className={`py-2 px-4 text-sm font-medium whitespace-nowrap cursor-pointer relative flex-shrink-0 ${
                activeTab === "history"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              Billing History
              {activeTab === "history" && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Flexbox layout for the scrollable area and static footer */}
      <div className="flex flex-col h-full min-h-0 flex-grow">
        {/* Scrollable Content Area - This is the only part that scrolls */}
        <div
          ref={scrollableContentRef}
          className="flex-grow overflow-y-auto min-h-0 pr-2"
        >
          {/* Tab Content */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Current Plan Card */}
              <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
                <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3 flex flex-wrap justify-between items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Current Plan
                  </h2>
                  <button
                    onClick={handleOpenPlansModal}
                    className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center cursor-pointer"
                  >
                    {isFreeUser ? "Upgrade Plan" : "Change Plan"}
                    <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                      <DollarSign className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {currentPlanDetails?.name ||
                          (isFreeUser ? "Free Plan" : "Premium Plan")}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {isFreeUser
                          ? "Basic account with limited features"
                          : subscription?.plan_type
                            ? `${
                                subscription.plan_type.charAt(0).toUpperCase() +
                                subscription.plan_type.slice(1)
                              } subscription`
                            : "Premium subscription"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                    {/* Price Card */}
                    <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <DollarSign className="h-4 w-4 text-emerald-500 mr-1" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Price
                        </span>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {isFreeUser
                          ? "Free"
                          : `$${
                              subscription?.billing_cycle === "yearly"
                                ? (
                                    (currentPlanDetails?.price?.yearly || 0) /
                                    12
                                  ).toFixed(2)
                                : (
                                    currentPlanDetails?.price?.monthly || 0
                                  ).toFixed(2)
                            }/mo`}
                      </p>
                      {!isFreeUser &&
                        subscription?.billing_cycle === "yearly" && (
                          <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                            Annual plan - save 20%
                          </p>
                        )}
                    </div>

                    {/* Renewal Card */}
                    {!isFreeUser && subscription?.current_period_end && (
                      <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3">
                        <div className="flex items-center mb-1">
                          <Calendar className="h-4 w-4 text-emerald-500 mr-1" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                            {subscription.auto_renew
                              ? "Renews on"
                              : "Expires on"}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatDate(subscription.current_period_end)}
                        </p>
                        {!subscription.auto_renew && (
                          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">
                            Auto-renewal disabled
                          </p>
                        )}
                      </div>
                    )}

                    {/* Storage Card */}
                    <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3">
                      <div className="flex items-center mb-1">
                        <Database className="h-4 w-4 text-emerald-500 mr-1" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Storage
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">
                          {formatBytes(storageInfo.total || 0)}
                        </span>{" "}
                        <span className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                          {Math.min(storageInfo.percentage || 0, 100).toFixed(
                            1,
                          )}
                          % used
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Auto-renewal toggle */}
                  {!isFreeUser && (
                    <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-3 flex flex-wrap justify-between items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          Auto-renewal
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {subscription?.auto_renew
                            ? "Your subscription will automatically renew at the end of the billing cycle"
                            : "Your subscription will end on the expiry date"}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        <button
                          onClick={handleAutoRenewToggle}
                          disabled={isUpdatingAutoRenew}
                          className={`relative inline-flex h-5 w-10 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            subscription?.auto_renew
                              ? "bg-emerald-500"
                              : "bg-slate-200 dark:bg-[#343140]"
                          } ${
                            isUpdatingAutoRenew
                              ? "opacity-50 cursor-not-allowed"
                              : ""
                          }`}
                          aria-pressed={subscription?.auto_renew}
                        >
                          <span className="sr-only">Toggle auto-renewal</span>
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              subscription?.auto_renew
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Features */}
                  {currentPlanDetails?.features &&
                    currentPlanDetails.features.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-[#343140]/60">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                          Plan Features
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-2 gap-y-1.5">
                          {currentPlanDetails.features
                            .slice(0, 6)
                            .map((feature, index) => (
                              <div key={index} className="flex items-start">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span className="ml-2 text-xs text-gray-700 dark:text-gray-300 truncate">
                                  {feature}
                                </span>
                              </div>
                            ))}
                        </div>
                        {currentPlanDetails.features.length > 6 && (
                          <button
                            onClick={handleOpenPlansModal}
                            className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 font-medium inline-flex items-center cursor-pointer"
                          >
                            View all features
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                </div>
              </section>

              {/* Upgrade Recommendation for Free Users */}
              {isFreeUser && recommendedPlan && (
                <section className="bg-gradient-to-r from-emerald-50 to-blue-50 dark:from-emerald-900/10 dark:to-blue-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/20 overflow-hidden shadow-sm">
                  <div className="p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                      <div>
                        <span className="inline-block px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium rounded-full mb-1">
                          Recommended
                        </span>
                        <h2 className="text-base font-bold text-gray-900 dark:text-white">
                          Upgrade to {recommendedPlan.name}
                        </h2>
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                          Get {formatBytes(recommendedPlan.storage || 0)}{" "}
                          storage and access to premium features
                        </p>
                      </div>

                      <div className="text-left sm:text-right flex flex-col items-start sm:items-end">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Starting at
                        </p>
                        <p className="text-base font-bold text-gray-900 dark:text-white mb-2">
                          ${(recommendedPlan.price?.monthly || 0).toFixed(2)}
                          <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                            /mo
                          </span>
                        </p>
                        <button
                          onClick={handleOpenPlansModal}
                          className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
                        >
                          Upgrade now
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5">
                      {(recommendedPlan.features || [])
                        .slice(0, 6)
                        .map((feature, index) => (
                          <div key={index} className="flex items-start">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span className="ml-1.5 text-xs text-gray-700 dark:text-gray-300">
                              {feature}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {activeTab === "payment" && (
            <div className="space-y-6">
              {/* Payment Method Card */}
              <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
                <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3 flex flex-wrap justify-between items-center gap-2">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Payment Method
                  </h2>
                </div>
                <div className="p-4">
                  {isLoadingPayment ? (
                    <div className="animate-pulse space-y-4">
                      <div className="h-48 bg-slate-100 dark:bg-[#2c2934] rounded-xl"></div>
                      <div className="h-8 w-32 bg-slate-100 dark:bg-[#2c2934] rounded-lg"></div>
                    </div>
                  ) : paymentMethod ? (
                    <div>
                      {/* Card Design */}
                      <div
                        className={`relative overflow-hidden rounded-xl shadow mb-4 ${
                          isDelinquent ? "border-2 border-red-500" : ""
                        }`}
                      >
                        <div className="p-5 bg-gradient-to-r from-emerald-500 to-emerald-700">
                          {/* Card background pattern */}
                          <div className="absolute inset-0 overflow-hidden opacity-10">
                            <svg
                              className="absolute h-full w-full"
                              viewBox="0 0 600 600"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <g opacity="0.4">
                                <circle
                                  cx="200"
                                  cy="150"
                                  r="150"
                                  stroke="white"
                                  strokeWidth="0.5"
                                />
                                <circle
                                  cx="200"
                                  cy="150"
                                  r="100"
                                  stroke="white"
                                  strokeWidth="0.5"
                                />
                                <circle
                                  cx="200"
                                  cy="150"
                                  r="50"
                                  stroke="white"
                                  strokeWidth="0.5"
                                />
                                <circle
                                  cx="450"
                                  cy="400"
                                  r="150"
                                  stroke="white"
                                  strokeWidth="0.5"
                                />
                                <circle
                                  cx="450"
                                  cy="400"
                                  r="100"
                                  stroke="white"
                                  strokeWidth="0.5"
                                />
                                <circle
                                  cx="450"
                                  cy="400"
                                  r="50"
                                  stroke="white"
                                  strokeWidth="0.5"
                                />
                              </g>
                            </svg>
                          </div>

                          <div className="relative z-10 flex flex-col h-36 sm:h-28">
                            {/* Top section - Card brand and chip */}
                            <div className="flex justify-between mb-4">
                              <div className="w-8 h-6 bg-yellow-200 rounded-sm opacity-90 flex items-center justify-center">
                                <div className="w-6 h-4 border border-yellow-600 rounded-sm opacity-90 flex flex-col justify-between py-0.5">
                                  <div className="border-t border-yellow-600 mx-1 opacity-90"></div>
                                  <div className="border-t border-yellow-600 mx-1 opacity-90"></div>
                                </div>
                              </div>

                              <div className="flex items-center">
                                {paymentMethod.brand === "visa" && (
                                  <div className="text-white font-bold text-lg tracking-wider">
                                    VISA
                                  </div>
                                )}
                                {paymentMethod.brand === "mastercard" && (
                                  <div className="flex">
                                    <div className="w-6 h-6 rounded-full bg-red-500 opacity-90"></div>
                                    <div className="w-6 h-6 rounded-full bg-yellow-500 opacity-90 -ml-3"></div>
                                  </div>
                                )}
                                {paymentMethod.brand === "amex" && (
                                  <div className="text-white font-bold text-sm">
                                    AMEX
                                  </div>
                                )}
                                {paymentMethod.brand === "discover" && (
                                  <div className="text-white font-bold text-sm">
                                    DISCOVER
                                  </div>
                                )}
                                {![
                                  "visa",
                                  "mastercard",
                                  "amex",
                                  "discover",
                                ].includes(
                                  paymentMethod.brand?.toLowerCase() || "",
                                ) && (
                                  <CreditCard className="h-6 w-6 text-white" />
                                )}
                              </div>
                            </div>

                            {/* Card Number */}
                            <div className="text-white text-sm sm:text-base font-mono tracking-wider mb-4">
                              •••• •••• •••• {paymentMethod.last4 || "****"}
                            </div>

                            {/* Bottom section */}
                            <div className="flex justify-between items-end mt-auto flex-wrap gap-2">
                              <div className="text-white">
                                <div className="text-xs uppercase opacity-80 mb-0.5">
                                  Expires
                                </div>
                                <div className="text-sm">
                                  {paymentMethod.exp_month || "MM"}/
                                  {paymentMethod.exp_year
                                    ?.toString()
                                    .slice(-2) || "YY"}
                                </div>
                              </div>

                              <div className="sm:text-right">
                                <div className="text-xs uppercase text-white opacity-80 mb-0.5">
                                  Auto-Renew
                                </div>
                                {subscription?.auto_renew ? (
                                  <div className="px-2 py-0.5 bg-emerald-400/30 border border-emerald-400/30 text-white rounded text-xs">
                                    Enabled
                                  </div>
                                ) : (
                                  <div className="px-2 py-0.5 bg-white/20 border border-white/20 text-white rounded text-xs">
                                    Disabled
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Delinquent warning */}
                        {isDelinquent && (
                          <div className="bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800/20 text-red-800 dark:text-red-300 p-3 text-xs">
                            <div className="flex items-center">
                              <AlertTriangle className="h-4 w-4 mr-2 text-red-500 dark:text-red-400" />
                              <span className="font-medium">
                                Payment failed
                              </span>
                            </div>
                            <p className="mt-1 ml-6">
                              Please update your payment method to continue
                              using premium features.
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Card Actions */}
                      <div className="flex flex-wrap gap-3">
                        <button
                          onClick={() => setUpdateCardModalOpen(true)}
                          className="flex items-center justify-center py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          Update Card
                        </button>

                        {canRemoveCard && (
                          <button
                            onClick={handleRemovePaymentMethod}
                            disabled={isRemovingCard}
                            className={`flex items-center justify-center py-1.5 px-3 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/30 rounded-lg text-xs cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors ${
                              isRemovingCard
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1.5" />
                            Remove Card
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-200 dark:border-[#343140] rounded-xl p-5">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-[#2c2934] flex items-center justify-center mb-3">
                          <CreditCard className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                          No payment method on file
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">
                          {isFreeUser
                            ? "Add a payment method to upgrade to a paid plan and get access to premium features."
                            : "Please add a payment method to continue your subscription and avoid service interruption."}
                        </p>
                        <button
                          onClick={handleOpenPlansModal}
                          className="py-1.5 px-4 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Add payment method
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Payment Security Info */}
              <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
                <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Payment Security
                  </h2>
                </div>
                <div className="p-4">
                  <div className="flex items-start">
                    <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Your payment information is secure
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        We use industry-standard encryption to protect your
                        payment data. Your card details are never stored on our
                        servers and are processed securely through our payment
                        provider.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "usage" && (
            <div className="space-y-6">
              {/* Storage Usage Card */}
              <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
                <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Storage Usage
                  </h2>
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center flex-shrink-0">
                      <Database className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">
                        {formatBytes(storageInfo.used || 0)} of{" "}
                        {formatBytes(storageInfo.total || 0)}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {Math.min(storageInfo.percentage || 0, 100).toFixed(1)}%
                        of your storage space used
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-3 bg-slate-200 dark:bg-[#343140] rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full ${
                        (storageInfo.percentage || 0) > 90
                          ? "bg-red-500"
                          : (storageInfo.percentage || 0) > 75
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(storageInfo.percentage || 0, 100)}%`,
                      }}
                    ></div>
                  </div>

                  {/* Storage Details */}
                  <div className="bg-slate-50 dark:bg-[#2c2934] rounded-lg p-4 mb-4">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      Storage Breakdown
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 dark:border-[#343140]/40">
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Base plan storage
                        </span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {formatBytes(storageInfo.base || 0)}
                        </span>
                      </div>

                      {/* Only show additional storage if it's greater than 0 */}
                      {storageInfo.additional > 0 && (
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 dark:border-[#343140]/40">
                          <span className="text-xs text-gray-600 dark:text-gray-300">
                            Additional storage
                          </span>
                          <span className="text-xs font-medium text-gray-900 dark:text-white">
                            {formatBytes(storageInfo.additional || 0)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 dark:border-[#343140]/40">
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Used storage
                        </span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {formatBytes(storageInfo.used || 0)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-slate-200/60 dark:border-[#343140]/40">
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          Available storage
                        </span>
                        <span className="text-xs font-medium text-gray-900 dark:text-white">
                          {formatBytes(
                            Math.max(
                              0,
                              (storageInfo.total || 0) -
                                (storageInfo.used || 0),
                            ),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isFreeUser && (
                    <button
                      onClick={handleOpenPlansModal}
                      className="w-full py-1.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                    >
                      Get more storage
                      <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                    </button>
                  )}
                </div>
              </section>

              {/* Storage Usage Tips - Only show on usage tab */}
              <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
                <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Storage Usage Tips
                  </h2>
                </div>
                <div className="p-4">
                  <div className="flex items-start">
                    <AlertTriangle className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        Optimize your storage
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        Here are a few tips to help you optimize your storage
                        usage:
                      </p>
                      <ul className="list-disc pl-5 text-xs text-gray-600 dark:text-gray-300 space-y-1">
                        <li>Delete unneeded files and empty trash regularly</li>
                        <li>Compress larger files before uploading</li>
                        <li>
                          Share files via links instead of duplicate copies
                        </li>
                        <li>
                          Consider upgrading your plan for more storage space
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {activeTab === "history" && !isFreeUser && (
            <div className="space-y-6">
              {/* Billing History Card */}
              <section className="bg-white dark:bg-[#1c1b23] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
                <div className="border-b border-slate-200/60 dark:border-[#343140]/60 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                    Billing History
                  </h2>
                </div>

                <div className="p-4">
                  <BillingHistorySection
                    availablePlans={availablePlans}
                    onPageChange={handleBillingHistoryPageChange}
                  />
                </div>
              </section>
            </div>
          )}

          {/* Static Need Help section - With proper spacing and padding */}
          <div className="flex-shrink-0 mt-6">
            <section className="bg-slate-50 dark:bg-[#2c2934] rounded-xl border border-slate-200/60 dark:border-[#343140]/60 overflow-hidden shadow-sm">
              <div className="p-4 sm:p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                  Need Help?
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
                  If you have any questions about your billing or subscription,
                  our support team is here to help.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <a
                    href="https://cirrussync.com/contact"
                    className="block py-2 px-3 bg-white dark:bg-[#1c1b23] border border-slate-200 dark:border-[#343140] rounded-lg hover:bg-slate-100 dark:hover:bg-[#343140] transition-colors text-center text-sm text-gray-800 dark:text-gray-200 font-medium cursor-pointer"
                  >
                    Contact Support
                  </a>
                  <a
                    href="https://cirrussync.com/billing/faqs"
                    className="block py-2 px-3 bg-white dark:bg-[#1c1b23] border border-slate-200 dark:border-[#343140] rounded-lg hover:bg-slate-100 dark:hover:bg-[#343140] transition-colors text-center text-sm text-gray-800 dark:text-gray-200 font-medium cursor-pointer"
                  >
                    Billing FAQ
                  </a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Plans Modal */}
      {showPlansModal && (
        <PlansModal
          isOpen={showPlansModal}
          onClose={handleClosePlansModal}
          subscription={subscription}
          setSubscription={setSubscription}
          availablePlans={availablePlans}
          setToastMessage={setToastMessage}
          setShowToast={setShowToast}
        />
      )}

      {updateCardModalOpen && (
        <CardUpdateModal
          isOpen={updateCardModalOpen}
          onClose={() => setUpdateCardModalOpen(false)}
          currentPaymentMethod={paymentMethod}
          onSuccess={(paymentMethod: PaymentMethod | null) => {
            setPaymentMethod(paymentMethod);
          }}
          setToastMessage={setToastMessage}
          setShowToast={setShowToast}
        />
      )}
    </div>
  );
};

export default BillingSection;
