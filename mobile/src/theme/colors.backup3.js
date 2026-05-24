/**
 * Theme color tokens for light and dark mode.
 *
 * Palette sourced from DESIGN.md — Apartment Bill Tracker Design System.
 * Primary anchor : Deep Forest Green  #0A4240  (primary-container)
 * Accent/action  : Emerald Green      #036D41  (secondary)
 * Success/leaf   : Vibrant Leaf Green #4CAF50  (tertiary-fixed-dim approx.)
 *
 * Every screen should import `useTheme()` from ThemeContext and call
 *   const { colors } = useTheme();
 * then reference `colors.xxx` in styles.
 */

export const lightColors = {
  // ── Backgrounds ──
  background: "#f8f9ff",           // DESIGN: background / surface-bright
  card: "#ffffff",                 // DESIGN: surface-container-lowest
  cardElevated: "#ffffff",         // DESIGN: surface-container-lowest
  cardAlt: "#eff4ff",              // DESIGN: surface-container-low
  modal: "#ffffff",                // DESIGN: surface-container-lowest
  overlay: "rgba(0,0,0,0.5)",

  // ── Text ──
  text: "#0b1c30",                 // DESIGN: on-surface
  textSecondary: "#404848",        // DESIGN: on-surface-variant
  textTertiary: "#707978",         // DESIGN: outline
  textOnAccent: "#ffffff",         // DESIGN: on-primary / on-secondary
  textOnCard: "#0b1c30",           // DESIGN: on-surface

  // ── Accent (primary interactive color) ──
  accent: "#036d41",               // DESIGN: secondary (Emerald Green)
  accentLight: "rgba(3,109,65,0.08)",
  accentSurface: "#9af2bb",        // DESIGN: secondary-container

  // ── Borders & Dividers ──
  border: "#c0c8c7",               // DESIGN: outline-variant
  borderLight: "#dce9ff",          // DESIGN: surface-container-high
  divider: "#c0c8c7",              // DESIGN: outline-variant

  // ── Inputs ──
  inputBg: "#eff4ff",              // DESIGN: surface-container-low
  inputBorder: "#c0c8c7",          // DESIGN: outline-variant
  inputText: "#0b1c30",            // DESIGN: on-surface
  placeholder: "#707978",          // DESIGN: outline

  // ── Status ──
  success: "#036d41",              // DESIGN: secondary (Emerald Green)
  successBg: "#9af2bb",            // DESIGN: secondary-container
  error: "#ba1a1a",                // DESIGN: error
  errorBg: "#ffdad6",              // DESIGN: error-container
  warning: "#7a5900",              // warm amber — not in DESIGN, kept neutral
  warningBg: "#fff3e0",
  info: "#366664",                 // DESIGN: surface-tint
  infoBg: "#b9ece9",               // DESIGN: primary-fixed
  purpleBg: "#e5eeff",             // DESIGN: surface-container

  // ── Semantic bill-type colours ──
  electricityColor: "#7a5900",     // warm amber, contrasts well on light bg
  waterColor: "#1b4e4c",           // DESIGN: on-primary-fixed-variant
  internetColor: "#005230",        // DESIGN: on-secondary-fixed-variant

  // ── Badges & Tags ──
  badgeBg: "#e5eeff",              // DESIGN: surface-container
  badgeText: "#404848",            // DESIGN: on-surface-variant

  // ── Shadow ──
  shadow: "#0a4240",               // DESIGN: primary-container (green-tinted shadow)

  // ── Navigation ──
  headerBg: "#002b29",             // DESIGN: primary (Deep Forest Green)
  headerText: "#ffffff",           // DESIGN: on-primary
  tabBarBg: "#ffffff",             // DESIGN: surface-container-lowest
  tabBarBorder: "#c0c8c7",         // DESIGN: outline-variant
  tabBarActive: "#036d41",         // DESIGN: secondary
  tabBarInactive: "#707978",       // DESIGN: outline

  // ── StatusBar ──
  statusBarStyle: "dark-content",

  // ── Misc ──
  skeleton: "#cbdbf5",             // DESIGN: surface-dim
  ripple: "rgba(3,109,65,0.08)",   // secondary at low opacity
  iconDefault: "#404848",          // DESIGN: on-surface-variant
};

