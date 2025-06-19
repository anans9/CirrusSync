import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
  useRef,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Check,
  CreditCard,
  Users,
  Briefcase,
  Cloud,
  Zap,
  Shield,
  Lock,
  AlertCircle,
  AlertTriangle,
  Gift,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useTheme } from "../context/ThemeContext";
import { ApiService } from "../services/ApiService";
import { format } from "date-fns";
import { confirm } from "@tauri-apps/plugin-dialog";
import { useServerChallenge } from "../hooks/useServerChallenge";

// For Tauri-specific dialog
const showTauriDialog = async (message: string): Promise<boolean> => {
  try {
    // Use Tauri dialog API if available
    const confirmed = await confirm(message, {
      title: "Confirmation Required",
      kind: "warning",
    });
    return confirmed;
  } catch (error) {
    // If Tauri imports fail, fallback to window.confirm
    console.error("Failed to use Tauri dialog:", error);
    return window.confirm(message);
  }
};

// Animation variants for better performance
const modalBackdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalContentVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      damping: 25,
      stiffness: 300,
    },
  },
  exit: {
    opacity: 0,
    y: 20,
    scale: 0.98,
    transition: { duration: 0.2 },
  },
};

const cardVariants = {
  initial: { scale: 1 },
  selected: {
    scale: 1.02,
    transition: { type: "spring", stiffness: 400, damping: 15 },
  },
  hover: { scale: 1.03, transition: { duration: 0.2 } },
};

// Plan types with specific features
const planTypes = [
  {
    id: "individual",
    name: "Individual",
    description: "Perfect for personal use",
    icon: CreditCard,
  },
  {
    id: "family",
    name: "Family",
    description: "Share with up to 6 family members",
    icon: Users,
  },
  {
    id: "business",
    name: "Business",
    description: "For businesses and teams",
    icon: Briefcase,
  },
];

// Convert between plan types (professional <-> business)
const normalizePlanType = (planType: string | undefined): string => {
  if (planType === "professional") return "business";
  return planType || "individual";
};

