import React, { useRef, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Animated,
  FlatList,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../theme/ThemeContext";

const { width, height } = Dimensions.get("window");
const ONBOARDING_KEY = "@onboarding_completed";

// ── Page Data (theme-aware: built in component) ──
const getPages = (isDark) => [
  {
    id: "1",
    gradient: isDark
      ? ["#0f0c29", "#1a1a2e", "#16213e"]
      : ["#f5f6fa", "#ffffff", "#faf8f0"],
    icon: "receipt-outline",
    bannerIcons: [
      { name: "flash-outline", color: isDark ? "#ffd166" : "#e6a800", x: 0.12, y: 0.08, size: 28 },
      { name: "water-outline", color: isDark ? "#63b3ed" : "#2c7be5", x: 0.82, y: 0.06, size: 24 },
      { name: "wifi-outline", color: isDark ? "#a78bfa" : "#7c3aed", x: 0.88, y: 0.18, size: 22 },
      { name: "home-outline", color: isDark ? "#f87171" : "#dc2626", x: 0.08, y: 0.2, size: 26 },
    ],
    title: "Track Bills\nEffortlessly",
    description:
      "All your apartment bills in one place \u2014 rent, electricity, water, and internet. No more spreadsheets or messy group chats.",
    badge: "BILLING",
    features: [
      { icon: "checkmark-circle", text: "Auto bill breakdown" },
      { icon: "checkmark-circle", text: "Real-time updates" },
      { icon: "checkmark-circle", text: "Detailed receipts" },
    ],
  },
  {
    id: "2",
    gradient: isDark
      ? ["#1a0a2e", "#1e1145", "#16213e"]
      : ["#f8f5ff", "#ffffff", "#f5f0ff"],
    icon: "people-outline",
    bannerIcons: [
      { name: "calculator-outline", color: isDark ? "#fbbf24" : "#d97706", x: 0.1, y: 0.07, size: 26 },
      { name: "pie-chart-outline", color: isDark ? "#34d399" : "#059669", x: 0.85, y: 0.05, size: 28 },
      { name: "calendar-outline", color: isDark ? "#f472b6" : "#db2777", x: 0.9, y: 0.19, size: 22 },
      { name: "trending-up-outline", color: isDark ? "#60a5fa" : "#2563eb", x: 0.06, y: 0.21, size: 24 },
    ],
    title: "Fair Split,\nEvery Time",
    description:
      "Presence-based water billing ensures everyone pays their fair share. Non-payor costs are split automatically among payors.",
    badge: "SPLITTING",
    features: [
      { icon: "checkmark-circle", text: "Presence tracking" },
      { icon: "checkmark-circle", text: "Smart cost splitting" },
      { icon: "checkmark-circle", text: "Penny-accurate math" },
    ],
  },
  {
    id: "3",
    gradient: isDark
      ? ["#0a1628", "#132043", "#1a1a2e"]
      : ["#f0f9ff", "#ffffff", "#f5f6fa"],
    icon: "wallet-outline",
    bannerIcons: [
      { name: "shield-checkmark-outline", color: isDark ? "#4ade80" : "#16a34a", x: 0.11, y: 0.06, size: 28 },
      { name: "notifications-outline", color: isDark ? "#fb923c" : "#ea580c", x: 0.84, y: 0.07, size: 26 },
      { name: "stats-chart-outline", color: isDark ? "#a78bfa" : "#7c3aed", x: 0.88, y: 0.2, size: 24 },
      { name: "card-outline", color: isDark ? "#38bdf8" : "#0284c7", x: 0.07, y: 0.22, size: 22 },
    ],
    title: "Stay on Top\nof Payments",
    description:
      "Track who has paid and who hasn\u2019t. Get payment summaries, settlement history, and never miss a billing cycle again.",
    badge: "PAYMENTS",
    features: [
      { icon: "checkmark-circle", text: "Payment tracking" },
      { icon: "checkmark-circle", text: "Settlement history" },
      { icon: "checkmark-circle", text: "Export & share" },
    ],
  },
];

// ── Floating Icon ──
const FloatingIcon = ({ name, color, x, y, size, delay, isDark }) => {
  const float = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 600,
      delay,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200 + Math.random() * 800,
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200 + Math.random() * 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const bubbleBg = isDark ? color + "15" : color + "12";
  const bubbleBorder = isDark ? color + "25" : color + "20";

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: width * x,
        top: height * y,
        opacity: fadeIn,
        transform: [{ translateY }],
      }}
    >
      <View
        style={{
          width: size + 18,
          height: size + 18,
          borderRadius: (size + 18) / 2,
          backgroundColor: bubbleBg,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: bubbleBorder,
        }}
      >
        <Ionicons name={name} size={size} color={color} />
      </View>
    </Animated.View>
  );
};

