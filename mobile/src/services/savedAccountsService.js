import AsyncStorage from "@react-native-async-storage/async-storage";

const SAVED_ACCOUNTS_KEY = "@saved_accounts";
const MAX_SAVED_ACCOUNTS = 5;

/**
 * Saved Accounts Service
 *
 * Stores recent login accounts so users can quickly sign in again
 * after logging out, similar to Facebook's saved login feature.
 *
 * Each saved account stores: email, name, avatar, auth_provider, last_login
 */
const savedAccountsService = {
  /**
   * Get all saved accounts, sorted by most recent login
   */
  getAccounts: async () => {
    try {
      const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
      if (!raw) return [];
      const accounts = JSON.parse(raw);
      // Sort by last login (most recent first)
      return accounts.sort((a, b) => b.lastLogin - a.lastLogin);
    } catch (e) {
      console.warn("Failed to get saved accounts:", e);
      return [];
    }
  },

  /**
   * Save or update an account after successful login
   */
  saveAccount: async (user) => {
    try {
      if (!user?.email) return;
      const accounts = await savedAccountsService.getAccounts();

      // Check if account already exists
      const existingIndex = accounts.findIndex(
        (a) => a.email.toLowerCase() === user.email.toLowerCase(),
      );

      const rawAvatar = user.avatar;
      let avatarUrl = null;
      if (typeof rawAvatar === "string") {
        avatarUrl = rawAvatar;
      } else if (rawAvatar && typeof rawAvatar === "object" && rawAvatar.url) {
        avatarUrl = rawAvatar.url;
      }

      const accountData = {
        email: user.email,
        name: user.name || user.email.split("@")[0],
        avatar: avatarUrl,
        authProvider: user.auth_provider || "email",
        lastLogin: Date.now(),
      };

      if (existingIndex >= 0) {
        // Update existing account
        accounts[existingIndex] = accountData;
      } else {
        // Add new account (at start)
        accounts.unshift(accountData);
      }

      // Keep only the most recent accounts
      const trimmed = accounts.slice(0, MAX_SAVED_ACCOUNTS);
      await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn("Failed to save account:", e);
    }
  },

  /**
   * Remove a specific saved account
   */
  removeAccount: async (email) => {
    try {
      const accounts = await savedAccountsService.getAccounts();
      const filtered = accounts.filter(
        (a) => a.email.toLowerCase() !== email.toLowerCase(),
      );
      await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn("Failed to remove saved account:", e);
    }
  },

  /**
   * Clear all saved accounts
   */
  clearAll: async () => {
    try {
      await AsyncStorage.removeItem(SAVED_ACCOUNTS_KEY);
    } catch (e) {
      console.warn("Failed to clear saved accounts:", e);
    }
  },
};

export default savedAccountsService;
