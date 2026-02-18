import React, { useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Dimensions,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeContext";

const { width, height } = Dimensions.get("window");

const SplashScreen = () => {
  const authContext = useContext(AuthContext);
  const { colors, isDark } = useTheme();

  // ── Animations ──
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringScale = useRef(new Animated.Value(0.6)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(30)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(20)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const barOpacity = useRef(new Animated.Value(0)).current;
  const statusOpacity = useRef(new Animated.Value(0)).current;
  const dot1Opacity = useRef(new Animated.Value(0)).current;
  const dot2Opacity = useRef(new Animated.Value(0)).current;
  const dot3Opacity = useRef(new Animated.Value(0)).current;
  const shimmerX = useRef(new Animated.Value(-1)).current;
  const versionOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Use fixed delays instead of Animated.sequence — springs have
    // unpredictable settle times that block the sequence from advancing.

    // Step 1 (0ms): Logo pops in
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 7,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Step 2 (600ms): Ring appears
    const t2 = setTimeout(() => {
      Animated.parallel([
        Animated.spring(ringScale, {
          toValue: 1,
          friction: 6,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(ringOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }, 600);

    // Step 3 (1100ms): Title slides in
    const t3 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(titleY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1100);

    // Step 4 (1550ms): Subtitle slides in
    const t4 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(subtitleY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();
    }, 1550);

    // Step 5 (2000ms): Loading bar + status text + version
    const t5 = setTimeout(() => {
      Animated.parallel([
        Animated.timing(barOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(barWidth, {
          toValue: 1,
          duration: 2200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(statusOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(versionOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start();
    }, 2000);

    const ringPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ringScale, {
          toValue: 1.08,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ringScale, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const ringTimeout = setTimeout(() => ringPulse.start(), 1200);

    const dotLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(dot1Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dot2Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dot3Opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(dot1Opacity, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dot2Opacity, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(dot3Opacity, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    );
    const dotTimeout = setTimeout(() => dotLoop.start(), 2500);

    const shimmerLoop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const shimmerTimeout = setTimeout(() => shimmerLoop.start(), 3000);

    return () => {
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(ringTimeout);
      clearTimeout(dotTimeout);
      clearTimeout(shimmerTimeout);
      ringPulse.stop();
      dotLoop.stop();
      shimmerLoop.stop();
    };
  }, []);

  const barInterpolated = barWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });
  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-120, 260],
  });

  /* ── Theme-adaptive palette ── */
  const gradient = isDark
    ? ["#0f0c29", "#1a1a2e", "#16213e"]
    : ["#f5f6fa", "#ffffff", "#faf8f0"];
  const gold = colors.accent;
  const circleBg = isDark ? "rgba(179,134,4,0.04)" : "rgba(179,134,4,0.06)";
  const ringBorder = isDark ? "rgba(179,134,4,0.5)" : "rgba(179,134,4,0.35)";
  const logoBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(179,134,4,0.06)";
  const logoBorderC = isDark ? "rgba(179,134,4,0.25)" : "rgba(179,134,4,0.18)";
  const titleColor = colors.text;
  const barTrackBg = isDark ? "rgba(255,255,255,0.08)" : "rgba(179,134,4,0.1)";
  const shimmerC = isDark ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.6)";
  const mutedText = isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.35)";
  const versionC = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
  const versionDivC = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)";
  const errBg = isDark ? "rgba(255,107,107,0.12)" : "rgba(211,47,47,0.08)";
  const errBorder = isDark ? "rgba(255,107,107,0.2)" : "rgba(211,47,47,0.15)";
  const errColor = isDark ? "#ff6b6b" : "#d32f2f";

  return (
    <LinearGradient
      colors={gradient}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View
        style={[
          styles.bgCircle,
          styles.bgCircle1,
          { backgroundColor: circleBg },
        ]}
      />
      <View
        style={[
          styles.bgCircle,
          styles.bgCircle2,
          { backgroundColor: circleBg },
        ]}
      />
      <View
        style={[
          styles.bgCircle,
          styles.bgCircle3,
          { backgroundColor: circleBg },
        ]}
      />

      <View style={styles.container}>
        {/* Logo with golden ring */}
        <View style={styles.logoSection}>
          <Animated.View
            style={[
              styles.ring,
              {
                borderColor: ringBorder,
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.logoContainer,
              {
                backgroundColor: logoBg,
                borderColor: logoBorderC,
                transform: [{ scale: logoScale }],
                opacity: logoOpacity,
              },
            ]}
          >
            <Image source={require("../assets/icon.png")} style={styles.logo} />
          </Animated.View>
        </View>

        {/* Title */}
        <Animated.Text
          style={[
            styles.title,
            {
              color: titleColor,
              transform: [{ translateY: titleY }],
              opacity: titleOpacity,
            },
          ]}
        >
          Apartment Bill{"\n"}Tracker
        </Animated.Text>

        {/* Subtitle */}
        <Animated.Text
          style={[
            styles.subtitle,
            {
              color: gold,
              transform: [{ translateY: subtitleY }],
              opacity: subtitleOpacity,
            },
          ]}
        >
          Smart Billing for Shared Living
        </Animated.Text>

        {/* Loading bar */}
        <Animated.View
          style={[
            styles.barTrack,
            { backgroundColor: barTrackBg, opacity: barOpacity },
          ]}
        >
          <Animated.View
            style={[
              styles.barFill,
              { backgroundColor: gold, width: barInterpolated },
            ]}
          >
            <Animated.View
              style={[
                styles.shimmer,
                {
                  backgroundColor: shimmerC,
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
          </Animated.View>
        </Animated.View>

        {/* Status text with animated dots */}
        <Animated.View style={[styles.statusRow, { opacity: statusOpacity }]}>
          <Ionicons name="shield-checkmark" size={14} color={gold} />
          <Text style={[styles.statusText, { color: mutedText }]}>
            Loading user data
          </Text>
          <Animated.Text
            style={[styles.dotText, { color: mutedText, opacity: dot1Opacity }]}
          >
            .
          </Animated.Text>
          <Animated.Text
            style={[styles.dotText, { color: mutedText, opacity: dot2Opacity }]}
          >
            .
          </Animated.Text>
          <Animated.Text
            style={[styles.dotText, { color: mutedText, opacity: dot3Opacity }]}
          >
            .
          </Animated.Text>
        </Animated.View>

        {/* Error Message */}
        {authContext?.state?.error && authContext?.isLoading === false && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: errBg, borderColor: errBorder },
            ]}
          >
            <Ionicons name="alert-circle" size={16} color={errColor} />
            <Text style={[styles.errorText, { color: errColor }]}>
              {authContext.state.error}
            </Text>
          </View>
        )}
      </View>

      {/* Version at bottom */}
      <Animated.View style={[styles.versionRow, { opacity: versionOpacity }]}>
        <Text style={[styles.versionText, { color: versionC }]}>
          Version {Constants.expoConfig?.version || "1.0.0"}
        </Text>
        <View
          style={[styles.versionDivider, { backgroundColor: versionDivC }]}
        />
        <Text style={[styles.versionText, { color: versionC }]}>
          ApartmentBillTracker
        </Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: { flex: 1, width: "100%", height: "100%" },
  bgCircle: { position: "absolute", borderRadius: 999 },
  bgCircle1: { width: 340, height: 340, top: -60, right: -80 },
  bgCircle2: { width: 240, height: 240, bottom: 60, left: -60 },
  bgCircle3: { width: 160, height: 160, top: height * 0.4, right: -40 },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logoSection: {
    marginBottom: 40,
    justifyContent: "center",
    alignItems: "center",
    width: 170,
    height: 170,
  },
  ring: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2.5,
    backgroundColor: "transparent",
  },
  logoContainer: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#b38604",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: "hidden",
  },
  logo: { width: 100, height: 100, resizeMode: "contain" },
  title: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: 0.5,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: 50,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  barTrack: { width: 220, height: 4, borderRadius: 2, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 2, overflow: "hidden" },
  shimmer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 60,
    height: "100%",
    borderRadius: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    gap: 6,
  },
  statusText: { fontSize: 13, fontWeight: "500" },
  dotText: { fontSize: 18, fontWeight: "700", marginLeft: -2 },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  errorText: { fontSize: 12, fontWeight: "500", flex: 1 },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 60,
    gap: 10,
  },
  versionText: { fontSize: 11, fontWeight: "500", letterSpacing: 0.5 },
  versionDivider: { width: 3, height: 3, borderRadius: 1.5 },
});

export default SplashScreen;