// ── Page Component ──
const OnboardingPage = ({ item, index, scrollX, isDark, colors }) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const iconScale = scrollX.interpolate({ inputRange, outputRange: [0.5, 1, 0.5], extrapolate: "clamp" });
  const iconOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });
  const textX = scrollX.interpolate({ inputRange, outputRange: [60, 0, -60], extrapolate: "clamp" });
  const textOpacity = scrollX.interpolate({ inputRange, outputRange: [0, 1, 0], extrapolate: "clamp" });

  const gold = colors.accent;
  const goldBg = isDark ? "rgba(179,134,4,0.12)" : "rgba(179,134,4,0.08)";
  const goldBorder = isDark ? "rgba(179,134,4,0.2)" : "rgba(179,134,4,0.15)";
  const outerBg = isDark ? "rgba(179,134,4,0.08)" : "rgba(179,134,4,0.06)";
  const outerBorder = isDark ? "rgba(179,134,4,0.15)" : "rgba(179,134,4,0.12)";
  const innerBg = isDark ? "rgba(179,134,4,0.1)" : "rgba(179,134,4,0.08)";
  const innerBorder = isDark ? "rgba(179,134,4,0.2)" : "rgba(179,134,4,0.15)";
  const circleBg = isDark ? "rgba(179,134,4,0.03)" : "rgba(179,134,4,0.04)";
  const titleColor = isDark ? "#ffffff" : "#1a1a2e";
  const descColor = isDark ? "rgba(255,255,255,0.55)" : "rgba(0,0,0,0.45)";
  const featureIconBg = isDark ? "rgba(74,222,128,0.1)" : "rgba(22,163,74,0.08)";
  const featureIconColor = isDark ? "#4ade80" : "#16a34a";
  const featureTextColor = isDark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.55)";

  return (
    <View style={{ width }}>
      <LinearGradient
        colors={item.gradient}
        style={styles.pageGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {item.bannerIcons.map((bi, i) => (
          <FloatingIcon key={i} {...bi} delay={i * 200} isDark={isDark} />
        ))}

        <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: circleBg }]} />
        <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: circleBg }]} />

        <View style={styles.pageContent}>
          {/* Badge */}
          <Animated.View style={[styles.badgeRow, { opacity: textOpacity }]}>
            <View style={[styles.badge, { backgroundColor: goldBg, borderColor: goldBorder }]}>
              <Ionicons name="star" size={10} color={gold} />
              <Text style={[styles.badgeText, { color: gold }]}>{item.badge}</Text>
            </View>
          </Animated.View>

          {/* Center icon */}
          <Animated.View
            style={[styles.iconWrap, { transform: [{ scale: iconScale }], opacity: iconOpacity }]}
          >
            <View style={[styles.iconOuter, { backgroundColor: outerBg, borderColor: outerBorder }]}>
              <View style={[styles.iconInner, { backgroundColor: innerBg, borderColor: innerBorder }]}>
                <Ionicons name={item.icon} size={52} color={gold} />
              </View>
            </View>
          </Animated.View>

          {/* Title */}
          <Animated.Text
            style={[
              styles.pageTitle,
              { color: titleColor, transform: [{ translateX: textX }], opacity: textOpacity },
            ]}
          >
            {item.title}
          </Animated.Text>

          {/* Description */}
          <Animated.Text
            style={[
              styles.pageDesc,
              { color: descColor, transform: [{ translateX: textX }], opacity: textOpacity },
            ]}
          >
            {item.description}
          </Animated.Text>

          {/* Feature list */}
          <Animated.View style={[styles.featureList, { opacity: textOpacity }]}>
            {item.features.map((f, i) => (
              <View key={i} style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: featureIconBg }]}>
                  <Ionicons name={f.icon} size={16} color={featureIconColor} />
                </View>
                <Text style={[styles.featureText, { color: featureTextColor }]}>{f.text}</Text>
              </View>
            ))}
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
};