export const PlansModal: React.FC<PlanModalProps> = ({
  isOpen,
  onClose,
  subscription,
  setSubscription,
  setToastMessage,
  setShowToast,
  availablePlans: initialPlans,
}) => {
  // Refs for DOM elements and preventing double updates
  const modalContentRef = useRef<HTMLDivElement>(null);
  const planChangeProcessedRef = useRef(false);
  const isMountedRef = useRef(true);
  const hasModalClosedAfterSuccessRef = useRef(true);

  // Auth and payment contexts
  const { user, setUser } = useAuth();
  const stripe = useStripe();
  const elements = useElements();
  const theme = useTheme();

  // Internal view state
  const [currentView, setCurrentView] = useState<
    "plans" | "payment" | "confirmation" | "retention" | "success"
  >("plans");

  // Processing and loading states (separate by concern)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isLoadingPaymentMethod, setIsLoadingPaymentMethod] = useState(false);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);

  // Plan and payment state
  const [selectedPlanType, setSelectedPlanType] =
    useState<string>("individual");
  const [selectedSyncPlan, setSelectedSyncPlan] = useState<string>("free");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [useNewCard, setUseNewCard] = useState<boolean>(false);
  const [cardComplete, setCardComplete] = useState<boolean>(false);
  const [availablePlans, setAvailablePlans] = useState<FeaturedPlans>({
    individual: [],
    family: null,
    business: null,
  });

  // Updated plan data after successful change
  const [updatedPlanData, setUpdatedPlanData] = useState<Subscription | null>(
    null,
  );

  // Date for scheduled downgrades
  const [downgradeEffectiveDate, setDowngradeEffectiveDate] =
    useState<Date | null>(null);

  // Get server challenge hooks
  const { processChallenge, clearError } = useServerChallenge();

  // Load available plans if not provided
  const loadAvailablePlans = useCallback(async () => {
    if (initialPlans) {
      setAvailablePlans(initialPlans);
      return;
    }

    try {
      setIsLoadingPlans(true);
      const response = await ApiService.getAvailablePlans();
      if (response.code === 1000 && response.plans) {
        if (isMountedRef.current) {
          setAvailablePlans(response.plans);
        }
      }
    } catch (error) {
      console.error("Error loading plans:", error);
      setToastMessage({
        type: "error",
        text: "Unable to load plans. Please try again.",
      });
      setShowToast(true);
    } finally {
      if (isMountedRef.current) {
        setIsLoadingPlans(false);
      }
    }
  }, [initialPlans, setToastMessage, setShowToast]);

  // Load payment method
  const loadPaymentMethod = useCallback(async () => {
    try {
      setIsLoadingPaymentMethod(true);
      const response = await ApiService.getPaymentMethod();
      if (response.code === 1000 && isMountedRef.current) {
        setPaymentMethod(response.payment_method);
        setUseNewCard(!response.payment_method);
      }
    } catch (error) {
      console.error("Error loading payment method:", error);
      if (isMountedRef.current) {
        setToastMessage({
          type: "error",
          text: "Unable to load payment method. Please try again.",
        });
        setShowToast(true);
        setUseNewCard(true);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingPaymentMethod(false);
      }
    }
  }, [setToastMessage, setShowToast]);

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset refs
      planChangeProcessedRef.current = false;
      isMountedRef.current = true;
      hasModalClosedAfterSuccessRef.current = true;

      // Set default plan type and selection based on user's current plan
      const normalizedPlanType = normalizePlanType(subscription?.plan_type);
      setSelectedPlanType(normalizedPlanType);
      setSelectedSyncPlan(subscription?.plan_id || "free");
      setBillingCycle(
        subscription?.billing_cycle === "yearly" ? "yearly" : "monthly",
      );

      // Reset view state
      setCurrentView("plans");
      setUseNewCard(false);
      setCardComplete(false);
      setDowngradeEffectiveDate(null);
      setUpdatedPlanData(null);

      // Calculate effective downgrade date if current plan has an end date
      if (subscription?.current_period_end) {
        setDowngradeEffectiveDate(
          new Date(subscription.current_period_end * 1000),
        );
      }

      // Load initial data in parallel
      loadAvailablePlans();
      loadPaymentMethod();
    }

    // Cleanup function to prevent updates after unmount
    return () => {
      isMountedRef.current = false;
    };
  }, [isOpen, subscription, loadAvailablePlans, loadPaymentMethod]);

  // Handle clicks outside the modal
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        modalContentRef.current &&
        !modalContentRef.current.contains(e.target as Node) &&
        !["payment", "confirmation", "retention", "success"].includes(
          currentView,
        ) && // Don't close when on critical screens
        !isProcessingPayment // Don't close during payment processing
      ) {
        handleClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        currentView === "plans" &&
        !isProcessingPayment
      ) {
        handleClose();
      }
    };

    // Lock body scroll
    document.body.style.overflow = "hidden";
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, currentView, isProcessingPayment]);

  // Safe close handler that prevents auto-reopening after success
  const handleClose = useCallback(() => {
    if (currentView === "payment" && !paymentMethod && !isProcessingPayment) {
      // Confirm before closing during payment with Tauri dialog
      showTauriDialog("Are you sure you want to cancel this payment?").then(
        (confirmed) => {
          if (confirmed) {
            // Reset refs to prevent further updates
            planChangeProcessedRef.current = false;

            // Apply updated plan data to parent component if available
            if (updatedPlanData) {
              setSubscription(updatedPlanData);
            }

            onClose();
          }
        },
      );
      return;
    }

    // Don't close modal if we're in success view and haven't completed the operation
    if (currentView === "success" && !hasModalClosedAfterSuccessRef.current) {
      hasModalClosedAfterSuccessRef.current = true;
    }

    // Reset refs to prevent further updates
    planChangeProcessedRef.current = false;

    // Apply updated plan data to parent component if available
    if (updatedPlanData) {
      setSubscription(updatedPlanData);
    }

    onClose();
  }, [
    onClose,
    currentView,
    paymentMethod,
    updatedPlanData,
    setSubscription,
    isProcessingPayment,
  ]);

  // Get plans for the selected type
  const getPlansForSelectedType = useCallback(
    (planType: string) => {
      if (isLoadingPlans) return [];

      switch (planType) {
        case "individual":
          return availablePlans.individual.filter(
            (plan: PlanFeature) => plan.available,
          );
        case "family":
          return availablePlans.family ? [availablePlans.family] : [];
        case "business":
          return availablePlans.business ? [availablePlans.business] : [];
        default:
          return availablePlans.individual.filter(
            (plan: PlanFeature) => plan.available,
          );
      }
    },
    [availablePlans, isLoadingPlans],
  );

  // Handle plan type change
  const handlePlanTypeChange = useCallback(
    (type: string) => {
      setSelectedPlanType(type);

      // Auto-select the plan if there's only one option (family or business)
      const plans = getPlansForSelectedType(type);
      if (plans.length === 1) {
        setSelectedSyncPlan(plans[0].id);
      } else if (
        subscription &&
        normalizePlanType(subscription.plan_type) === type
      ) {
        // If switching back to the user's current plan type, select their current plan
        setSelectedSyncPlan(subscription.plan_id);
      } else {
        // Default to a middle-tier for individual plans if not current type
        setSelectedSyncPlan(
          type === "individual" ? "plus" : plans[0]?.id || "free",
        );
      }
    },
    [getPlansForSelectedType, subscription],
  );

  // Handle Stripe card element changes
  const handleCardElementChange = (event: {
    complete: boolean;
    error?: {
      message: string;
      type?: string;
      code?: string;
    };
    empty?: boolean;
    value?: object;
  }) => {
    setCardComplete(event.complete);
    if (event.error) {
      setToastMessage({
        type: "error",
        text: event.error.message,
      });
      setShowToast(true);
    }
  };

  // Submit payment handler
  const handleSubmitPayment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setToastMessage({
        type: "error",
        text: "Stripe hasn't loaded yet. Please try again.",
      });
      setShowToast(true);
      return;
    }

    setIsProcessingPayment(true);

    try {
      // If using an existing payment method
      if (paymentMethod && !useNewCard) {
        await processSubscriptionWithExistingPaymentMethod();
        return;
      }

      // Otherwise use new card
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error("Card element not found");
      }

      // Create payment method
      const { error, paymentMethod: newPaymentMethod } =
        await stripe.createPaymentMethod({
          type: "card",
          card: cardElement,
        });

      if (error) {
        throw new Error(error.message);
      }

      if (!newPaymentMethod || !newPaymentMethod.id) {
        throw new Error("Failed to create payment method");
      }

      // Add the payment method to the account
      const addMethodResponse = await ApiService.addPaymentMethod({
        token: newPaymentMethod.id,
        billing_name: undefined,
        billing_address: undefined,
        billing_country: undefined,
        billing_postal_code: undefined,
      });

      if (addMethodResponse.code !== 1000) {
        throw new Error("Failed to add payment method");
      }

      // Create subscription with the new payment method
      await processSubscriptionWithNewPaymentMethod(
        addMethodResponse.payment_method.id,
      );
    } catch (err) {
      console.error("Payment error:", err);
      setToastMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Payment processing failed",
      });
      setShowToast(true);
    } finally {
      if (isMountedRef.current) {
        setIsProcessingPayment(false);
      }
    }
  };

  // Process subscription with existing payment method
  const processSubscriptionWithExistingPaymentMethod = async () => {
    try {
      if (!paymentMethod) {
        throw new Error("No payment method found");
      }

      const subscriptionData = {
        plan_id: selectedSyncPlan,
        plan_type: selectedPlanType,
        billing_cycle: billingCycle,
        payment_method_id: paymentMethod.id,
        auto_renew: true,
      };

      const response = await ApiService.createSubscription(subscriptionData);
      console.log("Subscription response:", response);

      // Success - standard success code
      if (response.code === 1000) {
        handleSuccessfulSubscription(response);
        return;
      }

      // Requires confirmation (code 4021 or payment_status check)
      if (
        (response.code === 4021 ||
          response.payment_status === "requires_confirmation") &&
        response.client_secret
      ) {
        console.log("Payment requires confirmation, confirming with secret");
        await confirmPaymentWithStripe(
          response.client_secret,
          response.subscription_id,
        );
        return;
      }

      // Other action required with client_secret
      if (response.client_secret) {
        console.log("Payment has client_secret, confirming payment");
        await confirmPaymentWithStripe(
          response.client_secret,
          response.subscription_id,
        );
        return;
      }

      // Error without client_secret
      throw new Error(response.detail || "Subscription failed");
    } catch (error) {
      console.error("Subscription error:", error);
      throw error; // Rethrow to be handled by caller
    }
  };

  // Process subscription with new payment method
  const processSubscriptionWithNewPaymentMethod = async (
    paymentMethodId: string,
  ) => {
    try {
      const subscriptionData = {
        plan_id: selectedSyncPlan,
        plan_type: selectedPlanType,
        billing_cycle: billingCycle,
        payment_method_id: paymentMethodId,
        auto_renew: true,
      };

      const response = await ApiService.createSubscription(subscriptionData);
      console.log("Subscription response with new method:", response);

      // Success - standard success code
      if (response.code === 1000) {
        handleSuccessfulSubscription(response);
        return;
      }

      // Requires confirmation
      if (
        (response.code === 4021 ||
          response.payment_status === "requires_confirmation") &&
        response.client_secret
      ) {
        console.log("Payment requires confirmation, confirming with secret");
        await confirmPaymentWithStripe(
          response.client_secret,
          response.subscription_id,
        );
        return;
      }

      // Other action required with client_secret
      if (response.client_secret) {
        console.log("Payment has client_secret, confirming payment");
        await confirmPaymentWithStripe(
          response.client_secret,
          response.subscription_id,
        );
        return;
      }

      // Error without client_secret
      throw new Error(response.detail || "Subscription failed");
    } catch (error) {
      console.error("Subscription error:", error);
      throw error; // Rethrow to be handled by caller
    }
  };

  // Confirm payment with Stripe
  const confirmPaymentWithStripe = async (
    clientSecret: string,
    subscriptionId?: string,
  ) => {
    if (!stripe) {
      throw new Error("Stripe not loaded");
    }

    console.log(`Confirming payment with client_secret`);

    try {
      // Attempt to confirm the card payment
      const { error, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret);

      // Handle confirmation error
      if (error) {
        console.error("Error confirming payment:", error);
        throw new Error(error.message || "Payment confirmation failed");
      }

      // Check if payment succeeded
      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        throw new Error(
          `Payment not successful. Status: ${
            paymentIntent?.status || "unknown"
          }`,
        );
      }

      console.log("Payment confirmation successful");

      // If we have a subscription_id, confirm the subscription with the backend
      if (subscriptionId) {
        try {
          console.log("Confirming subscription with backend");

          // Call the backend to confirm the subscription
          const confirmResponse = await ApiService.confirmSubscription({
            subscription_id: subscriptionId,
            payment_intent_id: paymentIntent.id,
          });

          if (confirmResponse.code === 1000) {
            console.log("Subscription confirmed successfully");

            // Fetch updated subscription details
            const subscriptionResponse =
              await ApiService.getSubscriptionStatus();

            if (
              subscriptionResponse.code === 1000 &&
              subscriptionResponse.subscription
            ) {
              console.log("Updated subscription received");

              // Update the plan data
              setSubscription(subscriptionResponse.subscription);
              setUpdatedPlanData(subscriptionResponse.subscription);

              // Update user storage quota if needed
              if (user && subscriptionResponse.subscription.storage) {
                const totalStorage =
                  subscriptionResponse.subscription.storage.total;
                console.log("Updating user storage quota to:", totalStorage);

                setUser({
                  ...user,
                  max_drive_space: totalStorage,
                });
              }
            }
          } else {
            console.warn(
              "Subscription confirmation returned non-success code:",
              confirmResponse,
            );
          }
        } catch (error) {
          console.error("Error confirming subscription after payment:", error);
          // Continue anyway since payment succeeded
        }
      }

      // Show success view
      if (isMountedRef.current) {
        hasModalClosedAfterSuccessRef.current = false;
        setCurrentView("success");
      }

      // Show success toast
      setToastMessage({
        type: "success",
        text: `Successfully ${getPlanChangeType()} to ${getSelectedPlanName()}!`,
      });
      setShowToast(true);
    } catch (error) {
      console.error("Payment confirmation error:", error);
      throw error; // Rethrow to be handled by caller
    }
  };

  // Handle successful subscription
  const handleSuccessfulSubscription = (response: SubscriptionsResponse) => {
    // Check if we've already processed this plan change
    if (planChangeProcessedRef.current) {
      return;
    }

    console.log("Handling successful subscription");

    // Mark as processed
    planChangeProcessedRef.current = true;

    // Use the subscription data from the response
    const newPlanData = response.subscription;
    setUpdatedPlanData(newPlanData);

    // Update max_drive_space in user object
    if (user) {
      let newStorage = newPlanData.storage?.total;

      // If the storage info isn't in the response, calculate it from plan details
      if (!newStorage) {
        // Find the selected plan to get storage quota
        let storageBytes = 3 * 1024 * 1024 * 1024; // 3GB default for free plan

        const selectedPlans = getPlansForSelectedType(selectedPlanType);
        const plan = selectedPlans.find(
          (p: PlanFeature) => p.id === selectedSyncPlan,
        );

        if (plan) {
          storageBytes = plan.storage || storageBytes;
        }

        newStorage = storageBytes;
      }

      console.log("Updating user storage to:", newStorage);

      // Update user object with new max_drive_space
      setUser({
        ...user,
        max_drive_space: newStorage,
      });
    }

    // Show success view
    if (isMountedRef.current) {
      hasModalClosedAfterSuccessRef.current = false;
      setCurrentView("success");
    }

    // Show success toast
    setToastMessage({
      type: "success",
      text: `Successfully ${getPlanChangeType()} to ${getSelectedPlanName()}!`,
    });
    setShowToast(true);
  };

  const getCurrentPlanPrice = () => {
    if (!subscription) return 0;

    // Find the user's current plan
    let currentPlanPrice = 0;

    if (subscription.plan_type === "family" && availablePlans.family) {
      // Family plan price
      currentPlanPrice =
        subscription.billing_cycle === "yearly"
          ? availablePlans.family.price.yearly
          : availablePlans.family.price.monthly;
    } else if (
      (subscription.plan_type === "business" ||
        subscription.plan_type === "professional") &&
      availablePlans.business
    ) {
      // Business plan price
      currentPlanPrice =
        subscription.billing_cycle === "yearly"
          ? availablePlans.business.price.yearly
          : availablePlans.business.price.monthly;
    } else {
      // Individual plan price
      const plan = availablePlans.individual.find(
        (p: PlanFeature) => p.id === subscription.plan_id,
      );

      if (plan) {
        currentPlanPrice =
          subscription.billing_cycle === "yearly"
            ? plan.price.yearly
            : plan.price.monthly;
      }
    }

    return currentPlanPrice;
  };

  // Handle retention offer for free plan downgrade
  const handleRetentionOffer = async () => {
    try {
      if (planChangeProcessedRef.current) {
        return;
      }

      setIsProcessingPayment(true);
      clearError();

      const currentPrice = getCurrentPlanPrice();
      const discountedPrice = Math.round((currentPrice / 2) * 100) / 100;

      // Step 1: Initiate credit request and get challenge
      const creditChallengeResponse = await ApiService.initCredit(
        discountedPrice,
        "Plan downgrade loyalty credit",
        "retention",
      );

      // Make sure we got a valid challenge
      if (creditChallengeResponse.code !== 2004) {
        // CHALLENGE_ISSUED code
        throw new Error(
          creditChallengeResponse.detail || "Failed to get challenge",
        );
      }

      // Step 2: Process the challenge and calculate solution
      const { challenge_id, solution } = await processChallenge({
        challenge_id: creditChallengeResponse.challenge_id,
        challenge_string: creditChallengeResponse.challenge_string,
        expires_in: creditChallengeResponse.expires_in,
      });

      // Step 3: Submit solution to verify and apply the credit
      const creditResponse = await ApiService.commitCredit(
        challenge_id,
        solution,
      );

      // Ensure credit was applied successfully
      if (creditResponse.code !== 1000) {
        // SUCCESS code
        throw new Error(
          creditResponse.detail ||
            "Unable to apply credits. Please contact support if the issue persists.",
        );
      }

      // Mark as processed to prevent duplicate offers
      planChangeProcessedRef.current = true;

      // Update user's credit in local state
      setUser((prev: User | null) => {
        if (!prev) return null;
        return {
          ...prev,
          credit: (prev.credit || 0) + discountedPrice,
        };
      });

      // Show success message
      setToastMessage({
        type: "success",
        text: `We've successfully added ${discountedPrice} to your account!${" "}
        Credits will be applied to your next billing cycle.${" "}
        Enjoy your premium features!`,
      });
      setShowToast(true);

      // Close the modal
      if (isMountedRef.current) {
        onClose();
      }
    } catch (error) {
      console.error("Retention offer error:", error);
      setToastMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to apply offer",
      });
      setShowToast(true);
    } finally {
      // Reset processing state
      if (isMountedRef.current) {
        setIsProcessingPayment(false);
      }
    }
  };

  // Handle downgrade to free plan
  const handleDowngradeToFree = async () => {
    try {
      // Check if already processed
      if (planChangeProcessedRef.current) {
        return;
      }

      setIsProcessingPayment(true);

      const subscriptionData = {
        plan_id: "free",
        plan_type: "individual",
        billing_cycle: "monthly",
        auto_renew: false,
      };

      const response = await ApiService.createSubscription(subscriptionData);

      if (response.code === 1000) {
        // Mark as processed
        planChangeProcessedRef.current = true;

        // Get the downgrade effective date from the response
        if (response.subscription?.current_period_end) {
          setDowngradeEffectiveDate(
            new Date(response.subscription.current_period_end * 1000),
          );
        }

        // Store updated plan data
        setUpdatedPlanData(response.subscription);

        // Show success view for downgrade
        if (isMountedRef.current) {
          hasModalClosedAfterSuccessRef.current = false;
          setCurrentView("success");
        }

        setToastMessage({
          type: "success",
          text:
            "Subscription canceled. You will have access until the end of your current billing period on " +
            format(
              new Date(response.subscription.current_period_end * 1000),
              "MMMM d, yyyy",
            ),
        });
        setShowToast(true);
      } else {
        throw new Error(response.detail || "Downgrade failed");
      }
    } catch (error) {
      console.error("Downgrade error:", error);
      setToastMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Downgrade failed",
      });
      setShowToast(true);
    } finally {
      if (isMountedRef.current) {
        setIsProcessingPayment(false);
      }
    }
  };

  // Calculate yearly savings
  const getYearlySavings = useCallback((plan: PlanFeature) => {
    const monthlyCost = plan.price.monthly * 12;
    const yearlyCost = plan.price.yearly;
    const savings = monthlyCost - yearlyCost;
    const savingsPercentage = Math.round((savings / monthlyCost) * 100);

    return savingsPercentage > 0 ? savingsPercentage : 0;
  }, []);

  // Get the current selected plan's name
  const getSelectedPlanName = useCallback(() => {
    if (selectedPlanType === "family" && availablePlans.family) {
      return availablePlans.family.name;
    }
    if (selectedPlanType === "business" && availablePlans.business) {
      return availablePlans.business.name;
    }

    const plan = availablePlans.individual.find(
      (p: PlanFeature) => p.id === selectedSyncPlan,
    );
    return plan ? plan.name : "CirrusSync";
  }, [selectedPlanType, selectedSyncPlan, availablePlans]);

  // Current user plan tier
  const userPlanTier = useMemo(() => {
    if (!subscription) return 1;

    if (subscription.plan_type === "family") return 3;
    if (subscription.plan_type === "business") return 4;

    // Find plan in available plans
    const plan = availablePlans.individual.find(
      (p: PlanFeature) => p.id === subscription.plan_id,
    );
    return plan ? plan.tier : 1;
  }, [subscription, availablePlans]);

  // Check if it's just a billing cycle change for the same plan
  const isSamePlanDifferentCycle = useMemo(() => {
    if (!subscription) return false;

    const isSamePlan =
      subscription.plan_id === selectedSyncPlan &&
      normalizePlanType(subscription.plan_type) === selectedPlanType;

    const isDifferentCycle =
      (subscription.billing_cycle === "yearly" && billingCycle === "monthly") ||
      (subscription.billing_cycle !== "yearly" && billingCycle === "yearly");

    return isSamePlan && isDifferentCycle;
  }, [subscription, selectedSyncPlan, selectedPlanType, billingCycle]);

  // Check if current plan already has same billing cycle
  const isSamePlanSameCycle = useMemo(() => {
    if (!subscription) return false;

    return (
      subscription.plan_id === selectedSyncPlan &&
      normalizePlanType(subscription.plan_type) === selectedPlanType &&
      ((subscription.billing_cycle === "yearly" && billingCycle === "yearly") ||
        (subscription.billing_cycle !== "yearly" && billingCycle === "monthly"))
    );
  }, [subscription, selectedSyncPlan, selectedPlanType, billingCycle]);

  // Get the selected plan
  const selectedPlan = useMemo(() => {
    if (selectedPlanType === "family") return availablePlans.family;
    if (selectedPlanType === "business") return availablePlans.business;

    return (
      availablePlans.individual.find(
        (p: PlanFeature) => p.id === selectedSyncPlan,
      ) ||
      (availablePlans.individual.length > 0
        ? availablePlans.individual[0]
        : null)
    );
  }, [selectedSyncPlan, selectedPlanType, availablePlans]);

  // Get detailed plan change type
  const getPlanChangeType = useCallback(() => {
    if (!subscription) return "changed";

    // Same plan, different billing cycle
    if (
      subscription.plan_id === selectedSyncPlan &&
      normalizePlanType(subscription.plan_type) === selectedPlanType
    ) {
      return billingCycle === "yearly"
        ? "upgraded to yearly billing"
        : "switched to monthly billing";
    }

    // Different plan type
    if (normalizePlanType(subscription.plan_type) !== selectedPlanType) {
      if (selectedPlanType === "family") return "switched to Family plan";
      if (selectedPlanType === "business") return "switched to Business plan";
      return "switched to Individual plan";
    }

    // Different tier within individual plans
    const selectedTier = userPlanTier;

    // Find selected plan tier
    const selectedPlans = getPlansForSelectedType(selectedPlanType);
    const plan = selectedPlans.find(
      (p: PlanFeature) => p.id === selectedSyncPlan,
    );
    const planTier = plan?.tier || 1;

    if (planTier > selectedTier) return "upgraded";
    if (planTier < selectedTier) return "downgraded";

    return "changed";
  }, [
    subscription,
    selectedSyncPlan,
    selectedPlanType,
    billingCycle,
    userPlanTier,
    getPlansForSelectedType,
  ]);

  // Check if the current plan is premium (not free) - previously unused function
  const isCurrentPlanPremium = useMemo(() => {
    if (!subscription) return false;
    return subscription.plan_id !== "free";
  }, [subscription]);

  // Check if plan is available
  const isPlanAvailable = useMemo(() => {
    if (!selectedPlan) return false;
    return selectedPlan.available;
  }, [selectedPlan]);

  // Get price for the selected plan
  const price = useMemo(() => {
    if (!selectedPlan) return 0;
    return billingCycle === "monthly"
      ? selectedPlan.price.monthly
      : selectedPlan.price.yearly;
  }, [selectedPlan, billingCycle]);

  // Get action button text
  const getActionButtonText = useCallback(() => {
    if (!subscription) return "Select Plan";

    // Plan not available
    if (!isPlanAvailable) return "Not Available";

    // Check if this is the free plan and user is already on free plan
    if (subscription.plan_id === "free" && selectedSyncPlan === "free") {
      return "Current Plan";
    }

    // Check if we're just changing billing cycle for the same plan and type
    if (isSamePlanSameCycle) {
      return "Current Plan";
    }

    if (isSamePlanDifferentCycle) {
      // Changing monthly to yearly is an upgrade
      if (billingCycle === "yearly") {
        return "Upgrade to Yearly";
      }
      // Changing yearly to monthly
      return "Switch to Monthly";
    }

    // For different plans
    if (selectedPlanType === "family") return "Switch to Family Plan";
    if (selectedPlanType === "business") return "Switch to Business Plan";

    // Find selected plan tier
    const selectedPlans = getPlansForSelectedType(selectedPlanType);
    const plan = selectedPlans.find(
      (p: PlanFeature) => p.id === selectedSyncPlan,
    );
    const selectedTier = plan?.tier || 1;

    if (selectedTier > userPlanTier) return "Upgrade Plan";
    if (selectedTier < userPlanTier) return "Downgrade Plan";
    return "Change Plan";
  }, [
    subscription,
    isPlanAvailable,
    selectedSyncPlan,
    isSamePlanSameCycle,
    isSamePlanDifferentCycle,
    selectedPlanType,
    billingCycle,
    userPlanTier,
    getPlansForSelectedType,
  ]);

  // Check if button should be disabled (current plan)
  const isActionButtonDisabled = useMemo(() => {
    if (!subscription) return false;

    // If user is on free plan and trying to select free plan, disable button
    if (subscription.plan_id === "free" && selectedSyncPlan === "free") {
      return true;
    }

    // Otherwise use existing logic for other plans
    return isSamePlanSameCycle || !isPlanAvailable;
  }, [subscription, selectedSyncPlan, isSamePlanSameCycle, isPlanAvailable]);

  // Handle plan change
  const handlePlanChange = useCallback(() => {
    // No changes made - same plan, same type, same billing cycle
    if (isSamePlanSameCycle) {
      return;
    }

    // Special case: downgrading to free plan - first show retention offer
    if (
      selectedSyncPlan === "free" &&
      subscription &&
      subscription.plan_id !== "free" &&
      isCurrentPlanPremium // Use the previously unused function
    ) {
      if (user?.retention_flag.eligible) {
        setCurrentView("retention");
      } else {
        setCurrentView("confirmation");
      }
      return;
    }

    // Special case: downgrading to free plan - if we're already past retention, show confirmation
    if (selectedSyncPlan === "free") {
      setCurrentView("confirmation");
      return;
    }

    // Move to payment view for all other cases
    setCurrentView("payment");
  }, [
    selectedSyncPlan,
    isSamePlanSameCycle,
    subscription,
    isCurrentPlanPremium,
  ]);

  // Back to plan selection
  const handleBackToPlan = useCallback(() => {
    setCurrentView("plans");
    setUseNewCard(!!paymentMethod);
    setCardComplete(false);

    // Clear Stripe fields if they exist
    const cardElement = elements?.getElement(CardElement);
    if (cardElement) {
      cardElement.clear();
    }
  }, [elements, paymentMethod]);

  // Back to previous view based on context - Fix: now being used properly
  const handleBackToPreviousView = useCallback(() => {
    if (currentView === "confirmation" || currentView === "retention") {
      setCurrentView("plans");
    } else if (currentView === "payment") {
      setCurrentView("plans");
    }
  }, [currentView]);

  // Skeleton components
  const PlanTypeSkeleton = () => (
    <div className="mb-8 animate-pulse">
      <div className="h-6 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-40 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-slate-200/60 dark:bg-[#343140]/60 rounded-xl"
          ></div>
        ))}
      </div>
    </div>
  );

  const PlansSkeleton = () => (
    <div className="animate-pulse">
      <div className="h-6 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-40 mb-4"></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-64 bg-slate-200/60 dark:bg-[#343140]/60 rounded-xl"
          ></div>
        ))}
      </div>
    </div>
  );

  const PaymentSkeleton = () => (
    <div className="overflow-y-auto px-6 py-6 animate-pulse">
      <div className="mb-6">
        <div className="h-6 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-40 mb-2"></div>
        <div className="h-4 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-64 mt-2"></div>
      </div>

      {/* Payment Method Skeleton */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <div className="h-5 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-32"></div>
          <div className="h-4 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-24"></div>
        </div>
        <div className="p-3 border border-slate-200/60 dark:border-[#343140]/60 rounded-lg h-16"></div>
      </div>

      {/* Card Element Skeleton */}
      <div className="mb-6">
        <div className="h-5 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-28 mb-3"></div>
        <div className="border border-slate-200/60 dark:border-[#343140]/60 rounded-lg h-12"></div>
      </div>

      {/* Security Message Skeleton */}
      <div className="mb-6 p-3 border border-slate-200/60 dark:border-[#343140]/60 rounded-lg">
        <div className="flex items-start gap-3">
          <div className="h-5 w-5 bg-slate-200/60 dark:bg-[#343140]/60 rounded-full flex-shrink-0"></div>
          <div className="w-full">
            <div className="h-4 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-40 mb-2"></div>
            <div className="h-3 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-full"></div>
            <div className="h-3 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-3/4 mt-1"></div>
          </div>
        </div>
      </div>

      {/* Action Buttons Skeleton */}
      <div className="flex justify-between mt-6">
        <div className="h-10 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-28"></div>
        <div className="h-10 bg-slate-200/60 dark:bg-[#343140]/60 rounded w-36"></div>
      </div>
    </div>
  );

  // View Components
  const RetentionView = () => {
    // Calculate the current plan's price - not the selected plan
    const currentPrice = getCurrentPlanPrice();
    const discountedPrice = currentPrice / 2;
    const currentCycle = subscription?.billing_cycle || "monthly";

    return (
      <div className="mt-4 py-8 px-6 flex flex-col items-center justify-center max-h-[calc(100vh-14rem)] overflow-y-auto">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, stiffness: 100 }}
          className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6"
        >
          <Gift className="h-8 w-8 text-emerald-500" />
        </motion.div>

        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
          Wait! We Value Your Membership
        </h3>

        <div className="mb-6 max-w-md text-center">
          <p className="text-base text-gray-600 dark:text-gray-300 mb-4">
            Before you downgrade to the free plan, we'd like to offer you a{" "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              special 50% discount
            </span>{" "}
            on your current {subscription?.plan_id} plan.
          </p>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/30 rounded-lg p-4 mb-4">
            <p className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
              Continue enjoying all premium features at half the price:
            </p>
            <div className="mt-4 mb-3 flex justify-center items-center">
              <span className="line-through text-lg text-gray-400">
                ${currentPrice.toFixed(2)}
              </span>
              <span className="ml-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                ${discountedPrice.toFixed(2)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 mb-1">
                /{currentCycle === "yearly" ? "yr" : "mo"}
              </span>
            </div>
            <ul className="mt-2 space-y-1 text-sm text-emerald-700 dark:text-emerald-300">
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Additional storage space</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Advanced security features</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Priority customer support</span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-300 italic">
              Discount applied for the next billing cycle
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentView("confirmation")} // Direct to confirmation, not back to plans
            className="px-6 py-2.5 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] text-slate-600 dark:text-slate-300 font-medium rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            No Thanks
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleRetentionOffer}
            disabled={isProcessingPayment}
            className={`px-6 py-2.5 ${
              isProcessingPayment
                ? "bg-emerald-400 opacity-80"
                : "bg-emerald-500 hover:bg-emerald-600"
            } text-white font-medium rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center cursor-pointer`}
          >
            {isProcessingPayment ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                Processing...
              </>
            ) : (
              "Accept Half-Price Offer"
            )}
          </motion.button>
        </div>
      </div>
    );
  };

  // Improved Free Downgrade View with clearer information - now responsive
  const FreeDowngradeView = () => {
    const formattedDate = downgradeEffectiveDate
      ? format(downgradeEffectiveDate, "MMMM d, yyyy")
      : "the end of your billing period";

    return (
      <div className="mt-4 py-8 px-6 flex flex-col items-center justify-center max-h-[calc(100vh-14rem)] overflow-y-auto">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, stiffness: 100 }}
          className="w-16 h-16 bg-amber-100 dark:bg-amber-800/40 rounded-full flex items-center justify-center mb-6"
        >
          <AlertTriangle className="h-8 w-8 text-amber-500" />
        </motion.div>

        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
          Downgrade to Free Plan?
        </h3>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/30 rounded-lg p-4 mb-6 w-full max-w-md">
          <p className="text-sm text-amber-800 dark:text-amber-200 mb-3 font-medium">
            Your plan will be downgraded on {formattedDate}. Here's what you'll
            lose:
          </p>
          <ul className="space-y-3">
            <li className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Storage will be reduced from{" "}
                <span className="font-medium">
                  {formatStorage(user?.max_drive_space || 0)}
                </span>{" "}
                to <span className="font-medium">3GB</span>
              </span>
            </li>
            <li className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Files exceeding the 3GB limit may become inaccessible</span>
            </li>
            <li className="text-sm text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Premium features like advanced security, priority support, and
                advanced sharing will be removed
              </span>
            </li>
          </ul>

          <div className="mt-3 p-3 bg-white dark:bg-[#2c2934]/70 rounded border border-amber-100 dark:border-amber-800/30">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <span className="font-medium">Note:</span> You'll have 60 days to
              resubscribe and restore all your data if you change your mind.
              After that, the system may delete older files to stay within the
              3GB limit.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBackToPlan}
            className="px-6 py-2.5 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] text-slate-600 dark:text-slate-300 font-medium rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
          >
            Keep Current Plan
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDowngradeToFree}
            disabled={isProcessingPayment}
            className={`px-6 py-2.5 ${
              isProcessingPayment
                ? "bg-amber-400 opacity-80"
                : "bg-amber-500 hover:bg-amber-600"
            } text-white font-medium rounded-lg transition-all duration-200 shadow-sm flex items-center justify-center cursor-pointer`}
          >
            {isProcessingPayment ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                Processing...
              </>
            ) : (
              "Confirm Downgrade"
            )}
          </motion.button>
        </div>
      </div>
    );
  };

  // Enhanced Success view with more detailed information and animations
  const SuccessView = () => {
    const changeType = getPlanChangeType();

    // Consider downgrade as only when specifically changing to free plan
    const isDowngradeToFree = selectedSyncPlan === "free";

    const effectiveDate =
      isDowngradeToFree && downgradeEffectiveDate
        ? format(downgradeEffectiveDate, "MMMM d, yyyy")
        : "immediately";

    // Get plan details for the confirmation
    const newPlanName = getSelectedPlanName();
    const newStorage = formatStorage(
      updatedPlanData?.storage?.total ||
        selectedPlan?.storage ||
        3 * 1024 * 1024 * 1024,
    );

    return (
      <div className="py-8 px-6 flex flex-col items-center justify-center max-h-[calc(100vh-14rem)] overflow-y-auto">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 10, stiffness: 100 }}
          className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6"
        >
          <Check className="h-8 w-8 text-emerald-500" />
        </motion.div>

        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl font-semibold text-gray-900 dark:text-white mb-2 text-center"
        >
          {isDowngradeToFree
            ? "Downgrade Scheduled!"
            : `${changeType.charAt(0).toUpperCase() + changeType.slice(1)} Successful!`}
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center text-gray-500 dark:text-gray-400 mb-4 max-w-md"
        >
          {isDowngradeToFree
            ? `Your account will be downgraded to ${newPlanName} on ${effectiveDate}.`
            : `Your account has been ${changeType} to ${newPlanName} with ${
                billingCycle === "yearly" ? "yearly" : "monthly"
              } billing.`}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/20 rounded-lg p-4 mb-6 w-full max-w-md"
        >
          <h4 className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-2">
            Plan Details:
          </h4>
          <ul className="space-y-2">
            <li className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Plan:</span>
              <span className="font-medium text-gray-800 dark:text-white">
                {newPlanName}
              </span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Storage:</span>
              <span className="font-medium text-gray-800 dark:text-white">
                {newStorage}
              </span>
            </li>
            <li className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Billing:</span>
              <span className="font-medium text-gray-800 dark:text-white">
                {isDowngradeToFree
                  ? "Free"
                  : `${billingCycle === "yearly" ? "Yearly" : "Monthly"}`}
              </span>
            </li>
            {isDowngradeToFree && (
              <li className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Effective Date:
                </span>
                <span className="font-medium text-gray-800 dark:text-white">
                  {effectiveDate}
                </span>
              </li>
            )}
          </ul>
        </motion.div>

        {isDowngradeToFree && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-center text-gray-500 dark:text-gray-400 mb-6 max-w-md"
          >
            You will continue to enjoy your current plan benefits until then. If
            you change your mind, you can upgrade again anytime.
          </motion.p>
        )}

        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleClose}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors duration-300 cursor-pointer"
        >
          Got it
        </motion.button>
      </div>
    );
  };

  // Combine all of the parts into the main component
  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="modal-backdrop"
        variants={modalBackdropVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-[9999] bg-black/20 dark:bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm"
      >
        <motion.div
          key="modal-content"
          ref={modalContentRef}
          variants={modalContentVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="bg-white dark:bg-[#1c1b23] rounded-xl w-full max-w-xl lg:max-w-4xl flex flex-col max-h-[calc(100vh-2rem)] shadow-xl"
        >
          <div className="flex justify-between items-center p-6 border-b border-slate-200/60 dark:border-[#343140]/60 shrink-0">
            <div className="flex items-center gap-3">
              <Cloud className="w-6 h-6 text-emerald-500" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white truncate">
                {currentView === "success"
                  ? "Plan Change Successful"
                  : currentView === "retention"
                    ? "Special Offer"
                    : currentView === "confirmation"
                      ? "Confirm Downgrade"
                      : currentView === "payment"
                        ? isSamePlanDifferentCycle
                          ? billingCycle === "yearly"
                            ? "Upgrade to Yearly Billing"
                            : "Switch to Monthly Billing"
                          : selectedPlanType === "family"
                            ? "Switch to Family Plan"
                            : selectedPlanType === "business"
                              ? "Switch to Business Plan"
                              : getTierFromPlanId(selectedSyncPlan) >
                                  userPlanTier
                                ? `Upgrade to ${getSelectedPlanName()}`
                                : `Change to ${getSelectedPlanName()}`
                        : "Choose Your Plan"}
              </h3>
            </div>
            <motion.button
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.2 }}
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-300 cursor-pointer flex-shrink-0"
              // Disable close button during critical flows
              disabled={currentView === "payment" && isProcessingPayment}
            >
              <X className="w-6 h-6" />
            </motion.button>
          </div>

          {/* Content changes based on current view */}
          {currentView === "success" ? (
            <SuccessView />
          ) : currentView === "retention" ? (
            <RetentionView />
          ) : currentView === "confirmation" ? (
            <FreeDowngradeView />
          ) : currentView === "payment" ? (
            <div className="overflow-y-auto px-6 py-6">
              {isLoadingPaymentMethod ? (
                <PaymentSkeleton />
              ) : (
                <form onSubmit={handleSubmitPayment} noValidate>
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-base font-medium text-gray-900 dark:text-white">
                        Payment Details
                      </h4>
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        Total: ${price.toFixed(2)}{" "}
                        {billingCycle === "yearly" ? "/year" : "/month"}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {isSamePlanDifferentCycle
                        ? billingCycle === "yearly"
                          ? "Switch to yearly billing to save money"
                          : "Switch to monthly billing for more flexibility"
                        : `Enter your payment details to ${getPlanChangeType()} to ${getSelectedPlanName()}`}
                    </p>
                  </div>

                  {/* Existing Payment Method */}
                  {paymentMethod && (
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          Payment Method
                        </h5>
                        {!useNewCard && (
                          <button
                            type="button"
                            onClick={() => {
                              setUseNewCard(true);
                            }}
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Use a new card
                          </button>
                        )}
                      </div>

                      {!useNewCard && paymentMethod && (
                        <div className="flex items-center justify-between p-3 rounded-lg border border-emerald-400 bg-emerald-50/30 dark:bg-emerald-900/10">
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              {paymentMethod.brand === "visa" && (
                                <img
                                  src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg"
                                  alt="Visa"
                                  className="h-6"
                                />
                              )}
                              {paymentMethod.brand === "mastercard" && (
                                <img
                                  src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg"
                                  alt="Mastercard"
                                  className="h-6"
                                />
                              )}
                              {paymentMethod.brand === "amex" && (
                                <img
                                  src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg"
                                  alt="American Express"
                                  className="h-6"
                                />
                              )}
                              {paymentMethod.brand === "discover" && (
                                <img
                                  src="https://js.stripe.com/v3/fingerprinted/img/discover-ac52cd46f89fa40a29a0bfb954e33173.svg"
                                  alt="Discover"
                                  className="h-6"
                                />
                              )}
                              {![
                                "visa",
                                "mastercard",
                                "amex",
                                "discover",
                              ].includes(paymentMethod.brand) && (
                                <CreditCard className="h-6 w-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                {paymentMethod.brand.charAt(0).toUpperCase() +
                                  paymentMethod.brand.slice(1)}{" "}
                                •••• {paymentMethod.last4}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Expires {paymentMethod.exp_month}/
                                {paymentMethod.exp_year}
                              </p>
                            </div>
                          </div>
                          <div className="flex-shrink-0">
                            <Check className="h-5 w-5 text-emerald-500" />
                          </div>
                        </div>
                      )}

                      {useNewCard && (
                        <button
                          type="button"
                          onClick={() => {
                            if (paymentMethod) {
                              setUseNewCard(false);
                            }
                          }}
                          className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          Use saved card instead
                        </button>
                      )}
                    </div>
                  )}

                  {/* Add new card section */}
                  {(useNewCard || !paymentMethod) && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                        {paymentMethod ? "Add a new card" : "Card Details"}
                      </h5>

                      {/* Accepted Cards */}
                      <div className="mb-4 flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          We accept:
                        </span>
                        <div className="flex space-x-2">
                          {/* Credit card icons */}
                          <div className="cursor-default">
                            <img
                              src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg"
                              alt="Visa"
                              className="h-6"
                            />
                          </div>
                          <div className="cursor-default">
                            <img
                              src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg"
                              alt="Mastercard"
                              className="h-6"
                            />
                          </div>
                          <div className="cursor-default">
                            <img
                              src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg"
                              alt="American Express"
                              className="h-6"
                            />
                          </div>
                          <div className="cursor-default">
                            <img
                              src="https://js.stripe.com/v3/fingerprinted/img/discover-ac52cd46f89fa40a29a0bfb954e33173.svg"
                              alt="Discover"
                              className="h-6"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mb-6">
                        <div className="border border-slate-200/60 dark:border-[#343140]/60 px-3 py-3 bg-gray-50/50 dark:bg-[#2c2934]/70 rounded-lg focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 transition-all duration-200">
                          <CardElement
                            id="card-element"
                            onChange={handleCardElementChange}
                            options={{
                              hidePostalCode: true,
                              style: {
                                base: {
                                  fontSize: "16px",
                                  color: theme.isDarkMode
                                    ? "#ffffff"
                                    : "#333333",
                                  fontFamily:
                                    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                                  "::placeholder": {
                                    color: "#a1a1aa",
                                  },
                                  iconColor: "#71717a",
                                },
                                invalid: {
                                  color: "#ef4444",
                                  iconColor: "#ef4444",
                                },
                              },
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Security Message */}
                  <div className="mb-6 p-3 bg-gray-50/50 dark:bg-[#2c2934]/30 rounded-lg border border-slate-200/40 dark:border-[#343140]/40">
                    <div className="flex items-start gap-3">
                      <Lock className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                          Secure Payment Processing
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Your payment information is encrypted using TLS and
                          processed securely by Stripe. We adhere to strict
                          privacy laws including CCPA and GDPR principles. Your
                          personal data is protected and we do not store your
                          full card details.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between">
                    <motion.button
                      type="button"
                      onClick={handleBackToPreviousView} // Use fixed function instead
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2c2934] rounded-lg transition-all duration-300 cursor-pointer"
                    >
                      Back to Plans
                    </motion.button>
                    <motion.button
                      type="submit"
                      disabled={
                        isProcessingPayment ||
                        (useNewCard && !cardComplete) ||
                        (!useNewCard && !paymentMethod)
                      }
                      whileHover={isProcessingPayment ? {} : { scale: 1.02 }}
                      whileTap={isProcessingPayment ? {} : { scale: 0.98 }}
                      className={`px-6 py-2 text-sm font-medium ${
                        isProcessingPayment ||
                        (useNewCard && !cardComplete) ||
                        (!useNewCard && !paymentMethod)
                          ? "bg-gray-400 cursor-not-allowed"
                          : "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                      } text-white rounded-lg transition-all duration-300 flex items-center gap-2 cursor-pointer`}
                    >
                      {isProcessingPayment ? (
                        <>
                          <svg
                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Processing...
                        </>
                      ) : isSamePlanDifferentCycle ? (
                        billingCycle === "yearly" ? (
                          "Confirm Yearly Billing"
                        ) : (
                          "Switch to Monthly Billing"
                        )
                      ) : (
                        `Complete ${
                          getPlanChangeType() === "upgraded"
                            ? "Upgrade"
                            : getPlanChangeType() === "downgraded"
                              ? "Downgrade"
                              : "Plan Change"
                        }`
                      )}
                    </motion.button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            // Plans Selection View
            <div className="overflow-y-auto px-6 py-6">
              {/* Plan Types */}
              {isLoadingPlans ? (
                <PlanTypeSkeleton />
              ) : (
                <div className="mb-8">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                    Plan Type
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {planTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = selectedPlanType === type.id;
                      return (
                        <motion.div
                          key={type.id}
                          onClick={() => handlePlanTypeChange(type.id)}
                          variants={cardVariants}
                          initial="initial"
                          animate={isSelected ? "selected" : "initial"}
                          whileHover="hover"
                          className={`relative cursor-pointer rounded-xl p-4 border ${
                            isSelected
                              ? "border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-900/10"
                              : "border-slate-200/60 dark:border-[#343140]/60 hover:border-emerald-200/60 dark:hover:border-emerald-800/30"
                          } transition-all duration-200`}
                        >
                          {isSelected && (
                            <motion.div
                              className="absolute top-2 right-2"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", damping: 10 }}
                            >
                              <div className="h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                <Check className="h-3 w-3 text-white" />
                              </div>
                            </motion.div>
                          )}
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? "bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] border border-emerald-500/10 dark:border-emerald-500/5"
                                  : "bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border border-gray-200/60 dark:border-gray-700/30"
                              }`}
                            >
                              <Icon
                                className={`h-5 w-5 ${
                                  isSelected
                                    ? "text-emerald-500"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              />
                            </div>
                            <div>
                              <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                {type.name}
                              </h5>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {type.description}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Billing Cycle Toggle */}
              <div className="flex justify-center mb-8">
                <div className="bg-gray-50/50 dark:bg-[#2c2934]/70 p-1 rounded-lg inline-flex">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setBillingCycle("monthly")}
                    className={`py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                      billingCycle === "monthly"
                        ? "bg-white dark:bg-[#1c1b23] text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400"
                    } cursor-pointer`}
                  >
                    Monthly
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setBillingCycle("yearly")}
                    className={`py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
                      billingCycle === "yearly"
                        ? "bg-white dark:bg-[#1c1b23] text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 dark:text-gray-400"
                    } relative cursor-pointer`}
                  >
                    Yearly
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full"
                    >
                      Save
                    </motion.span>
                  </motion.button>
                </div>
              </div>

              {/* Plans (different for each type) */}
              {isLoadingPlans ? (
                <PlansSkeleton />
              ) : (
                <div>
                  <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                    {selectedPlanType === "individual"
                      ? "Individual Plans"
                      : selectedPlanType === "family"
                        ? "Family Plan"
                        : "Business Plan"}
                  </h4>

                  {/* For family and business plans - centered single plan */}
                  {selectedPlanType === "family" ||
                  selectedPlanType === "business" ? (
                    <div className="flex justify-center">
                      <div className="w-full max-w-lg">
                        {getPlansForSelectedType(selectedPlanType).map(
                          (plan: PlanFeature) => {
                            const isSelected = true; // Always selected since there's only one option
                            const currentPrice =
                              billingCycle === "monthly"
                                ? plan.price.monthly
                                : plan.price.yearly;
                            const yearlySavings = getYearlySavings(plan);
                            const planFeatures = plan.features;
                            const isPlanMatch =
                              subscription &&
                              ((subscription.plan_type === "family" &&
                                plan.id === "family") ||
                                (subscription.plan_type === "business" &&
                                  plan.id === "business"));

                            if (!plan.available) {
                              return (
                                <div
                                  key={plan.id}
                                  className="relative rounded-xl border border-slate-200/60 dark:border-[#343140]/60 bg-slate-50/80 dark:bg-[#2c2934]/30 p-4 opacity-70"
                                >
                                  <div className="absolute inset-0 flex items-center justify-center z-10">
                                    <div className="bg-white/90 dark:bg-[#1c1b23]/90 px-4 py-2 rounded-lg shadow-md backdrop-blur-sm">
                                      <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                                        Coming Soon
                                      </p>
                                    </div>
                                  </div>
                                  <div className="filter blur-sm">
                                    {/* Plan content (blurred) */}
                                    <div className="p-4 border-b border-slate-200/60 dark:border-[#343140]/60">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="h-8 w-8 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                                          <Zap className="h-4 w-4 text-emerald-500/40" />
                                        </div>
                                        <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                          {plan.name}
                                        </h5>
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {plan.description}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <motion.div
                                key={plan.id}
                                variants={cardVariants}
                                initial="initial"
                                animate={isSelected ? "selected" : "initial"}
                                whileHover="hover"
                                className={`relative rounded-xl border ${
                                  isSelected
                                    ? "border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-900/10"
                                    : "border-slate-200/60 dark:border-[#343140]/60 hover:border-emerald-200/60 dark:hover:border-emerald-800/30"
                                } transition-all duration-200 overflow-hidden`}
                              >
                                {/* Plan badges */}
                                {isPlanMatch &&
                                  ((subscription?.billing_cycle === "yearly" &&
                                    billingCycle === "yearly") ||
                                    (subscription?.billing_cycle !== "yearly" &&
                                      billingCycle === "monthly")) && (
                                    <motion.div
                                      initial={{ y: -20, opacity: 0 }}
                                      animate={{ y: 0, opacity: 1 }}
                                      transition={{ delay: 0.2 }}
                                      className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-bl-xl"
                                    >
                                      Current Plan
                                    </motion.div>
                                  )}

                                {/* Plan Header */}
                                <div className="p-4 border-b border-slate-200/60 dark:border-[#343140]/60">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="h-8 w-8 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                                      <Zap className="h-4 w-4 text-emerald-500" />
                                    </div>
                                    <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                      {plan.name}
                                    </h5>
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {plan.description}
                                  </p>
                                </div>

                                {/* Plan Price */}
                                <div className="p-4 border-b border-slate-200/60 dark:border-[#343140]/60">
                                  <div className="flex items-end">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                      ${currentPrice.toFixed(2)}
                                    </span>
                                    {currentPrice > 0 && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 mb-1">
                                        /
                                        {billingCycle === "monthly"
                                          ? "mo"
                                          : "yr"}
                                      </span>
                                    )}
                                  </div>

                                  {billingCycle === "yearly" &&
                                    yearlySavings > 0 && (
                                      <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                        className="mt-1 text-xs text-emerald-600 dark:text-emerald-400"
                                      >
                                        Save {yearlySavings}% with yearly
                                        billing
                                      </motion.div>
                                    )}
                                </div>

                                {/* Plan Features */}
                                <div className="p-4">
                                  <ul className="space-y-2">
                                    {Array.isArray(planFeatures) &&
                                      planFeatures.map((feature, index) => (
                                        <motion.li
                                          key={index}
                                          initial={{ opacity: 0, y: 5 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: 0.05 * index }}
                                          className="flex items-start gap-2"
                                        >
                                          <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                          <span className="text-xs text-gray-600 dark:text-gray-300">
                                            {feature}
                                          </span>
                                        </motion.li>
                                      ))}
                                  </ul>
                                </div>
                              </motion.div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  ) : (
                    // For individual plans - grid layout
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {getPlansForSelectedType(selectedPlanType).map(
                        (plan: PlanFeature) => {
                          const isSelected = selectedSyncPlan === plan.id;
                          const currentPrice =
                            billingCycle === "monthly"
                              ? plan.price.monthly
                              : plan.price.yearly;
                          const yearlySavings = getYearlySavings(plan);
                          const planFeatures = plan.features;
                          const isPlanMatch =
                            subscription &&
                            subscription.plan_type === "individual" &&
                            subscription.plan_id === plan.id;

                          if (!plan.available) {
                            return (
                              <div
                                key={plan.id}
                                className="relative rounded-xl border border-slate-200/60 dark:border-[#343140]/60 bg-slate-50/80 dark:bg-[#2c2934]/30 p-4 opacity-70"
                              >
                                <div className="absolute inset-0 flex items-center justify-center z-10">
                                  <div className="bg-white/90 dark:bg-[#1c1b23]/90 px-4 py-2 rounded-lg shadow-md backdrop-blur-sm">
                                    <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                                      Coming Soon
                                    </p>
                                  </div>
                                </div>
                                <div className="filter blur-sm">
                                  {/* Plan content (blurred) */}
                                  <div className="p-4 border-b border-slate-200/60 dark:border-[#343140]/60">
                                    <div className="flex items-center gap-2 mb-2">
                                      <div className="h-8 w-8 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                                        <Zap className="h-4 w-4 text-emerald-500/40" />
                                      </div>
                                      <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                        {plan.name}
                                      </h5>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {plan.description}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <motion.div
                              key={plan.id}
                              onClick={() => setSelectedSyncPlan(plan.id)}
                              variants={cardVariants}
                              initial="initial"
                              animate={isSelected ? "selected" : "initial"}
                              whileHover="hover"
                              className={`relative cursor-pointer rounded-xl border ${
                                isSelected
                                  ? "border-emerald-200/60 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-900/10"
                                  : "border-slate-200/60 dark:border-[#343140]/60 hover:border-emerald-200/60 dark:hover:border-emerald-800/30"
                              } transition-all duration-200 overflow-hidden`}
                            >
                              {/* Plan badges */}
                              {plan.popular && (
                                <motion.div
                                  initial={{ y: -20, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  transition={{ delay: 0.2 }}
                                  className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-bl-xl"
                                >
                                  Most Popular
                                </motion.div>
                              )}

                              {isPlanMatch &&
                                plan.id !== "free" &&
                                ((subscription?.billing_cycle === "yearly" &&
                                  billingCycle === "yearly") ||
                                  (subscription?.billing_cycle !== "yearly" &&
                                    billingCycle === "monthly")) && (
                                  <motion.div
                                    initial={{ y: -20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-bl-xl"
                                  >
                                    Current Plan
                                  </motion.div>
                                )}

                              {isPlanMatch && plan.id === "free" && (
                                <motion.div
                                  initial={{ y: -20, opacity: 0 }}
                                  animate={{ y: 0, opacity: 1 }}
                                  transition={{ delay: 0.2 }}
                                  className="absolute top-0 right-0 bg-emerald-500 text-white text-xs font-medium px-2 py-1 rounded-bl-xl"
                                >
                                  Current Plan
                                </motion.div>
                              )}

                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", damping: 10 }}
                                  className="absolute top-2 left-2"
                                >
                                  <div className="h-5 w-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <Check className="h-3 w-3 text-white" />
                                  </div>
                                </motion.div>
                              )}

                              {/* Plan Header */}
                              <div className="p-4 border-b border-slate-200/60 dark:border-[#343140]/60">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="h-8 w-8 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 dark:from-emerald-500/[0.05] dark:to-blue-500/[0.05] rounded-lg flex items-center justify-center flex-shrink-0 border border-emerald-500/10 dark:border-emerald-500/5">
                                    <Zap
                                      className={`h-4 w-4 ${
                                        plan.id === "free"
                                          ? "text-gray-400"
                                          : "text-emerald-500"
                                      }`}
                                    />
                                  </div>
                                  <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                    {plan.name}
                                  </h5>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {plan.description}
                                </p>
                              </div>

                              {/* Plan Price */}
                              <div className="p-4 border-b border-slate-200/60 dark:border-[#343140]/60">
                                <div className="flex items-end">
                                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                    ${currentPrice.toFixed(2)}
                                  </span>
                                  {currentPrice > 0 && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-1 mb-1">
                                      /
                                      {billingCycle === "monthly" ? "mo" : "yr"}
                                    </span>
                                  )}
                                </div>

                                {billingCycle === "yearly" &&
                                  yearlySavings > 0 && (
                                    <motion.div
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ delay: 0.2 }}
                                      className="mt-1 text-xs text-emerald-600 dark:text-emerald-400"
                                    >
                                      Save {yearlySavings}% with yearly billing
                                    </motion.div>
                                  )}
                              </div>

                              {/* Plan Features */}
                              <div className="p-4">
                                <ul className="space-y-2">
                                  {Array.isArray(planFeatures) &&
                                    planFeatures.map((feature, index) => (
                                      <motion.li
                                        key={index}
                                        initial={{ opacity: 0, y: 5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.05 * index }}
                                        className="flex items-start gap-2"
                                      >
                                        <Check className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                        <span className="text-xs text-gray-600 dark:text-gray-300">
                                          {feature}
                                        </span>
                                      </motion.li>
                                    ))}
                                </ul>
                              </div>
                            </motion.div>
                          );
                        },
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Plan Change Button */}
              <div className="mt-8 flex justify-center">
                <motion.button
                  whileHover={{ scale: !isActionButtonDisabled ? 1.03 : 1 }}
                  whileTap={{ scale: !isActionButtonDisabled ? 0.95 : 1 }}
                  onClick={handlePlanChange}
                  className={`${
                    isActionButtonDisabled
                      ? "bg-slate-200/80 dark:bg-[#343140]/60 text-slate-400 dark:text-slate-500 opacity-60 cursor-not-allowed"
                      : !isPlanAvailable
                        ? "bg-slate-300/80 dark:bg-[#3a3747]/60 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                        : "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white cursor-pointer"
                  } px-6 py-2.5 rounded-lg font-medium transition-all duration-300 shadow-sm`}
                  disabled={isActionButtonDisabled || !isPlanAvailable}
                >
                  {getActionButtonText()}
                </motion.button>
              </div>

              {/* Protection info */}
              <div className="mt-6 flex justify-center">
                <div className="flex flex-col items-center max-w-md">
                  <div className="flex items-start gap-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      All plans include end-to-end encryption and zero-knowledge
                      architecture.
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                    No one can access your data except you.
                  </span>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// Helper function to get tier from plan ID
function getTierFromPlanId(planId: string): number {
  if (planId === "family") return 3;
  if (planId === "business") return 4;

  // Default mapping
  const tierMap: Record<string, number> = {
    free: 1,
    plus: 2,
    pro: 3,
    max: 4,
  };

  return tierMap[planId] || 1;
}

// Helper function to format storage size
function formatStorage(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];

  // Find the appropriate size unit
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Format the storage to 1 decimal place when needed
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default memo(PlansModal);
