import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { lightColors, darkColors } from "./colors";

const THEME_KEY = "@app_theme"; // "light" | "dark" | "system"

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [preference, setPreference] = useState("system"); // "light" | "dark" | "system"
  const [loaded, setLoaded] = useState(false);
  const systemScheme = useColorScheme(); // "light" | "dark" | null

  // Resolve the actual mode from preference + system
  const resolvedMode =
    preference === "system"
      ? systemScheme === "light"
        ? "light"
        : "dark" // fallback dark if system is null
      : preference;

  // Load persisted theme on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved === "light" || saved === "dark" || saved === "system")
          setPreference(saved);
      } catch {
        // ignore
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const toggleTheme = async () => {
    const next = resolvedMode === "dark" ? "light" : "dark";
    setPreference(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next);
    } catch {
      // ignore
    }
  };

  const setTheme = async (theme) => {
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
      isDark: resolvedMode === "dark",
      colors: resolvedMode === "dark" ? darkColors : lightColors,
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
      preference: "dark",
      mode: "dark",
      isDark: true,
      colors: darkColors,
      toggleTheme: () => {},
      setTheme: () => {},
      loaded: true,
    };
  }
  return ctx;
};

export default ThemeContext;
