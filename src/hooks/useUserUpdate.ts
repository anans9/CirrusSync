import { useCallback, useRef } from "react";
import { ApiService } from "../services/ApiService";

interface UseUserUpdateProps {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  setToastMessage: (message: ToastMessage) => void;
  setShowToast: (show: boolean) => void;
  setIsSaving: (saving: boolean) => void;
}

export const useUserUpdate = ({
  user,
  setUser,
  setToastMessage,
  setShowToast,
  setIsSaving,
}: UseUserUpdateProps) => {
  // Use a ref to store previous values
  const prevValuesRef = useRef<Record<string, any>>({});

  // Update previous values when user changes
  if (user) {
    prevValuesRef.current = {
      email: user.email || "",
      company_name: user.company_name || "",
      username: user.username || "",
      display_name: user.display_name || "",
      ...prevValuesRef.current,
    };
  }

  // Determine which fields can be updated directly
  const canUpdateField = (field: string): boolean => {
    // These fields require verification or can't be changed
    const restrictedFields = ["username", "email"];

    // Phone is special - can only be set if not already set
    if (field === "phone") {
      return !user?.phone;
    }

    // If email is verified, it cannot be changed
    if (field === "email" && user?.email_verified) {
      return false;
    }

    // Username cannot be changed once set
    if (field === "username" && user?.username) {
      return false;
    }

    return !restrictedFields.includes(field);
  };

  const handleUserUpdate = async (
    type: string,
    value: string | object,
  ): Promise<{ success: boolean; error?: string }> => {
    // Check if this field can be updated
    if (!canUpdateField(type)) {
      setToastMessage({
        type: "error",
        text: `The ${type} field cannot be modified directly`,
      });
      setShowToast(true);
      return { success: false, error: "Field cannot be modified" };
    }

    // Don't perform API call if value is the same as current user value
    const stringValue =
      typeof value === "string" ? value : JSON.stringify(value);
    const currentValue = user ? user[type as keyof typeof user] : null;
    if (
      type !== "password" &&
      currentValue !== null &&
      currentValue !== undefined &&
      currentValue.toString() === stringValue
    ) {
      return { success: true };
    }

    try {
      const updateData: Record<string, any> = {};

      // Special handling for password which requires current and new password
      if (type === "password" && typeof value === "string") {
        try {
          updateData.password = JSON.parse(value);
        } catch (e) {
          updateData[type] = value;
        }
      }
      // Special handling for phone number
      else if (type === "phone") {
        // Phone numbers should never directly update without verification
        updateData.phone_verification_requested = true;
        updateData.phone = value;
      } else {
        updateData[type] = value;
      }

      if (Object.keys(updateData).length > 0) {
        const response = await ApiService.updateUser(updateData);

        if (response && response.code === 1000 && response.user) {
          // Update the user state with new data
          setUser(response.user);

          // Update the previous values ref
          if (user) {
            Object.keys(updateData).forEach((key) => {
              prevValuesRef.current[key] = updateData[key];
            });
          }

          setToastMessage({
            type: "success",
            text: "Profile updated successfully",
          });
          setShowToast(true);
          return { success: true };
        }

        throw new Error(response?.detail || "Failed to update user profile");
      }

      return { success: true };
    } catch (error: any) {
      setToastMessage({
        type: "error",
        text: error.message || "Failed to update. Please try again.",
      });
      setShowToast(true);
      return { success: false, error: error.message };
    }
  };

  // Special function for handling phone verification
  const handlePhoneVerification = async (
    phone: string,
    verificationCode: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsSaving(true);

      const response = await ApiService.verifyPhone({
        phone,
        verification_code: verificationCode,
      });

      if (response && response.code === 1000) {
        setUser((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            phone,
            phone_verified: true,
          };
        });

        setToastMessage({
          type: "success",
          text: "Phone number verified successfully",
        });
        setShowToast(true);
        return { success: true };
      }

      throw new Error(response?.detail || "Failed to verify phone number");
    } catch (error: any) {
      setToastMessage({
        type: "error",
        text: error.message || "Failed to verify phone. Please try again.",
      });
      setShowToast(true);
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  };

  // Request phone verification code
  const requestPhoneVerification = async (
    phone: string,
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsSaving(true);

      const response = await ApiService.requestPhoneVerification({ phone });

      if (response && response.code === 1000) {
        setToastMessage({
          type: "success",
          text: "Verification code sent to your phone",
        });
        setShowToast(true);
        return { success: true };
      }

      throw new Error(response?.detail || "Failed to send verification code");
    } catch (error: any) {
      setToastMessage({
        type: "error",
        text: error.message || "Failed to send code. Please try again.",
      });
      setShowToast(true);
      return { success: false, error: error.message };
    } finally {
      setIsSaving(false);
    }
  };

  // Use useRef for the debounced function to prevent recreating
  // the debounced function on every render
  const debouncedUpdateRef = useRef(
    debounce(async (type: string, value: string) => {
      setIsSaving(true);
      try {
        await handleUserUpdate(type, value);
      } finally {
        setIsSaving(false);
      }
    }, 500),
  );

  // Create a stable reference to the debounced function
  const debouncedUpdate = useCallback((type: string, value: string) => {
    debouncedUpdateRef.current(type, value);
  }, []);

  return {
    handleUserUpdate,
    debouncedUpdate,
    handlePhoneVerification,
    requestPhoneVerification,
    canUpdateField,
  };
};
