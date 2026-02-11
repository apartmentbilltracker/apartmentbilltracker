import React, { useEffect, useReducer, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { authService } from "../services/apiService";
import notificationService from "../services/notificationService";
import savedAccountsService from "../services/savedAccountsService";

export const AuthContext = React.createContext();

const initialState = {
  isLoading: true,
  isSignOut: false,
  user: null,
  userToken: null,
  error: null,
  currentView: "admin", // "admin" or "client" - which navigator to show for admins
};

const reducer = (state, action) => {
  switch (action.type) {
    case "RESTORE_TOKEN":
      return {
        ...state,
        userToken: action.payload.token,
        user: action.payload.user,
        isLoading: false,
      };
    case "SIGN_IN":
      return {
        ...state,
        isSignOut: false,
        isLoading: false,
        userToken: action.payload.token,
        user: action.payload.user,
        error: null,
      };
    case "SIGN_UP":
      return {
        ...state,
        isSignOut: false,
        isLoading: false,
        userToken: action.payload.token,
        user: action.payload.user,
        error: null,
      };
    case "SIGN_OUT":
      return {
        ...state,
        isSignOut: true,
        userToken: null,
        user: null,
      };
    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };
    case "SWITCH_VIEW":
      return {
        ...state,
        currentView: action.payload,
      };
    case "UPDATE_USER":
      return {
        ...state,
        user: action.payload,
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restore token on app start
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        console.log("Attempting to restore token...");
        const token = await SecureStore.getItemAsync("authToken");
        console.log("Token found:", token ? "Yes" : "No");

        if (token) {
          try {
            console.log("Fetching profile with token...");
            const response = await authService.getProfile();
            console.log("Profile fetched successfully");
            dispatch({
              type: "RESTORE_TOKEN",
              payload: { token, user: response.data.user },
            });
          } catch (error) {
            console.error("Profile fetch failed:", error.message);
            console.error("Error code:", error.code);
            console.error("Error response:", error.response?.data);
            await SecureStore.deleteItemAsync("authToken");
            dispatch({
              type: "SET_ERROR",
              payload: `Connection failed: ${error.message}. Backend unreachable at http://10.18.100.4:8000`,
            });
            dispatch({
              type: "RESTORE_TOKEN",
              payload: { token: null, user: null },
            });
          }
        } else {
          console.log("No token found, showing login screen");
          dispatch({
            type: "RESTORE_TOKEN",
            payload: { token: null, user: null },
          });
        }
      } catch (error) {
        console.error("Error restoring token:", error);
        dispatch({
          type: "RESTORE_TOKEN",
          payload: { token: null, user: null },
        });
      }
    };

    bootstrapAsync();
  }, []);

  const authContext = {
    state,
    isLoading: state.isLoading,
    signIn: useCallback(async (email, password) => {
      try {
        const response = await authService.login({ email, password });
        console.log("Login response:", response);
        // Handle response structure: with fetch API, response.data already contains the data
        const data = response.data || response;
        const { token, user } = data;
        console.log("Token:", token ? "exists" : "missing");
        console.log("User:", user ? "exists" : "missing");
        await SecureStore.setItemAsync("authToken", token);
        dispatch({ type: "SIGN_IN", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder notification at 9 AM
        await notificationService.scheduleDailyPresenceReminder(20, 0);

        return { success: true };
      } catch (error) {
        console.log("Login error:", error);
        const message = error.data?.message || error.message || "Login failed";
        dispatch({ type: "SET_ERROR", payload: message });
        return { success: false, error: message };
      }
    }, []),

    signUp: useCallback(async (name, email, password) => {
      try {
        const response = await authService.register({ name, email, password });
        console.log("Signup response:", response);
        const data = response.data || response;
        const { token, user } = data;
        await SecureStore.setItemAsync("authToken", token);
        dispatch({ type: "SIGN_UP", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder notification at 9 AM
        await notificationService.scheduleDailyPresenceReminder(9, 0);

        return { success: true };
      } catch (error) {
        console.log("Signup error:", error);
        const message =
          error.data?.message || error.message || "Registration failed";
        dispatch({ type: "SET_ERROR", payload: message });
        return { success: false, error: message };
      }
    }, []),

    signOut: useCallback(async () => {
      try {
        await authService.logout();
      } catch (error) {
        console.log("Logout error:", error);
      } finally {
        // Cancel all notifications when signing out
        await notificationService.cancelAllNotifications();

        await SecureStore.deleteItemAsync("authToken");
        dispatch({ type: "SIGN_OUT" });
      }
    }, []),

    signInWithGoogle: useCallback(async (googleData) => {
      try {
        const response = await authService.googleLogin(googleData);
        // Handle response structure: response.data may already be extracted
        const data = response.data || response;
        const { token, user } = data;
        if (!token) throw new Error("No token received from server");
        await SecureStore.setItemAsync("authToken", token);
        dispatch({ type: "SIGN_IN", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder
        await notificationService.scheduleDailyPresenceReminder(20, 0);

        return { success: true };
      } catch (error) {
        console.error("Google login error:", error);
        const message =
          error.data?.message ||
          error.response?.data?.message ||
          error.message ||
          "Google login failed";
        dispatch({ type: "SET_ERROR", payload: message });
        return { success: false, error: message };
      }
    }, []),

    signInWithFacebook: useCallback(async (facebookData) => {
      try {
        const response = await authService.facebookLogin(facebookData);
        const data = response.data || response;
        const { token, user } = data;
        if (!token) throw new Error("No token received from server");
        await SecureStore.setItemAsync("authToken", token);
        dispatch({ type: "SIGN_IN", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder
        await notificationService.scheduleDailyPresenceReminder(20, 0);

        return { success: true };
      } catch (error) {
        console.error("Facebook login error:", error);
        const message =
          error.data?.message ||
          error.response?.data?.message ||
          error.message ||
          "Facebook login failed";
        dispatch({ type: "SET_ERROR", payload: message });
        return { success: false, error: message };
      }
    }, []),

    refreshUser: useCallback(async () => {
      try {
        console.log("Refreshing user profile...");
        const response = await authService.getProfile();
        console.log("Profile response:", JSON.stringify(response, null, 2));
        // Handle response structure: with fetch API, response.data already contains the data
        const data = response.data || response;
        console.log("Data extracted:", JSON.stringify(data, null, 2));
        const updatedUser = data.user || data;
        console.log(
          "Updated user object:",
          JSON.stringify(updatedUser, null, 2),
        );
        console.log("Updated user role:", updatedUser.role);
        dispatch({
          type: "SIGN_IN",
          payload: { token: state.userToken, user: updatedUser },
        });
        return { success: true };
      } catch (error) {
        console.error("Error refreshing user profile:", error);
        return { success: false, error: error.message };
      }
    }, [state.userToken]),

    switchView: useCallback((view) => {
      console.log("Switching view to:", view);
      dispatch({ type: "SWITCH_VIEW", payload: view });
    }, []),

    updateUserProfile: useCallback(async (name, avatarBase64) => {
      try {
        const updateData = {};
        if (name) updateData.name = name.trim();
        if (avatarBase64) updateData.avatar = avatarBase64;

        console.log("Updating profile with:", Object.keys(updateData));
        const response = await authService.updateProfile(updateData);
        console.log(
          "Profile update response:",
          JSON.stringify(response, null, 2),
        );

        const data = response.data || response;
        const updatedUser = data.user || data;

        dispatch({
          type: "UPDATE_USER",
          payload: updatedUser,
        });

        // Refresh full user data from server to ensure consistency
        // This will update any related data on server side
        try {
          const freshResponse = await authService.getProfile();
          const freshData = freshResponse.data || freshResponse;
          const freshUser = freshData.user || freshData;
          dispatch({
            type: "UPDATE_USER",
            payload: freshUser,
          });
          console.log("User profile refreshed successfully");
        } catch (refreshError) {
          console.warn("Could not refresh user profile:", refreshError.message);
          // Still return success as the update was saved
        }

        return { success: true, user: updatedUser };
      } catch (error) {
        console.error("Error updating profile:", error);
        const message =
          error.response?.data?.message ||
          error.message ||
          "Profile update failed";
        return { success: false, error: message };
      }
    }, []),
  };

  return (
    <AuthContext.Provider value={authContext}>{children}</AuthContext.Provider>
  );
};
