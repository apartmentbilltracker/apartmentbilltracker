import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors } from "./colors";

const THEME_KEY = "@app_theme"; // "light" | "dark" | "system"
const LIGHT_MODE_ONLY = true;

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState("light"); // "light" | "dark" | "system"
  const [loaded, setLoaded] = useState(false);

  // Resolve the actual mode from preference + system
  const resolvedMode = "light";

  // Load persisted theme on mount
  useEffect(() => {
    (async () => {
      try {
        if (LIGHT_MODE_ONLY) {
          setPreference("light");
          await AsyncStorage.setItem(THEME_KEY, "light");
        } else {
          const saved = await AsyncStorage.getItem(THEME_KEY);
          if (saved === "light" || saved === "dark" || saved === "system")
            setPreference(saved);
        }
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    if (LIGHT_MODE_ONLY) return;

    const next = resolvedMode === "dark" ? "light" : "dark";
    setPreference(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  };

  const setTheme = async (theme) => {
    if (LIGHT_MODE_ONLY) {
      setPreference("light");
      try {
        await AsyncStorage.setItem(THEME_KEY, "light");
      } catch {
        // ignore
      }
      return;
    }

    if (theme !== "light" && theme !== "dark" && theme !== "system") return;
    setPreference(theme);
    try {
      await AsyncStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
  };

  const value = useMemo(
    () => ({
      preference, // raw user choice: "light" | "dark" | "system"
      mode: resolvedMode, // resolved: "light" | "dark"
      isDark: false,
      colors: lightColors,
      toggleTheme,
      setTheme,
      loaded,
    }),
    [preference, resolvedMode, loaded],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

/**
 * Hook — returns { preference, mode, isDark, colors, toggleTheme, setTheme, loaded }
 */
export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback when used outside provider (shouldn't happen)
    return {
      preference: "light",
      mode: "light",
      isDark: false,
      colors: lightColors,
      toggleTheme: () => {},
      setTheme: () => {},
      loaded: true,
    };
  }
  return ctx;
};

export default ThemeContext;
