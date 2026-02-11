/**
 * Theme color tokens for light and dark mode.
 *
 * Every screen should import `useTheme()` from ThemeContext and call
 *   const { colors } = useTheme();
 * then reference `colors.xxx` in styles.
 */

export const lightColors = {
  // ── Backgrounds ──
  background: "#f5f6fa",
  card: "#ffffff",
  cardElevated: "#ffffff",
  cardAlt: "#f8f9fc",
  modal: "#ffffff",
  overlay: "rgba(0,0,0,0.5)",

  // ── Text ──
  text: "#1a1a2e",
  textSecondary: "#666666",
  textTertiary: "#999999",
  textOnAccent: "#ffffff",
  textOnCard: "#1a1a2e",

  // ── Accent (gold stays the same both themes) ──
  accent: "#b38604",
  accentLight: "rgba(179, 134, 4, 0.08)",
  accentSurface: "#fff8e1",

  // ── Borders & Dividers ──
  border: "#eeeeee",
  borderLight: "#f0f0f0",
  divider: "#eeeeee",

  // ── Inputs ──
  inputBg: "#f8f8f8",
  inputBorder: "#e0e0e0",
  inputText: "#333333",
  placeholder: "#999999",

  // ── Status ──
  success: "#4caf50",
  successBg: "#e8f5e9",
  error: "#d32f2f",
  errorBg: "#ffebee",
  warning: "#ff9800",
  warningBg: "#fff3e0",
  info: "#2196f3",
  infoBg: "#e3f2fd",
  purpleBg: "#f3e5f5",

  // ── Semantic bill-type colours (adapt brightness for dark) ──
  electricityColor: "#f57f17",
  waterColor: "#1565c0",
  internetColor: "#6a1b9a",

  // ── Badges & Tags ──
  badgeBg: "#e8e8e8",
  badgeText: "#666666",

  // ── Shadow ──
  shadow: "#000000",

  // ── Navigation ──
  headerBg: "#ffffff",
  headerText: "#1a1a2e",
  tabBarBg: "#ffffff",
  tabBarBorder: "#eeeeee",
  tabBarActive: "#b38604",
  tabBarInactive: "#999999",

  // ── StatusBar ──
  statusBarStyle: "dark-content",

  // ── Misc ──
  skeleton: "#e0e0e0",
  ripple: "rgba(0,0,0,0.08)",
  iconDefault: "#666666",
};

export const darkColors = {
  // ── Backgrounds ──
  background: "#0f0c29",
  card: "#1a1a2e",
  cardElevated: "#1e2742",
  cardAlt: "#16213e",
  modal: "#1a1a2e",
  overlay: "rgba(0,0,0,0.7)",

  // ── Text ──
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.6)",
  textTertiary: "rgba(255,255,255,0.35)",
  textOnAccent: "#ffffff",
  textOnCard: "#ffffff",

  // ── Accent ──
  accent: "#d4a017",
  accentLight: "rgba(179, 134, 4, 0.15)",
  accentSurface: "rgba(179, 134, 4, 0.08)",

  // ── Borders & Dividers ──
  border: "rgba(255,255,255,0.08)",
  borderLight: "rgba(255,255,255,0.05)",
  divider: "rgba(255,255,255,0.08)",

  // ── Inputs ──
  inputBg: "rgba(255,255,255,0.06)",
  inputBorder: "rgba(255,255,255,0.12)",
  inputText: "#ffffff",
  placeholder: "rgba(255,255,255,0.35)",

  // ── Status ──
  success: "#4ade80",
  successBg: "rgba(74, 222, 128, 0.12)",
  error: "#ff6b6b",
  errorBg: "rgba(255, 107, 107, 0.12)",
  warning: "#fbbf24",
  warningBg: "rgba(251, 191, 36, 0.12)",
  info: "#60a5fa",
  infoBg: "rgba(96, 165, 250, 0.12)",
  purpleBg: "rgba(123, 31, 162, 0.12)",

  // ── Semantic bill-type colours (brighter in dark mode) ──
  electricityColor: "#ffb74d",
  waterColor: "#64b5f6",
  internetColor: "#ce93d8",

  // ── Badges & Tags ──
  badgeBg: "rgba(255,255,255,0.08)",
  badgeText: "rgba(255,255,255,0.6)",

  // ── Shadow ──
  shadow: "#000000",

  // ── Navigation ──
  headerBg: "#1a1a2e",
  headerText: "#ffffff",
  tabBarBg: "#0f0c29",
  tabBarBorder: "rgba(255,255,255,0.06)",
  tabBarActive: "#d4a017",
  tabBarInactive: "rgba(255,255,255,0.35)",

  // ── StatusBar ──
  statusBarStyle: "light-content",

  // ── Misc ──
  skeleton: "rgba(255,255,255,0.08)",
  ripple: "rgba(255,255,255,0.06)",
  iconDefault: "rgba(255,255,255,0.6)",
};