export const darkColors = {
  // ── Backgrounds ──
  background: "#002b29",           // DESIGN: primary (deepest green — dark canvas)
  card: "#0a4240",                 // DESIGN: primary-container
  cardElevated: "#0d7145",         // DESIGN: on-secondary-container (elevated layer)
  cardAlt: "#00201f",              // DESIGN: on-primary-fixed (darkest surface)
  modal: "#0a4240",                // DESIGN: primary-container
  overlay: "rgba(0,0,0,0.7)",

  // ── Text ──
  text: "#eaf1ff",                 // DESIGN: inverse-on-surface
  textSecondary: "#9ed0cd",        // DESIGN: inverse-primary
  textTertiary: "#7daeab",         // DESIGN: on-primary-container
  textOnAccent: "#ffffff",         // DESIGN: on-secondary
  textOnCard: "#eaf1ff",           // DESIGN: inverse-on-surface

  // ── Accent ──
  accent: "#81d8a3",               // DESIGN: secondary-fixed-dim (bright on dark)
  accentLight: "rgba(129,216,163,0.15)",
  accentSurface: "rgba(129,216,163,0.10)",

  // ── Borders & Dividers ──
  border: "rgba(158,208,205,0.15)",  // inverse-primary at low opacity
  borderLight: "rgba(158,208,205,0.08)",
  divider: "rgba(158,208,205,0.15)",

  // ── Inputs ──
  inputBg: "rgba(255,255,255,0.06)",
  inputBorder: "rgba(158,208,205,0.20)",
  inputText: "#eaf1ff",            // DESIGN: inverse-on-surface
  placeholder: "#7daeab",          // DESIGN: on-primary-container

  // ── Status ──
  success: "#78dc77",              // DESIGN: tertiary-fixed-dim (Vibrant Leaf Green)
  successBg: "rgba(120,220,119,0.15)",
  error: "#ffb4ab",                // lightened error for dark bg readability
  errorBg: "rgba(255,180,171,0.12)",
  warning: "#fbbf24",
  warningBg: "rgba(251,191,36,0.12)",
  info: "#9ed0cd",                 // DESIGN: inverse-primary
  infoBg: "rgba(158,208,205,0.12)",
  purpleBg: "rgba(0,69,14,0.30)",  // DESIGN: tertiary-container at low opacity

  // ── Semantic bill-type colours (brighter on dark) ──
  electricityColor: "#ffd54f",     // bright amber, legible on dark green
  waterColor: "#9ed0cd",           // DESIGN: inverse-primary (teal)
  internetColor: "#94f990",        // DESIGN: tertiary-fixed (bright leaf green)

  // ── Badges & Tags ──
  badgeBg: "rgba(158,208,205,0.12)",
  badgeText: "#9ed0cd",            // DESIGN: inverse-primary

  // ── Shadow ──
  shadow: "#000000",

  // ── Navigation ──
  headerBg: "#002b29",             // DESIGN: primary
  headerText: "#eaf1ff",           // DESIGN: inverse-on-surface
  tabBarBg: "#002b29",             // DESIGN: primary
  tabBarBorder: "rgba(158,208,205,0.10)",
  tabBarActive: "#81d8a3",         // DESIGN: secondary-fixed-dim
  tabBarInactive: "rgba(158,208,205,0.40)",

  // ── StatusBar ──
  statusBarStyle: "light-content",

  // ── Misc ──
  skeleton: "rgba(158,208,205,0.12)",
  ripple: "rgba(129,216,163,0.10)",
  iconDefault: "#9ed0cd",          // DESIGN: inverse-primary
};
