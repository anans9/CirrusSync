import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, CreditCard, AlertTriangle, Lock } from "lucide-react";
import { CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useTheme } from "../../context/ThemeContext";
import { ApiService } from "../../services/ApiService";
import { Modal } from "../Modal";

interface CardUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPaymentMethod: PaymentMethod | null;
  onSuccess: (newPaymentMethod: PaymentMethod | null) => void;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
}

export const CardUpdateModal: React.FC<CardUpdateModalProps> = ({
  isOpen,
  onClose,
  currentPaymentMethod,
  onSuccess,
  setToastMessage,
  setShowToast,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const theme = useTheme();

  // State variables
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  // Track whether the modal is being processed to prevent race conditions
  const processedRef = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCardComplete(false);
      setUpdateSuccess(false);
      processedRef.current = false;
    }
  }, [isOpen]);

  // Safe close handler to prevent double-processing
  const handleClose = useCallback(() => {
    if (isProcessing) return;

    // Reset states
    setUpdateSuccess(false);
    processedRef.current = false;

    // Small delay to ensure animations complete
    setTimeout(() => {
      onClose();
    }, 50);
  }, [onClose, isProcessing]);

  // Handle card element changes from Stripe
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

  // Handle form submission to update payment method
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // Validation checks
    if (!stripe || !elements) {
      setToastMessage({
        type: "error",
        text: "Stripe hasn't loaded yet. Please try again.",
      });
      setShowToast(true);
      return;
    }

    if (!cardComplete) {
      setToastMessage({
        type: "error",
        text: "Please complete your card information.",
      });
      setShowToast(true);
      return;
    }

    if (processedRef.current) {
      return; // Prevent double submission
    }

    setIsProcessing(true);
    processedRef.current = true;

    try {
      const cardElement = elements.getElement(CardElement);

      if (!cardElement) {
        throw new Error("Card element not found");
      }

      // Create payment method with Stripe
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: "card",
        card: cardElement,
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!paymentMethod || !paymentMethod.id) {
        throw new Error("Failed to create payment method");
      }

      // Prepare payload for API (without billing info)
      const payload = {
        token: paymentMethod.id,
      };

      // Add the payment method via API
      const response = await ApiService.addPaymentMethod(payload);

      if (response.code === 1000 && response.payment_method) {
        // Success! Show success state and update parent component
        setUpdateSuccess(true);
        onSuccess(response.payment_method);
        setToastMessage({
          type: "success",
          text: "Payment method updated successfully!",
        });
        setShowToast(true);
      } else {
        throw new Error(response.detail || "Failed to update payment method");
      }
    } catch (err) {
      console.error("Error updating payment method:", err);
      processedRef.current = false; // Reset so user can try again
      setToastMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to update payment method",
      });
      setShowToast(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Success content
  const renderSuccessContent = () => (
    <div className="py-8 px-6 flex flex-col items-center justify-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", damping: 10, stiffness: 100 }}
        className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mb-6"
      >
        <Check className="h-8 w-8 text-emerald-500" />
      </motion.div>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Card Updated Successfully!
      </h3>

      <p className="text-center text-gray-500 dark:text-gray-400">
        Your new payment method has been saved and will be used for future
        transactions.
      </p>
    </div>
  );

  // Update card content
  const renderUpdateContent = () => (
    <div className="px-6 py-6">
      <form onSubmit={handleSubmit} noValidate>
        {currentPaymentMethod && (
          <div className="mb-6">
            <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">
              Current Payment Method
            </h4>
            <div className="p-3 border border-slate-200/60 dark:border-[#343140]/60 rounded-lg bg-slate-50/50 dark:bg-[#2c2934]/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {currentPaymentMethod.brand === "visa" && (
                      <img
                        src="https://js.stripe.com/v3/fingerprinted/img/visa-729c05c240c4bdb47b03ac81d9945bfe.svg"
                        alt="Visa"
                        className="h-6"
                      />
                    )}
                    {currentPaymentMethod.brand === "mastercard" && (
                      <img
                        src="https://js.stripe.com/v3/fingerprinted/img/mastercard-4d8844094130711885b5e41b28c9848f.svg"
                        alt="Mastercard"
                        className="h-6"
                      />
                    )}
                    {currentPaymentMethod.brand === "amex" && (
                      <img
                        src="https://js.stripe.com/v3/fingerprinted/img/amex-a49b82f46c5cd6a96a6e418a6ca1717c.svg"
                        alt="American Express"
                        className="h-6"
                      />
                    )}
                    {currentPaymentMethod.brand === "discover" && (
                      <img
                        src="https://js.stripe.com/v3/fingerprinted/img/discover-ac52cd46f89fa40a29a0bfb954e33173.svg"
                        alt="Discover"
                        className="h-6"
                      />
                    )}
                    {!["visa", "mastercard", "amex", "discover"].includes(
                      currentPaymentMethod.brand,
                    ) && <CreditCard className="h-6 w-6 text-gray-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {currentPaymentMethod.brand.charAt(0).toUpperCase() +
                        currentPaymentMethod.brand.slice(1)}{" "}
                      •••• {currentPaymentMethod.last4}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Expires {currentPaymentMethod.exp_month}/
                      {currentPaymentMethod.exp_year}
                    </p>
                  </div>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                This card will be replaced by your new payment method.
              </p>
            </div>
          </div>
        )}

        <div className="mb-6">
          <h4 className="text-base font-medium text-gray-900 dark:text-white mb-3">
            New Card Details
          </h4>

          {/* Accepted Cards */}
          <div className="mb-4 flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              We accept:
            </span>
            <div className="flex space-x-2">
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
                      color: theme.isDarkMode ? "#ffffff" : "#333333",
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

          {/* Security Message */}
          <div className="p-3 bg-gray-50/50 dark:bg-[#2c2934]/30 rounded-lg border border-slate-200/40 dark:border-[#343140]/40">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                  Secure Payment Processing
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Your payment information is encrypted using TLS and processed
                  securely by Stripe. We do not store your full card details on
                  our servers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );

  // Footer buttons for update card view
  const renderUpdateFooter = () => (
    <div className="flex justify-between">
      <motion.button
        type="button"
        onClick={handleClose}
        disabled={isProcessing}
        whileHover={{ scale: isProcessing ? 1 : 1.02 }}
        whileTap={{ scale: isProcessing ? 1 : 0.98 }}
        className={`px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-slate-200/60 dark:border-[#343140]/60 bg-white hover:bg-slate-50 dark:bg-[#2c2934] dark:hover:bg-[#343140] rounded-lg transition-all duration-200 shadow-sm ${
          isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        Cancel
      </motion.button>
      <motion.button
        type="button"
        onClick={handleSubmit}
        disabled={isProcessing || !cardComplete}
        whileHover={{
          scale: isProcessing || !cardComplete ? 1 : 1.02,
        }}
        whileTap={{
          scale: isProcessing || !cardComplete ? 1 : 0.98,
        }}
        className={`px-6 py-2 text-sm font-medium ${
          isProcessing || !cardComplete
            ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
            : "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
        } text-white rounded-lg transition-all duration-200 shadow-sm flex items-center gap-2 cursor-pointer`}
      >
        {isProcessing ? (
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
          "Update Card"
        )}
      </motion.button>
    </div>
  );

  // Footer button for success view
  const renderSuccessFooter = () => (
    <div className="flex justify-end">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClose}
        className="px-6 py-2.5 text-sm font-medium bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 shadow-sm cursor-pointer"
      >
        Close
      </motion.button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={updateSuccess ? "Card Updated" : "Update Payment Method"}
      icon={CreditCard}
      iconColor="emerald"
      footer={updateSuccess ? renderSuccessFooter() : renderUpdateFooter()}
    >
      {updateSuccess ? renderSuccessContent() : renderUpdateContent()}
    </Modal>
  );
};

export default CardUpdateModal;
