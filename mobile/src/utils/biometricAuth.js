import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Keys for storing biometric credentials in SecureStore
// Note: SecureStore only allows alphanumeric characters, ".", "-", and "_" in keys
// We sanitize email to use as part of the key to support multiple accounts

// Helper to sanitize email for use as SecureStore key
const sanitizeEmail = (email) => {
  if (!email) return "default";
  return email.toLowerCase().replace(/[^a-z0-9.-]/g, "_");
};

// Get per-account storage keys
const getBiometricEmailKey = (email) =>
  `biometric_email_${sanitizeEmail(email)}`;
const getBiometricPasswordKey = (email) =>
  `biometric_password_${sanitizeEmail(email)}`;
const getBiometricEnabledKey = (email) =>
  `biometric_enabled_${sanitizeEmail(email)}`;

// Legacy keys (for backwards compatibility - can be removed later)
const BIOMETRIC_EMAIL_KEY = "biometric_email";
const BIOMETRIC_PASSWORD_KEY = "biometric_password";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";

export const biometricAuth = {
  /**
   * Check if device has biometric capability (fingerprint, Face ID, etc.)
   */
  async isAvailable() {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      return compatible && enrolled;
    } catch (error) {
      console.error("Error checking biometric availability:", error);
      return false;
    }
  },

  /**
   * Get list of available biometric types
   */
  async getAvailableBiometrics() {
    try {
      const types =
        await LocalAuthentication.supportedAuthenticationTypesAsync();
      return types;
    } catch (error) {
      console.error("Error getting biometric types:", error);
      return [];
    }
  },

  /**
   * Get the email that biometric is stored for
   */
  async getStoredBiometricEmail() {
    try {
      // Try new per-account format first
      // Note: Since we don't know which account, we return from legacy key
      // This is called when loading login screen without selected account
      const email = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      return email || null;
    } catch (error) {
      console.error("Error getting stored biometric email:", error);
      return null;
    }
  },

  /**
   * Check if biometric is enabled AND is for the specified email
   */
  async isBiometricEnabledFor(email) {
    try {
      if (!email) return false;
      const enabledKey = getBiometricEnabledKey(email);
      const enabled = await SecureStore.getItemAsync(enabledKey);
      // Only return true if the per-account key is explicitly set to "true"
      // This prevents old legacy biometric from interfering
      return enabled === "true";
    } catch (error) {
      console.error("Error checking biometric enabled status:", error);
      return false;
    }
  },

  /**
   * Check if user has enabled biometric login (any account)
   * Returns the email if biometric is enabled for any account
   */
  async isBiometricEnabled() {
    try {
      // IMPORTANT: This function is deprecated for the new per-account system
      // Always return false to prevent legacy keys from enabling biometric
      // The per-account system (isBiometricEnabledFor) should be used instead
      return false;
    } catch (error) {
      console.error("Error checking biometric enabled status:", error);
      return false;
    }
  },

  /**
   * Enable biometric login and store credentials for specific email
   */
  async enableBiometric(email, password) {
    try {
      if (!email) {
        throw new Error("Email is required to enable biometric");
      }

      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        throw new Error(
          "Biometric authentication is not available on this device",
        );
      }

      // Store credentials securely with email-specific keys
      const emailKey = getBiometricEmailKey(email);
      const passwordKey = getBiometricPasswordKey(email);
      const enabledKey = getBiometricEnabledKey(email);

      await SecureStore.setItemAsync(emailKey, email);
      await SecureStore.setItemAsync(passwordKey, password);
      await SecureStore.setItemAsync(enabledKey, "true");

      return { success: true };
    } catch (error) {
      console.error("Error enabling biometric:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Disable biometric login and remove stored credentials for specific email
   */
  async disableBiometric(email = null) {
    try {
      if (email) {
        // Disable for specific account
        const emailKey = getBiometricEmailKey(email);
        const passwordKey = getBiometricPasswordKey(email);
        const enabledKey = getBiometricEnabledKey(email);

        await SecureStore.deleteItemAsync(emailKey);
        await SecureStore.deleteItemAsync(passwordKey);
        await SecureStore.deleteItemAsync(enabledKey);
        // Also clean up any legacy keys for this account
        await this.cleanupLegacyKeys(email);
      } else {
        // Disable all (backwards compatibility)
        await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      }
      return { success: true };
    } catch (error) {
      console.error("Error disabling biometric:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Clean up ALL legacy biometric keys
   * This should be called once during app initialization to purge old data
   */
  async cleanupAllLegacyKeys() {
    try {
      const legacyEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      const legacyEnabled = await SecureStore.getItemAsync(
        BIOMETRIC_ENABLED_KEY,
      );

      if (legacyEmail || legacyEnabled) {
        console.log(
          `Cleaning up legacy biometric keys - Email: ${legacyEmail}, Enabled: ${legacyEnabled}`,
        );
        await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
        console.log("✓ Successfully cleaned up all legacy biometric keys");
      }
      return { success: true };
    } catch (error) {
      console.error("Error cleaning up all legacy biometric keys:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Clean up legacy biometric keys for a specific email
   * Removes old global keys that might interfere with new per-account system
   * @param {string} email - Email to clean up legacy keys for
   */
  async cleanupLegacyKeys(email) {
    try {
      if (!email) return { success: false, error: "Email required" };

      // Check if legacy key contains this email, if so delete it
      const legacyEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      if (
        legacyEmail === email ||
        legacyEmail?.toLowerCase() === email.toLowerCase()
      ) {
        await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
        await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
      }

      return { success: true };
    } catch (error) {
      console.error("Error cleaning up legacy biometric keys:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Authenticate with biometric and return stored credentials
   * Prompts user to use fingerprint or Face ID
   * @param {string} expectedEmail - The email account to retrieve biometric credentials for
   */
  async authenticate(expectedEmail = null) {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        throw new Error("Biometric authentication is not available");
      }

      if (!expectedEmail) {
        throw new Error("Email is required for biometric authentication");
      }

      // Clean up any legacy keys for this account that might interfere
      await this.cleanupLegacyKeys(expectedEmail);

      // Check if biometric is enabled for this specific account
      const isEnabledForAccount =
        await this.isBiometricEnabledFor(expectedEmail);
      if (!isEnabledForAccount) {
        throw new Error(`Biometric login is not enabled for ${expectedEmail}`);
      }

      // Prompt user for biometric authentication
      const result = await LocalAuthentication.authenticateAsync({
        disableDeviceFallback: false, // Allow fallback to device passcode/PIN
        reason: "Authenticate to access your property flow",
      });

      if (!result.success) {
        throw new Error("Biometric authentication failed");
      }

      // Retrieve and return stored credentials for this account
      const emailKey = getBiometricEmailKey(expectedEmail);
      const passwordKey = getBiometricPasswordKey(expectedEmail);

      const email = await SecureStore.getItemAsync(emailKey);
      const password = await SecureStore.getItemAsync(passwordKey);

      if (!email || !password) {
        throw new Error("Stored credentials not found");
      }

      return { success: true, email, password };
    } catch (error) {
      console.error("Error during biometric authentication:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Clear biometric login if user changes password
   */
  async clearOnPasswordChange() {
    try {
      await this.disableBiometric();
      return { success: true };
    } catch (error) {
      console.error("Error clearing biometric:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Check if biometric setup modal should be shown for this user today
   * Returns false if modal was already shown today, true if enough time has passed
   * @param {string} email - User email
   * @returns {boolean} true if modal should be shown, false if already shown today
   */
  async shouldShowBiometricModal(email) {
    try {
      if (!email) return true;

      const key = `@biometric_modal_shown_${sanitizeEmail(email)}`;
      const lastShown = await AsyncStorage.getItem(key);

      if (!lastShown) return true; // Never shown before

      const lastShownTime = parseInt(lastShown, 10);
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;

      return now - lastShownTime >= twentyFourHours; // Show if 24+ hours have passed
    } catch (error) {
      console.error("Error checking biometric modal status:", error);
      return true; // Default to showing if there's an error
    }
  },

  /**
   * Mark that biometric setup modal was shown for this user
   * @param {string} email - User email
   */
  async markBiometricModalShown(email) {
    try {
      if (!email) return;

      const key = `@biometric_modal_shown_${sanitizeEmail(email)}`;
      await AsyncStorage.setItem(key, Date.now().toString());
    } catch (error) {
      console.error("Error marking biometric modal as shown:", error);
    }
  },
};
