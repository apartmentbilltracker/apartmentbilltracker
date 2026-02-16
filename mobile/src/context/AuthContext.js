import React, { useEffect, useReducer, useCallback, useRef } from "react";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { authService } from "../services/apiService";
import notificationService from "../services/notificationService";
import savedAccountsService from "../services/savedAccountsService";

// Inactivity timeout in milliseconds (15 minutes)
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

export const AuthContext = React.createContext();

const initialState = {
  isLoading: true,
  isSignOut: false,
  user: null,
  userToken: null,
  error: null,
  currentView: "admin", // "admin" or "client" - which navigator to show for admins
  sessionExpiredReason: null, // e.g. "inactivity" — shown as banner on login screen
};

const reducer = (state, action) => {
  // Helper: derive the default view from the user's role
  const viewForRole = (user) => {
    const role = user?.role?.toLowerCase?.() || "client";
    if (role === "admin") return "admin";
    if (role === "host") return "host";
    return "client";
  };

  switch (action.type) {
    case "RESTORE_TOKEN":
      return {
        ...state,
        userToken: action.payload.token,
        user: action.payload.user,
        currentView: viewForRole(action.payload.user),
        isLoading: false,
      };
    case "SIGN_IN":
      return {
        ...state,
        isSignOut: false,
        isLoading: false,
        userToken: action.payload.token,
        user: action.payload.user,
        currentView: viewForRole(action.payload.user),
        error: null,
      };
    case "SIGN_UP":
      return {
        ...state,
        isSignOut: false,
        isLoading: false,
        userToken: action.payload.token,
        user: action.payload.user,
        currentView: "client",
        error: null,
      };
    case "SIGN_OUT":
      return {
        ...state,
        isSignOut: true,
        userToken: null,
        user: null,
        currentView: "admin",
        sessionExpiredReason: action.payload?.reason || null,
      };
    case "CLEAR_SESSION_EXPIRED":
      return {
        ...state,
        sessionExpiredReason: null,
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
  const lastActivityRef = useRef(Date.now());
  const inactivityTimerRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // Helper to cache user data in AsyncStorage (no size limit, unlike SecureStore)
  // Strips oversized base64 avatar data to avoid exceeding Android's ~2MB CursorWindow limit
  const MAX_AVATAR_SIZE = 100000; // 100KB — safe for AsyncStorage, enough for display
  const cacheUserData = async (user) => {
    try {
      const userToCache = { ...user };

      // Strip only oversized base64 avatar data — keep small ones for display
      if (userToCache.avatar) {
        if (typeof userToCache.avatar === "string") {
          if (userToCache.avatar.length > MAX_AVATAR_SIZE) {
            userToCache.avatar = null;
          }
        } else if (typeof userToCache.avatar === "object") {
          if (
            userToCache.avatar.url &&
            userToCache.avatar.url.length > MAX_AVATAR_SIZE
          ) {
            userToCache.avatar = { ...userToCache.avatar, url: null };
          }
        }
      }

      await AsyncStorage.setItem("cachedUser", JSON.stringify(userToCache));
    } catch (e) {
      // Silently fail - caching is best effort
      console.warn("Failed to cache user data:", e.message);
    }
  };

  const getCachedUserData = async () => {
    try {
      const cached = await AsyncStorage.getItem("cachedUser");
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      // Row may be too large (CursorWindow) — clear it so app can recover
      console.warn("Failed to read cached user:", e.message);
      try {
        await AsyncStorage.removeItem("cachedUser");
      } catch (_) {
        /* ignore */
      }
      return null;
    }
  };

  const clearCachedData = async () => {
    try {
      await SecureStore.deleteItemAsync("authToken");
      await AsyncStorage.multiRemove(["cachedUser", "lastActivityTime"]);
    } catch (e) {
      // Silently fail
    }
  };

  // Save last activity timestamp to SecureStore (for checking on app restart)
  const saveLastActivity = async () => {
    lastActivityRef.current = Date.now();
    try {
      await AsyncStorage.setItem("lastActivityTime", String(Date.now()));
    } catch (e) {
      // Silently fail
    }
  };

  // Reset the inactivity timer
  const resetInactivityTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    // Save to SecureStore periodically (debounced via timer reset)
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(async () => {
      // Time expired — auto logout
      console.log("Session expired due to inactivity");
      await notificationService.cancelAllNotifications();
      await clearCachedData();
      dispatch({ type: "SIGN_OUT", payload: { reason: "inactivity" } });
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  // Track app state changes for inactivity detection
  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // App came to foreground — check if inactivity timeout elapsed
          if (state.userToken) {
            const lastActivity = lastActivityRef.current;
            const elapsed = Date.now() - lastActivity;
            if (elapsed >= INACTIVITY_TIMEOUT_MS) {
              console.log("Session expired while app was in background");
              await notificationService.cancelAllNotifications();
              await clearCachedData();
              dispatch({ type: "SIGN_OUT", payload: { reason: "inactivity" } });
            } else {
              // Resume timer with remaining time
              resetInactivityTimer();
            }
          }
        } else if (nextAppState.match(/inactive|background/)) {
          // App going to background — save the last activity time
          saveLastActivity();
          // Clear the timer (we'll check elapsed time when app returns)
          if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
          }
        }
        appStateRef.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [state.userToken, resetInactivityTimer]);

  // Start inactivity timer when user is logged in
  useEffect(() => {
    if (state.userToken) {
      resetInactivityTimer();
    } else {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    }
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [state.userToken, resetInactivityTimer]);

  // Restore token on app start
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await SecureStore.getItemAsync("authToken");

        if (token) {
          // Check if inactivity timeout elapsed while app was closed
          const lastActivityStr =
            await AsyncStorage.getItem("lastActivityTime");
          if (lastActivityStr) {
            const lastActivity = parseInt(lastActivityStr, 10);
            const elapsed = Date.now() - lastActivity;
            if (elapsed >= INACTIVITY_TIMEOUT_MS) {
              console.log(
                "Session expired while app was closed (inactive for",
                Math.round(elapsed / 60000),
                "min)",
              );
              await clearCachedData();
              dispatch({
                type: "SIGN_OUT",
                payload: { reason: "inactivity" },
              });
              dispatch({
                type: "RESTORE_TOKEN",
                payload: { token: null, user: null },
              });
              return;
            }
          }

          // Try to fetch fresh profile from server
          try {
            const response = await authService.getProfile();
            const user = response.data?.user || response.user || response.data;
            await cacheUserData(user);
            dispatch({
              type: "RESTORE_TOKEN",
              payload: { token, user },
            });
          } catch (error) {
            // If 401 — token is invalid/expired, clear everything
            if (error.status === 401) {
              console.log("Token expired or invalid, clearing session");
              await clearCachedData();
              dispatch({
                type: "RESTORE_TOKEN",
                payload: { token: null, user: null },
              });
            } else {
              // Network error or server down — use cached user data
              console.log(
                "Profile fetch failed (network/server issue), using cached data",
              );
              const cachedUser = await getCachedUserData();
              if (cachedUser) {
                dispatch({
                  type: "RESTORE_TOKEN",
                  payload: { token, user: cachedUser },
                });
              } else {
                // No cached data available, still keep token but show error
                dispatch({
                  type: "SET_ERROR",
                  payload:
                    "Unable to connect to server. Please check your connection.",
                });
                dispatch({
                  type: "RESTORE_TOKEN",
                  payload: { token: null, user: null },
                });
              }
            }
          }
        } else {
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
    resetInactivityTimer,
    clearSessionExpired: useCallback(() => {
      dispatch({ type: "CLEAR_SESSION_EXPIRED" });
    }, []),
    signIn: useCallback(async (email, password) => {
      try {
        const response = await authService.login({ email, password });
        const data = response.data || response;
        const { token, user } = data;
        await SecureStore.setItemAsync("authToken", token);
        await cacheUserData(user);
        await saveLastActivity();
        dispatch({ type: "SIGN_IN", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder notification at 9 AM
        await notificationService.scheduleDailyPresenceReminder(20, 0);

        return { success: true };
      } catch (error) {
        const message = error.data?.message || error.message || "Login failed";
        dispatch({ type: "SET_ERROR", payload: message });
        return { success: false, error: message };
      }
    }, []),

    signUp: useCallback(async (name, email, password) => {
      try {
        const response = await authService.register({ name, email, password });
        const data = response.data || response;
        const { token, user } = data;
        await SecureStore.setItemAsync("authToken", token);
        await cacheUserData(user);
        await saveLastActivity();
        dispatch({ type: "SIGN_UP", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder notification at 9 AM
        await notificationService.scheduleDailyPresenceReminder(9, 0);

        return { success: true };
      } catch (error) {
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
        // Logout API call may fail if server unreachable — proceed anyway
      } finally {
        // Cancel all notifications when signing out
        await notificationService.cancelAllNotifications();
        await clearCachedData();
        dispatch({ type: "SIGN_OUT" });
      }
    }, []),

    signInWithGoogle: useCallback(async (googleData) => {
      try {
        const response = await authService.googleLogin(googleData);
        const data = response.data || response;
        const { token, user } = data;
        if (!token) throw new Error("No token received from server");
        await SecureStore.setItemAsync("authToken", token);
        await cacheUserData(user);
        await saveLastActivity();
        dispatch({ type: "SIGN_IN", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder
        await notificationService.scheduleDailyPresenceReminder(20, 0);

        return { success: true };
      } catch (error) {
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
        await cacheUserData(user);
        await saveLastActivity();
        dispatch({ type: "SIGN_IN", payload: { token, user } });

        // Save account for quick login
        await savedAccountsService.saveAccount(user);

        // Schedule daily presence reminder
        await notificationService.scheduleDailyPresenceReminder(20, 0);

        return { success: true };
      } catch (error) {
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
        const response = await authService.getProfile();
        const data = response.data || response;
        const updatedUser = data.user || data;
        await cacheUserData(updatedUser);
        dispatch({
          type: "SIGN_IN",
          payload: { token: state.userToken, user: updatedUser },
        });
        return { success: true };
      } catch (error) {
        console.error("Error refreshing user profile:", error.message);
        return { success: false, error: error.message };
      }
    }, [state.userToken]),

    switchView: useCallback((view) => {
      dispatch({ type: "SWITCH_VIEW", payload: view });
    }, []),

    updateUserProfile: useCallback(async (name, avatarBase64) => {
      try {
        const updateData = {};
        if (name) updateData.name = name.trim();
        if (avatarBase64) updateData.avatar = avatarBase64;

        const response = await authService.updateProfile(updateData);

        const data = response.data || response;
        const updatedUser = data.user || data;

        await cacheUserData(updatedUser);
        dispatch({
          type: "UPDATE_USER",
          payload: updatedUser,
        });

        // Refresh full user data from server to ensure consistency
        try {
          const freshResponse = await authService.getProfile();
          const freshData = freshResponse.data || freshResponse;
          const freshUser = freshData.user || freshData;
          await cacheUserData(freshUser);
          dispatch({
            type: "UPDATE_USER",
            payload: freshUser,
          });
        } catch (refreshError) {
          // Still return success as the update was saved
        }

        return { success: true, user: updatedUser };
      } catch (error) {
        console.error("Error updating profile:", error.message);
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
