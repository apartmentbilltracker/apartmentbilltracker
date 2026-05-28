import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";

const { width, height } = Dimensions.get("window");

// ── Forest Green Palette (mirrors colors.js dark tokens) ──────────────────────
const FOREST_BG = "#002b29"; // darkColors.background
const SHEET_BG = "#071a18"; // slightly deeper for the modal sheet
const ACCENT_MINT = "#9af2bb"; // lightColors.accentSurface
const ACCENT_EMERALD = "#81d8a3"; // darkColors.accent
const ACCENT_LEAF = "#78dc77"; // darkColors.success
const TEAL_MUTED = "#9ed0cd"; // darkColors.info
const TEXT_PRI = "#eaf1ff"; // darkColors.text
const TEXT_SEC = "rgba(158,208,205,0.62)";
const CARD_BG = "rgba(255,255,255,0.07)";
const CARD_BORDER = "rgba(158,208,205,0.15)";
const CARD_BORDER_HI = "rgba(129,216,163,0.28)"; // focused input border

// ── Data ───────────────────────────────────────────────────────────────────────
const FLOATING_ICONS = [
  {
    name: "flash-outline",
    color: ACCENT_MINT,
    x: 0.06,
    y: 0.07,
    size: 17,
    delay: 0,
  },
  {
    name: "water-outline",
    color: ACCENT_EMERALD,
    x: 0.8,
    y: 0.06,
    size: 15,
    delay: 200,
  },
  {
    name: "wifi-outline",
    color: TEAL_MUTED,
    x: 0.86,
    y: 0.19,
    size: 13,
    delay: 350,
  },
  {
    name: "home-outline",
    color: ACCENT_LEAF,
    x: 0.04,
    y: 0.21,
    size: 15,
    delay: 100,
  },
  {
    name: "people-outline",
    color: ACCENT_MINT,
    x: 0.74,
    y: 0.31,
    size: 12,
    delay: 450,
  },
  {
    name: "receipt-outline",
    color: ACCENT_EMERALD,
    x: 0.87,
    y: 0.39,
    size: 13,
    delay: 150,
  },
  {
    name: "stats-chart-outline",
    color: TEAL_MUTED,
    x: 0.03,
    y: 0.38,
    size: 14,
    delay: 300,
  },
  {
    name: "key-outline",
    color: ACCENT_LEAF,
    x: 0.7,
    y: 0.5,
    size: 12,
    delay: 250,
  },
];

const FEATURE_PILLS = [
  { icon: "receipt-outline", label: "Track Bills", color: ACCENT_MINT },
  { icon: "people-outline", label: "Split Fairly", color: ACCENT_EMERALD },
  { icon: "business-outline", label: "Manage Units", color: ACCENT_LEAF },
  { icon: "bar-chart-outline", label: "View Reports", color: TEAL_MUTED },
];

// Social button config for AuthModal
const SOCIAL_BTNS = [
  {
    method: "google",
    icon: "logo-google",
    iconColor: "#EA4335",
    tint: "rgba(234,67,53,0.12)",
    tintBorder: "rgba(234,67,53,0.22)",
    label: "Continue with Google",
  },
  {
    method: "apple",
    icon: "logo-apple",
    iconColor: TEXT_PRI,
    tint: "rgba(255,255,255,0.10)",
    tintBorder: "rgba(255,255,255,0.18)",
    label: "Continue with Apple",
  },
  {
    method: "phone",
    icon: "call-outline",
    iconColor: ACCENT_EMERALD,
    tint: "rgba(129,216,163,0.12)",
    tintBorder: "rgba(129,216,163,0.22)",
    label: "Continue with phone",
  },
];

// ── Floating Icon ──────────────────────────────────────────────────────────────
const FloatingIcon = ({ name, color, x, y, size, delay }) => {
  const float = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 700,
      delay,
      useNativeDriver: true,
    }).start();

    const dur = 2600 + Math.random() * 900;
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: dur,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: dur,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    return () => float.stopAnimation();
  }, []);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -11],
  });
  const rotate = float.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-4deg", "0deg", "4deg"],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: width * x,
        top: height * y,
        opacity: fadeIn,
        transform: [{ translateY }, { rotate }],
      }}
    >
      <View
        style={{
          width: size + 18,
          height: size + 18,
          borderRadius: (size + 18) / 2,
          backgroundColor: color + "14",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: color + "28",
        }}
      >
        <Ionicons name={name} size={size} color={color + "90"} />
      </View>
    </Animated.View>
  );
};

