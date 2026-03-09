import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from "react";
import { authService } from "../services/apiService";
import { setToken, clearToken } from "../services/api";

const AuthContext = createContext(null);

const initialState = {
  isLoading: true,
  user: null,
  token: null,
  error: null,
};

function reducer(state, action) {
  switch (action.type) {
    case "RESTORE":
      return {
        ...state,
        isLoading: false,
        token: action.token,
        user: action.user,
      };
    case "SIGN_IN":
      return {
        ...state,
        isLoading: false,
        token: action.token,
        user: action.user,
        error: null,
      };
    case "SIGN_OUT":
      return { ...initialState, isLoading: false };
    case "UPDATE_USER":
      return { ...state, user: action.user };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restore session on page load
  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem("authToken");
      if (!token) {
        dispatch({ type: "RESTORE", token: null, user: null });
        return;
      }
      // Show cached user immediately so avatar doesn't flash away on refresh
      const cached = localStorage.getItem("cachedUser");
      let cachedUser = null;
      if (cached) {
        try {
          cachedUser = JSON.parse(cached);
          dispatch({ type: "RESTORE", token, user: cachedUser });
        } catch (_) {}
      }
      try {
        const res = await authService.getProfile();
        let user = res?.data?.user || res?.user || res?.data || res;
        // /getuser omits the avatar column (withAvatar:false) to avoid large
        // base64 egress. Preserve the cached avatar so it survives refreshes.
        if (!user.avatar && cachedUser?.avatar) {
          user = { ...user, avatar: cachedUser.avatar };
        }
        localStorage.setItem("cachedUser", JSON.stringify(user));
        dispatch({ type: "RESTORE", token, user });
      } catch (err) {
        if (err.status === 401) {
          clearToken();
          localStorage.removeItem("cachedUser");
          dispatch({ type: "RESTORE", token: null, user: null });
        }
        // If non-401 error (e.g. network), keep the cached user so UI stays usable
      }
    };
    bootstrap();
  }, []);

  const signIn = useCallback(async (email, password) => {
    try {
      const res = await authService.login({ email, password });
      const data = res?.data || res;
      const { token, user } = data;
      setToken(token);
      localStorage.setItem("cachedUser", JSON.stringify(user));
      dispatch({ type: "SIGN_IN", token, user });
      return { success: true };
    } catch (err) {
      const msg = err?.data?.message || err.message || "Login failed";
      return { success: false, error: msg };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authService.logout();
    } catch (_) {
      /* ignore */
    }
    clearToken();
    localStorage.removeItem("cachedUser");
    dispatch({ type: "SIGN_OUT" });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authService.getProfile();
      let user = res?.data?.user || res?.user || res?.data || res;
      // Preserve cached avatar (same egress-saving reason as bootstrap above)
      try {
        const cachedRaw = localStorage.getItem("cachedUser");
        const cachedUser = cachedRaw ? JSON.parse(cachedRaw) : null;
        if (!user.avatar && cachedUser?.avatar) {
          user = { ...user, avatar: cachedUser.avatar };
        }
      } catch (_) {}
      localStorage.setItem("cachedUser", JSON.stringify(user));
      dispatch({ type: "UPDATE_USER", user });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  const updateUserProfile = useCallback(async (name, avatarBase64) => {
    try {
      const updateData = {};
      if (name) updateData.name = name.trim();
      if (avatarBase64) updateData.avatar = avatarBase64;
      const res = await authService.updateProfile(updateData);
      const data = res?.data || res;
      const updatedUser = data?.user || data;
      localStorage.setItem("cachedUser", JSON.stringify(updatedUser));
      dispatch({ type: "UPDATE_USER", user: updatedUser });
      return { success: true, user: updatedUser };
    } catch (err) {
      return { success: false, error: err?.data?.message || err.message };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ state, signIn, signOut, refreshUser, updateUserProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export default AuthContext;