// ── Main Onboarding ──
const OnboardingScreen = ({ onComplete }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const pages = getPages(isDark);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleComplete = useCallback(async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 400,
      useNativeDriver: true,
    }).start(async () => {
      try {
        await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      } catch (e) {
        console.warn("Failed to save onboarding state:", e);
      }
      onComplete?.();
    });
  }, [onComplete, fadeAnim]);

  const goToNext = useCallback(() => {
    if (currentPage < pages.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentPage + 1, animated: true });
    } else {
      handleComplete();
    }
  }, [currentPage, handleComplete]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems?.length > 0) {
      setCurrentPage(viewableItems[0].index ?? 0);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const isLast = currentPage === pages.length - 1;

  const gold = colors.accent;
  const skipColor = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
  const nextCircleBg = isDark ? "rgba(179,134,4,0.25)" : "rgba(179,134,4,0.12)";
  const nextCircleBorder = isDark ? "rgba(179,134,4,0.4)" : "rgba(179,134,4,0.25)";
  const arrowColor = isDark ? "#ffffff" : "#b38604";
  const counterColor = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.2)";
  const rootBg = isDark ? "#0f0c29" : "#f5f6fa";

  return (
    <Animated.View style={[styles.root, { backgroundColor: rootBg, opacity: fadeAnim }]}>
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <OnboardingPage item={item} index={index} scrollX={scrollX} isDark={isDark} colors={colors} />
        )}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={16}
      />

      {/* Bottom controls */}
      <View style={[styles.controls, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}>
        {!isLast ? (
          <TouchableOpacity style={styles.skipBtn} onPress={handleComplete} activeOpacity={0.7}>
            <Text style={[styles.skipText, { color: skipColor }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipBtn} />
        )}

        <View style={styles.dots}>
          {pages.map((_, i) => {
            const dotWidth = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [8, 28, 8],
              extrapolate: "clamp",
            });
            const dotOpacity = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity, backgroundColor: gold }]}
              />
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.nextBtn, isLast && styles.getStartedBtn]}
          onPress={goToNext}
          activeOpacity={0.8}
        >
          {isLast ? (
            <LinearGradient
              colors={["#b38604", "#d4a017"]}
              style={styles.getStartedGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#ffffff" />
            </LinearGradient>
          ) : (
            <View style={[styles.nextCircle, { backgroundColor: nextCircleBg, borderColor: nextCircleBorder }]}>
              <Ionicons name="arrow-forward" size={22} color={arrowColor} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.counterRow}>
        <Text style={[styles.counterText, { color: counterColor }]}>
          {currentPage + 1}/{pages.length}
        </Text>
      </View>
    </Animated.View>
  );
};

// ── Utility ──
export const checkOnboardingComplete = async () => {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === "true";
  } catch {
    return false;
  }
};

export const resetOnboarding = async () => {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore
  }
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  pageGradient: { flex: 1, width, height },
  bgCircle: { position: "absolute", borderRadius: 999 },
  bgCircle1: { width: 300, height: 300, top: -40, right: -60 },
  bgCircle2: { width: 200, height: 200, bottom: 120, left: -50 },
  pageContent: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 36, paddingBottom: 140,
  },
  badgeRow: { marginBottom: 28 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 1.5 },
  iconWrap: { marginBottom: 32 },
  iconOuter: {
    width: 120, height: 120, borderRadius: 60, justifyContent: "center",
    alignItems: "center", borderWidth: 1.5,
  },
  iconInner: {
    width: 88, height: 88, borderRadius: 44, justifyContent: "center",
    alignItems: "center", borderWidth: 1,
  },
  pageTitle: {
    fontSize: 34, fontWeight: "800", textAlign: "center",
    lineHeight: 42, marginBottom: 16,
  },
  pageDesc: {
    fontSize: 15, textAlign: "center", lineHeight: 24,
    marginBottom: 32, paddingHorizontal: 8,
  },
  featureList: { gap: 12, width: "100%", maxWidth: 280 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIconWrap: {
    width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center",
  },
  featureText: { fontSize: 14, fontWeight: "500" },
  // ── Controls ──
  controls: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 16,
  },
  skipBtn: { width: 60 },
  skipText: { fontSize: 15, fontWeight: "600" },
  dots: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { height: 5, borderRadius: 2.5 },
  nextBtn: { width: 60, alignItems: "flex-end" },
  nextCircle: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: "center", alignItems: "center", borderWidth: 1.5,
  },
  getStartedBtn: { width: "auto", alignItems: "flex-end" },
  getStartedGradient: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28,
  },
  getStartedText: { fontSize: 15, fontWeight: "700", color: "#ffffff" },
  counterRow: {
    position: "absolute",
    top: 40,
    right: 24,
  },
  counterText: { fontSize: 12, fontWeight: "600", letterSpacing: 1 },
});

export default OnboardingScreen;