// ── Feature Pill ──────────────────────────────────────────────────────────────
const FeaturePill = ({ icon, label, color, delay }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 520,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 1],
  });

  return (
    <Animated.View
      style={[
        pillStyles.pill,
        {
          borderColor: color + "32",
          backgroundColor: color + "10",
          opacity: anim,
          transform: [{ scale }],
        },
      ]}
    >
      <View style={[pillStyles.iconWrap, { backgroundColor: color + "1e" }]}>
        <Ionicons name={icon} size={12} color={color} />
      </View>
      <Text style={[pillStyles.label, { color }]}>{label}</Text>
    </Animated.View>
  );
};

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  label: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
});

// ── Stat Item ─────────────────────────────────────────────────────────────────
const StatItem = ({ value, label, color, delay }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 600,
      delay,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[statStyles.item, { opacity: anim }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </Animated.View>
  );
};

const statStyles = StyleSheet.create({
  item: { alignItems: "center", flex: 1 },
  value: { fontSize: 21, fontWeight: "800", letterSpacing: -0.5 },
  label: {
    fontSize: 11,
    color: "rgba(158,208,205,0.45)",
    fontWeight: "500",
    marginTop: 2,
    letterSpacing: 0.1,
  },
});

// ── Auth Modal Social Button (animated) ───────────────────────────────────────
const SocialButton = ({ item, index, onPress, disabled }) => {
  const anim = useRef(new Animated.Value(0)).current;
  const pressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 420,
      delay: 80 + index * 70,
      useNativeDriver: true,
    }).start();
  }, []);

  const handlePressIn = () =>
    Animated.spring(pressAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  const handlePressOut = () =>
    Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
          { scale: pressAnim },
        ],
      }}
    >
      <TouchableOpacity
        onPress={() => onPress?.(item.method)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled}
        style={ms.socialBtn}
      >
        <View
          style={[
            ms.socialIconPill,
            { backgroundColor: item.tint, borderColor: item.tintBorder },
          ]}
        >
          <Ionicons name={item.icon} size={16} color={item.iconColor} />
        </View>
        <Text style={ms.socialBtnText}>{item.label}</Text>
        <Ionicons name="chevron-forward" size={13} color={TEXT_SEC} />
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Auth Bottom Sheet Modal (redesigned) ──────────────────────────────────────
const AuthModal = ({ visible, onClose, onAuth }) => {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(height)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  const [email, setEmail] = useState("");
  const [mounted, setMounted] = useState(false);
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () =>
    Animated.timing(inputBorderAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
  const handleBlur = () =>
    Animated.timing(inputBorderAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start();

  const inputBorderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_BORDER, CARD_BORDER_HI],
  });

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 65,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.stagger(60, [
          Animated.timing(logoAnim, {
            toValue: 1,
            duration: 380,
            useNativeDriver: true,
          }),
          Animated.timing(formAnim, {
            toValue: 1,
            duration: 420,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else if (mounted) {
      logoAnim.setValue(0);
      formAnim.setValue(0);
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: height,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 0,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start(() => setMounted(false));
    }
  }, [visible]);

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* ── Backdrop ── */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdrop }]}>
        <TouchableOpacity
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(0,0,0,0.68)" },
          ]}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* ── Sheet ── */}
      <Animated.View
        style={[
          ms.sheet,
          { paddingBottom: insets.bottom + 20, transform: [{ translateY }] },
        ]}
      >
        {/* ── Forest-green ambient texture inside the sheet ── */}
        <View style={ms.sheetBg} pointerEvents="none">
          <LinearGradient
            colors={["rgba(129,216,163,0.09)", "rgba(129,216,163,0)"]}
            style={[ms.sheetOrb, ms.sheetOrbTR]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
          <LinearGradient
            colors={["rgba(3,109,65,0.10)", "rgba(3,109,65,0)"]}
            style={[ms.sheetOrb, ms.sheetOrbBL]}
            start={{ x: 0.5, y: 0.5 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={ms.sheetBand} />
          <View style={ms.sheetGrid}>
            {Array.from({ length: 15 }).map((_, i) => (
              <View
                key={i}
                style={[
                  ms.sheetTile,
                  {
                    opacity: i % 3 === 0 ? 0.75 : 0.38,
                    backgroundColor:
                      i % 5 === 0
                        ? "rgba(129,216,163,0.06)"
                        : "rgba(255,255,255,0.028)",
                    borderColor:
                      i % 5 === 0
                        ? "rgba(129,216,163,0.14)"
                        : "rgba(158,208,205,0.09)",
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── Drag handle ── */}
        <View style={ms.handleWrap}>
          <LinearGradient
            colors={[ACCENT_EMERALD + "44", ACCENT_EMERALD + "14"]}
            style={ms.handle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>

        {/* ── Close button ── */}
        <TouchableOpacity
          style={ms.closeBtn}
          onPress={onClose}
          activeOpacity={0.75}
        >
          <View style={ms.closeBtnInner}>
            <Ionicons name="close" size={16} color={TEAL_MUTED} />
          </View>
        </TouchableOpacity>

        {/* ── BillTrack micro-logo ── */}
        <Animated.View
          style={[
            ms.logoRow,
            {
              opacity: logoAnim,
              transform: [
                {
                  translateY: logoAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-10, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={ms.logoIconWrap}>
            <LinearGradient
              colors={["#036d41", "#81d8a3"]}
              style={ms.logoIconGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="leaf" size={11} color="#002b29" />
            </LinearGradient>
          </View>
          <Text style={ms.logoText}>PropFlow</Text>
        </Animated.View>

        {/* ── Title ── */}
        <Animated.View
          style={{
            opacity: logoAnim,
            transform: [
              {
                translateY: logoAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [8, 0],
                }),
              },
            ],
          }}
        >
          <Text style={ms.title}>Log in or sign up</Text>
          <Text style={ms.subtitle}>
            Track bills, split costs fairly,{"\n"}and manage your property — all
            in one place.
          </Text>
        </Animated.View>

        {/* ── Social buttons ── */}
        <View style={ms.socialList}>
          {SOCIAL_BTNS.map((item, i) => (
            <SocialButton
              key={item.method}
              item={item}
              index={i}
              onPress={onAuth}
            />
          ))}
        </View>

        {/* ── OR divider ── */}
        <Animated.View
          style={[
            ms.orRow,
            {
              opacity: formAnim,
              transform: [
                {
                  scaleX: formAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.88, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={ms.orLine} />
          <View style={ms.orPill}>
            <Text style={ms.orText}>OR</Text>
          </View>
          <View style={ms.orLine} />
        </Animated.View>

        {/* ── Email input + Continue ── */}
        <Animated.View
          style={{
            opacity: formAnim,
            transform: [
              {
                translateY: formAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          }}
        >
          <Animated.View
            style={[ms.inputWrap, { borderColor: inputBorderColor }]}
          >
            <Ionicons
              name="mail-outline"
              size={16}
              color={TEAL_MUTED}
              style={ms.inputIcon}
            />
            <TextInput
              style={ms.input}
              placeholder="Email address"
              placeholderTextColor="rgba(158,208,205,0.34)"
              value={email}
              onChangeText={setEmail}
              onFocus={handleFocus}
              onBlur={handleBlur}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {email.length > 0 && (
              <TouchableOpacity
                onPress={() => setEmail("")}
                activeOpacity={0.7}
                style={ms.inputClearBtn}
              >
                <Ionicons name="close-circle" size={16} color={TEXT_SEC} />
              </TouchableOpacity>
            )}
          </Animated.View>

          <TouchableOpacity
            style={[ms.continueBtn, !email.length && { opacity: 0.45 }]}
            onPress={() => email && onAuth?.("email", email)}
            activeOpacity={0.85}
            disabled={!email.length}
          >
            <LinearGradient
              colors={["#036d41", "#81d8a3"]}
              style={ms.continueBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={ms.continueBtnText}>Continue</Text>
              <View style={ms.continueBtnArrow}>
                <Ionicons name="arrow-forward" size={14} color="#002b29" />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={ms.terms}>
            By continuing, you agree to our{" "}
            <Text style={ms.termsLink}>Terms of Service</Text> and{" "}
            <Text style={ms.termsLink}>Privacy Policy</Text>.
          </Text>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

// ── Modal Styles ──────────────────────────────────────────────────────────────
const ms = StyleSheet.create({
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: SHEET_BG,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderBottomWidth: 0,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 30,
    elevation: 28,
  },
  sheetBg: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  sheetOrb: { position: "absolute", borderRadius: 9999 },
  sheetOrbTR: { width: 220, height: 220, top: -80, right: -60 },
  sheetOrbBL: { width: 190, height: 190, bottom: 20, left: -60 },
  sheetBand: {
    position: "absolute",
    width: "150%",
    height: 50,
    backgroundColor: "rgba(129,216,163,0.04)",
    top: "38%",
    left: "-20%",
    transform: [{ rotate: "-10deg" }],
    borderRadius: 4,
  },
  sheetGrid: {
    position: "absolute",
    top: 16,
    right: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    width: 5 * (18 + 5) - 5,
    gap: 5,
    transform: [{ rotate: "-6deg" }],
  },
  sheetTile: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    transform: [{ rotate: "45deg" }],
  },

  handleWrap: { alignItems: "center", marginBottom: 18, paddingTop: 4 },
  handle: { width: 40, height: 4, borderRadius: 2 },

  closeBtn: { position: "absolute", top: 18, right: 18, zIndex: 10 },
  closeBtnInner: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(158,208,205,0.08)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(158,208,205,0.14)",
  },

  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginBottom: 12,
  },
  logoIconWrap: { borderRadius: 8, overflow: "hidden" },
  logoIconGradient: {
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: {
    fontSize: 13,
    fontWeight: "700",
    color: TEAL_MUTED,
    letterSpacing: 0.3,
  },

  title: {
    fontSize: 24,
    fontWeight: "800",
    color: TEXT_PRI,
    textAlign: "center",
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_SEC,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 22,
  },

  socialList: { gap: 9, marginBottom: 4 },
  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  socialIconPill: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  socialBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_PRI,
    letterSpacing: 0.1,
  },

  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    gap: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "rgba(158,208,205,0.09)" },
  orPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: "rgba(158,208,205,0.06)",
    borderWidth: 1,
    borderColor: "rgba(158,208,205,0.10)",
  },
  orText: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(158,208,205,0.30)",
    letterSpacing: 1.8,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    backgroundColor: CARD_BG,
    marginBottom: 12,
    paddingHorizontal: 14,
    overflow: "hidden",
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: Platform.OS === "ios" ? 16 : 13,
    fontSize: 14,
    color: TEXT_PRI,
    letterSpacing: 0.1,
  },
  inputClearBtn: { padding: 4 },

  continueBtn: { borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  continueBtnGradient: {
    flexDirection: "row",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  continueBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#002b29",
    letterSpacing: 0.2,
  },
  continueBtnArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,43,41,0.22)",
    justifyContent: "center",
    alignItems: "center",
  },

  terms: {
    fontSize: 11,
    color: "rgba(158,208,205,0.26)",
    textAlign: "center",
    lineHeight: 17,
  },
  termsLink: {
    color: ACCENT_EMERALD + "99",
    textDecorationLine: "underline",
    textDecorationColor: ACCENT_EMERALD + "44",
  },
});

// ── Main Landing Screen ────────────────────────────────────────────────────────
const LandingScreen = ({ onGetStarted, onAuthSuccess }) => {
  // eslint-disable-next-line no-unused-vars
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [showModal, setShowModal] = useState(false);

  const logoAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const textAnim = useRef(new Animated.Value(0)).current;
  const pillsAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const ctaScale = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(110, [
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 580,
        useNativeDriver: true,
      }),
      Animated.timing(heroAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(textAnim, {
        toValue: 1,
        duration: 580,
        useNativeDriver: true,
      }),
      Animated.timing(pillsAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.timing(statsAnim, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true,
      }),
      Animated.timing(ctaAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ctaScale, {
          toValue: 1.026,
          duration: 1700,
          useNativeDriver: true,
        }),
        Animated.timing(ctaScale, {
          toValue: 1,
          duration: 1700,
          useNativeDriver: true,
        }),
      ]),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });
  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.09, 0.2, 0.09],
  });

  const handleAuth = (method, data) => {
    setShowModal(false);
    onAuthSuccess?.(method, data);
    onGetStarted?.();
  };

  return (
    <View style={ls.root}>
      <StatusBar barStyle="light-content" backgroundColor={FOREST_BG} />

      <LinearGradient
        colors={["#001e1c", "#002b29", "#003330"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 260,
          height: 260,
          borderRadius: 130,
          backgroundColor: ACCENT_MINT + "0B",
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: height * 0.28,
          left: -50,
          width: 190,
          height: 190,
          borderRadius: 95,
          backgroundColor: ACCENT_EMERALD + "08",
        }}
      />

      {FLOATING_ICONS.map((fi, i) => (
        <FloatingIcon key={i} {...fi} />
      ))}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            ls.content,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 20 },
          ]}
        >
          {/* ─── Logo Row ─── */}
          <Animated.View
            style={[
              ls.logoRow,
              {
                opacity: logoAnim,
                transform: [
                  {
                    translateY: logoAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-18, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={ls.logoIconWrap}>
              <LinearGradient
                colors={["#036d41", "#81d8a3"]}
                style={ls.logoIconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="leaf" size={19} color="#002b29" />
              </LinearGradient>
            </View>
            <Text style={ls.appName}>PropFlow</Text>
            <View style={ls.betaBadge}>
              <Text style={ls.betaText}>BETA</Text>
            </View>
          </Animated.View>

          {/* ─── Hero Zone ─── */}
          <Animated.View
            style={[
              ls.heroZone,
              {
                opacity: heroAnim,
                transform: [
                  {
                    scale: heroAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.88, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: width * 0.7,
                height: width * 0.7,
                borderRadius: width * 0.35,
                borderWidth: 1,
                borderColor: ACCENT_MINT,
                opacity: ringOpacity,
                transform: [{ scale: ringScale }],
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: width * 0.5,
                height: width * 0.5,
                borderRadius: width * 0.25,
                borderWidth: 1,
                borderColor: ACCENT_MINT + "1C",
              }}
            />

            <View style={ls.centralBadge}>
              <LinearGradient
                colors={["#036d41", "#0a4240"]}
                style={ls.centralGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons
                  name="receipt-outline"
                  size={30}
                  color={ACCENT_MINT}
                />
              </LinearGradient>
            </View>

            {[
              {
                label: "Electric",
                icon: "flash",
                color: ACCENT_MINT,
                style: ls.orbitTL,
              },
              {
                label: "Water",
                icon: "water",
                color: ACCENT_EMERALD,
                style: ls.orbitTR,
              },
              {
                label: "Internet",
                icon: "wifi",
                color: TEAL_MUTED,
                style: ls.orbitBL,
              },
              {
                label: "Rent",
                icon: "home",
                color: ACCENT_LEAF,
                style: ls.orbitBR,
              },
            ].map(({ label, icon, color, style }) => (
              <View key={label} style={[ls.orbitCard, style]}>
                <View
                  style={[ls.orbitCardInner, { borderColor: color + "2E" }]}
                >
                  <Ionicons name={icon} size={11} color={color} />
                  <Text style={[ls.orbitCardText, { color }]}>{label}</Text>
                </View>
              </View>
            ))}
          </Animated.View>

          {/* ─── Hero Text ─── */}
          <Animated.View
            style={{
              opacity: textAnim,
              transform: [
                {
                  translateY: textAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [18, 0],
                  }),
                },
              ],
              alignItems: "center",
              paddingHorizontal: 24,
            }}
          >
            <Text style={ls.heroTitle}>
              Property Bills,{"\n"}
              <Text style={{ color: ACCENT_MINT }}>Organised</Text> & Split
            </Text>
            <Text style={ls.heroDesc}>
              Track every utility, split water bills by presence, and manage all
              your units — effortlessly.
            </Text>
          </Animated.View>

          {/* ─── Feature Pills ─── */}
          <Animated.View
            style={[
              ls.pillsRow,
              {
                opacity: pillsAnim,
                transform: [
                  {
                    translateY: pillsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {FEATURE_PILLS.map((f, i) => (
              <FeaturePill key={f.label} {...f} delay={i * 55} />
            ))}
          </Animated.View>

          {/* ─── Stats Card ─── */}
          <Animated.View
            style={[
              ls.statsCard,
              {
                opacity: statsAnim,
                transform: [
                  {
                    translateY: statsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <StatItem
              value="100%"
              label="Transparent"
              color={ACCENT_MINT}
              delay={200}
            />
            <View style={ls.statDivider} />
            <StatItem
              value="Fair"
              label="Water Split"
              color={ACCENT_EMERALD}
              delay={300}
            />
            <View style={ls.statDivider} />
            <StatItem
              value="All"
              label="Bill Types"
              color={TEAL_MUTED}
              delay={400}
            />
          </Animated.View>

          {/* ─── CTA ─── */}
          <Animated.View
            style={[
              ls.ctaWrap,
              {
                opacity: ctaAnim,
                transform: [
                  {
                    translateY: ctaAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [18, 0],
                    }),
                  },
                  { scale: ctaScale },
                ],
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => {
                setShowModal(true);
              }}
              activeOpacity={0.87}
              style={{ borderRadius: 18, overflow: "hidden", width: "100%" }}
            >
              <LinearGradient
                colors={["#036d41", "#81d8a3"]}
                style={ls.ctaBtn}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={ls.ctaBtnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={17} color="#002b29" />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={ls.ctaNote}>
              Free to use · No credit card required
            </Text>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <AuthModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onAuth={handleAuth}
      />
    </View>
  );
};

// ── Landing Screen Styles ─────────────────────────────────────────────────────
const ls = StyleSheet.create({
  root: { flex: 1, backgroundColor: FOREST_BG },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "flex-start",
    marginLeft: 4,
  },
  logoIconWrap: { borderRadius: 12, overflow: "hidden" },
  logoIconGradient: {
    width: 38,
    height: 38,
    justifyContent: "center",
    alignItems: "center",
  },
  appName: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT_PRI,
    letterSpacing: -0.5,
  },
  betaBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: ACCENT_MINT + "16",
    borderWidth: 1,
    borderColor: ACCENT_MINT + "2E",
  },
  betaText: {
    fontSize: 9,
    fontWeight: "800",
    color: ACCENT_MINT,
    letterSpacing: 1,
  },
  heroZone: {
    width: width * 0.76,
    height: width * 0.7,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  centralBadge: {
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: ACCENT_MINT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 12,
  },
  centralGradient: {
    width: 74,
    height: 74,
    justifyContent: "center",
    alignItems: "center",
  },
  orbitCard: { position: "absolute" },
  orbitTL: { top: "13%", left: "3%" },
  orbitTR: { top: "11%", right: "1%" },
  orbitBL: { bottom: "15%", left: "5%" },
  orbitBR: { bottom: "13%", right: "3%" },
  orbitCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  orbitCardText: { fontSize: 10, fontWeight: "700" },
  heroTitle: {
    fontSize: 29,
    fontWeight: "800",
    color: TEXT_PRI,
    textAlign: "center",
    lineHeight: 35,
    letterSpacing: -0.8,
    marginBottom: 9,
  },
  heroDesc: {
    fontSize: 13,
    color: TEXT_SEC,
    textAlign: "center",
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  statsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    width: "100%",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(158,208,205,0.10)",
  },
  ctaWrap: { width: "100%", alignItems: "center", gap: 9 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 48,
  },
  ctaBtnText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#002b29",
    letterSpacing: 0.2,
  },
  ctaNote: {
    fontSize: 11,
    color: "rgba(158,208,205,0.32)",
    letterSpacing: 0.3,
  },
});

export default LandingScreen;
