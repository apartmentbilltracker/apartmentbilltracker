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
const BASE_PANEL_HEIGHT = height * 0.50;

// ── Forest Green Palette (sourced from colors.js dark tokens) ─────────────────
// Primary canvas    : #002b29  (colors.darkColors.background)
// Primary container : #0a4240  (colors.darkColors.card)
// Accent mint       : #9af2bb  (colors.lightColors.accentSurface / secondary-container)
// Accent emerald    : #81d8a3  (colors.darkColors.accent / secondary-fixed-dim)
// Leaf green        : #78dc77  (colors.darkColors.success / tertiary-fixed-dim)
// Teal muted        : #9ed0cd  (colors.darkColors.info / inverse-primary)
// Deep teal text    : #7daeab  (colors.darkColors.textTertiary)

// ── Page data ──────────────────────────────────────────────────────────────────
const getPages = () => [
  {
    id: "1",
    // Deep forest gradient — all three stops from colors.darkColors family
    gradient: ["#001e1c", "#002b29", "#003330"],
    accentColor: "#9af2bb",         // secondary-container (bright mint)
    icon: "receipt-outline",
    badge: "BILLING",
    title: "Every Bill,\nOrganised",
    description:
      "Electricity, water, internet, and rent — all your property bills tracked in one clean dashboard.",
    features: [
      { icon: "layers-outline",          text: "Categorised bill cycles",   color: "#9af2bb" },
      { icon: "sync-outline",            text: "Real-time cycle updates",   color: "#81d8a3" },
      { icon: "document-text-outline",   text: "Detailed digital receipts", color: "#9ed0cd" },
    ],
    floatingIcons: [
      { name: "flash-outline",          color: "#9af2bb", x: 0.08, y: 0.09, size: 20, delay: 0   },
      { name: "water-outline",          color: "#81d8a3", x: 0.82, y: 0.07, size: 18, delay: 150 },
      { name: "wifi-outline",           color: "#9ed0cd", x: 0.87, y: 0.22, size: 16, delay: 300 },
      { name: "home-outline",           color: "#7daeab", x: 0.06, y: 0.24, size: 18, delay: 450 },
      { name: "card-outline",           color: "#78dc77", x: 0.75, y: 0.35, size: 14, delay: 200 },
    ],
    mockCard: "bills",
  },
  {
    id: "2",
    gradient: ["#001e1c", "#002b29", "#003330"],
    accentColor: "#81d8a3",         // secondary-fixed-dim (rich emerald on dark)
    icon: "people-outline",
    badge: "SPLITTING",
    title: "Fair Share,\nEvery Month",
    description:
      "Presence-based water billing means everyone pays only for the days they were actually home.",
    features: [
      { icon: "calendar-outline",       text: "Presence day tracking",     color: "#81d8a3" },
      { icon: "git-branch-outline",     text: "Auto cost distribution",    color: "#9af2bb" },
      { icon: "checkmark-done-outline", text: "Transparent breakdowns",    color: "#9ed0cd" },
    ],
    floatingIcons: [
      { name: "calculator-outline",     color: "#9af2bb", x: 0.07, y: 0.08, size: 20, delay: 0   },
      { name: "pie-chart-outline",      color: "#81d8a3", x: 0.83, y: 0.06, size: 22, delay: 200 },
      { name: "calendar-outline",       color: "#9ed0cd", x: 0.88, y: 0.22, size: 16, delay: 350 },
      { name: "trending-up-outline",    color: "#78dc77", x: 0.05, y: 0.25, size: 18, delay: 100 },
      { name: "people-outline",         color: "#7daeab", x: 0.78, y: 0.34, size: 14, delay: 250 },
    ],
    mockCard: "split",
  },
  {
    id: "3",
    gradient: ["#001e1c", "#002b29", "#003330"],
    accentColor: "#78dc77",         // tertiary-fixed-dim (vibrant leaf green)
    icon: "business-outline",
    badge: "PROPERTY",
    title: "Manage Your\nProperty Smartly",
    description:
      "Track units, tenants, and billing cycles — everything a landlord or property manager needs.",
    features: [
      { icon: "key-outline",            text: "Unit & tenant overview",    color: "#78dc77" },
      { icon: "time-outline",           text: "Billing cycle history",     color: "#81d8a3" },
      { icon: "share-outline",          text: "Export & share reports",    color: "#9ed0cd" },
    ],
    floatingIcons: [
      { name: "shield-checkmark-outline", color: "#78dc77", x: 0.08, y: 0.07, size: 20, delay: 0   },
      { name: "notifications-outline",    color: "#9af2bb", x: 0.82, y: 0.06, size: 18, delay: 200 },
      { name: "stats-chart-outline",      color: "#81d8a3", x: 0.87, y: 0.21, size: 16, delay: 350 },
      { name: "key-outline",              color: "#9ed0cd", x: 0.06, y: 0.23, size: 18, delay: 100 },
      { name: "checkmark-circle-outline", color: "#7daeab", x: 0.76, y: 0.35, size: 14, delay: 250 },
    ],
    mockCard: "property",
  },
];

// ── Mock UI Cards ──────────────────────────────────────────────────────────────
// Shared glass-card style values
const CARD_BG     = "rgba(255,255,255,0.08)";
const CARD_BORDER = "rgba(158,208,205,0.18)";   // inverse-primary at low opacity
const TEXT_PRI    = "#eaf1ff";                   // colors.darkColors.text
const TEXT_SEC    = "rgba(158,208,205,0.65)";    // toned-down inverse-primary
const DIVIDER     = "rgba(158,208,205,0.10)";

// Page 1 – Bill cycle overview (no amounts, status-based)
const MockBillsCard = ({ accentColor }) => {
  const bills = [
    { icon: "flash-outline",  label: "Electricity", status: "Active",  statusColor: "#81d8a3" },
    { icon: "water-outline",  label: "Water",        status: "Active",  statusColor: "#81d8a3" },
    { icon: "wifi-outline",   label: "Internet",     status: "Pending", statusColor: "#9af2bb" },
    { icon: "home-outline",   label: "Rent",         status: "Due",     statusColor: "#ffb4ab" },
  ];

  return (
    <View style={[mockStyles.card, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
      {/* Header */}
      <View style={mockStyles.cardHeader}>
        <View style={[mockStyles.cardIconWrap, { backgroundColor: accentColor + "22" }]}>
          <Ionicons name="receipt-outline" size={14} color={accentColor} />
        </View>
        <Text style={[mockStyles.cardTitle, { color: TEXT_PRI }]}>Current Cycle</Text>
        <View style={[mockStyles.cardBadge, { backgroundColor: accentColor + "20" }]}>
          <Text style={[mockStyles.cardBadgeText, { color: accentColor }]}>Open</Text>
        </View>
      </View>
      <View style={[mockStyles.cardDivider, { backgroundColor: DIVIDER }]} />

      {/* Bill rows */}
      {bills.map((b, i) => (
        <View key={i} style={mockStyles.billRow}>
          <View style={[mockStyles.billIconWrap, { backgroundColor: accentColor + "18" }]}>
            <Ionicons name={b.icon} size={11} color={accentColor} />
          </View>
          <Text style={[mockStyles.billLabel, { color: TEXT_SEC }]}>{b.label}</Text>
          <View style={[mockStyles.statusPill, { backgroundColor: b.statusColor + "22" }]}>
            <Text style={[mockStyles.statusPillText, { color: b.statusColor }]}>{b.status}</Text>
          </View>
        </View>
      ))}

      {/* Footer tally */}
      <View style={[mockStyles.cardDivider, { backgroundColor: DIVIDER }]} />
      <View style={mockStyles.billRow}>
        <Ionicons name="checkmark-circle-outline" size={13} color="#81d8a3" />
        <Text style={[mockStyles.billLabel, { color: TEXT_SEC, flex: 1, marginLeft: 4 }]}>
          3 of 4 bills confirmed
        </Text>
        <Text style={[mockStyles.cycleBadge, { color: accentColor }]}>75%</Text>
      </View>
    </View>
  );
};

// Page 2 – Presence-based split (no currency amounts)
const MockSplitCard = ({ accentColor }) => {
  const members = [
    { initial: "A", days: 28, color: "#81d8a3", status: "settled" },
    { initial: "B", days: 20, color: "#9af2bb", status: "settled" },
    { initial: "C", days: 12, color: "#9ed0cd", status: "pending" },
  ];
  const totalDays = members.reduce((s, m) => s + m.days, 0);

  return (
    <View style={[mockStyles.card, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
      <View style={mockStyles.cardHeader}>
        <View style={[mockStyles.cardIconWrap, { backgroundColor: accentColor + "22" }]}>
          <Ionicons name="water-outline" size={14} color={accentColor} />
        </View>
        <Text style={[mockStyles.cardTitle, { color: TEXT_PRI }]}>Water Split</Text>
        <Text style={[mockStyles.cardSubtitle, { color: TEXT_SEC }]}>{totalDays} days total</Text>
      </View>
      <View style={[mockStyles.cardDivider, { backgroundColor: DIVIDER }]} />

      {/* Segmented presence bar */}
      <View style={mockStyles.splitBarWrap}>
        {members.map((m, i) => (
          <View
            key={i}
            style={[
              mockStyles.splitBarSegment,
              {
                flex: m.days / totalDays,
                backgroundColor: m.color + "cc",
              },
              i === 0 && { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
              i === members.length - 1 && { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
            ]}
          />
        ))}
      </View>

      {/* Member rows */}
      {members.map((m, i) => (
        <View key={i} style={mockStyles.billRow}>
          <View style={[mockStyles.splitAvatar, { backgroundColor: m.color + "22", borderColor: m.color + "44" }]}>
            <Text style={[mockStyles.splitAvatarText, { color: m.color }]}>{m.initial}</Text>
          </View>
          <Text style={[mockStyles.billLabel, { color: TEXT_SEC }]}>{m.days} days</Text>
          <Text style={[mockStyles.sharePercent, { color: TEXT_PRI }]}>
            {Math.round((m.days / totalDays) * 100)}%
          </Text>
          {m.status === "settled"
            ? <Ionicons name="checkmark-circle" size={13} color="#81d8a3" style={{ marginLeft: 4 }} />
            : <Ionicons name="time-outline" size={13} color="#9af2bb" style={{ marginLeft: 4 }} />
          }
        </View>
      ))}
    </View>
  );
};

// Page 3 – Property / unit management (no amounts)
const MockPropertyCard = ({ accentColor }) => {
  const units = [
    { icon: "bed-outline",       label: "Unit 1A",  tenant: "Alex R.",  statusText: "Paid",    statusColor: "#81d8a3",  dotColor: "#81d8a3"  },
    { icon: "bed-outline",       label: "Unit 1B",  tenant: "Bianca M.", statusText: "Due",     statusColor: "#9af2bb",  dotColor: "#9af2bb"  },
    { icon: "business-outline",  label: "Unit 2A",  tenant: "Carlos T.", statusText: "Overdue", statusColor: "#ffb4ab",  dotColor: "#ffb4ab"  },
  ];
  const paidCount = units.filter((u) => u.statusText === "Paid").length;

  return (
    <View style={[mockStyles.card, { backgroundColor: CARD_BG, borderColor: CARD_BORDER }]}>
      {/* Header */}
      <View style={mockStyles.cardHeader}>
        <View style={[mockStyles.cardIconWrap, { backgroundColor: accentColor + "22" }]}>
          <Ionicons name="business-outline" size={14} color={accentColor} />
        </View>
        <Text style={[mockStyles.cardTitle, { color: TEXT_PRI }]}>My Property</Text>
        <Text style={[mockStyles.cardSubtitle, { color: accentColor }]}>
          {paidCount}/{units.length} settled
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[mockStyles.progressBg, { backgroundColor: "rgba(158,208,205,0.12)" }]}>
        <View
          style={[
            mockStyles.progressFill,
            { width: `${(paidCount / units.length) * 100}%`, backgroundColor: accentColor },
          ]}
        />
      </View>
      <View style={[mockStyles.cardDivider, { backgroundColor: DIVIDER }]} />

      {/* Unit rows */}
      {units.map((u, i) => (
        <View key={i} style={mockStyles.billRow}>
          <View style={[mockStyles.unitDot, { backgroundColor: u.dotColor }]} />
          <View style={{ flex: 1 }}>
            <Text style={[mockStyles.unitLabel, { color: TEXT_PRI }]}>{u.label}</Text>
            <Text style={[mockStyles.unitTenant, { color: TEXT_SEC }]}>{u.tenant}</Text>
          </View>
          <View style={[mockStyles.statusPill, { backgroundColor: u.statusColor + "20" }]}>
            <Text style={[mockStyles.statusPillText, { color: u.statusColor }]}>{u.statusText}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const mockStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    width: width * 0.72,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  cardSubtitle: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    marginVertical: 2,
  },
  billRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  billIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  billLabel: {
    fontSize: 12,
    flex: 1,
  },
  cycleBadge: {
    fontSize: 13,
    fontWeight: "800",
  },
  sharePercent: {
    fontSize: 12,
    fontWeight: "700",
  },
  splitBarWrap: {
    height: 8,
    flexDirection: "row",
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 2,
    gap: 1,
  },
  splitBarSegment: {
    height: "100%",
  },
  splitAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  splitAvatarText: {
    fontSize: 10,
    fontWeight: "800",
  },
  progressBg: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
    marginTop: 2,
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  unitDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  unitLabel: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
  unitTenant: {
    fontSize: 10,
    lineHeight: 14,
  },
});

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

    const duration = 2400 + Math.random() * 1000;

    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    ).start();

    return () => float.stopAnimation();
  }, []);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const rotate = float.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-4deg", "0deg", "4deg"] });

  return (
    <Animated.View
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
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          backgroundColor: color + "18",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 1,
          borderColor: color + "30",
        }}
      >
        <Ionicons name={name} size={size} color={color} />
      </View>
    </Animated.View>
  );
};

// ── Illustration area ──────────────────────────────────────────────────────────
const Illustration = ({ page, scaleAnim, opacityAnim }) => {
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 2200, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  const ringScale   = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.12, 0.28, 0.12] });

  const renderMock = () => {
    if (page.mockCard === "bills")    return <MockBillsCard    accentColor={page.accentColor} />;
    if (page.mockCard === "split")    return <MockSplitCard    accentColor={page.accentColor} />;
    if (page.mockCard === "property") return <MockPropertyCard accentColor={page.accentColor} />;
    return null;
  };

  return (
    <Animated.View
      style={{
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      {/* Outer breathing ring */}
      <Animated.View
        style={{
          position: "absolute",
          width: width * 0.78,
          height: width * 0.78,
          borderRadius: width * 0.39,
          borderWidth: 1,
          borderColor: page.accentColor,
          opacity: ringOpacity,
          transform: [{ scale: ringScale }],
        }}
      />
      {/* Inner static ring */}
      <Animated.View
        style={{
          position: "absolute",
          width: width * 0.6,
          height: width * 0.6,
          borderRadius: width * 0.3,
          borderWidth: 1,
          borderColor: page.accentColor + "30",
        }}
      />

      {/* Feature icon badge */}
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          backgroundColor: page.accentColor + "20",
          borderWidth: 1.5,
          borderColor: page.accentColor + "40",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <Ionicons name={page.icon} size={26} color={page.accentColor} />
      </View>

      {renderMock()}
    </Animated.View>
  );
};

// ── Single onboarding page ─────────────────────────────────────────────────────
const OnboardingPage = ({ item, index, scrollX, panelHeight }) => {
  const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

  const illustrationScale = scrollX.interpolate({
    inputRange,
    outputRange: [0.82, 1, 0.82],
    extrapolate: "clamp",
  });
  const illustrationOpacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={{ width, height }}>
      <LinearGradient
        colors={item.gradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
      />

      {/* Subtle green mesh glow (top-right corner) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -60,
          right: -60,
          width: 220,
          height: 220,
          borderRadius: 110,
          backgroundColor: item.accentColor + "09",
        }}
      />

      {/* Floating background icons */}
      {item.floatingIcons.map((fi, i) => (
        <FloatingIcon key={i} {...fi} />
      ))}

      {/* Illustration zone (top portion) */}
      <View style={[pageStyles.illustrationZone, { paddingBottom: panelHeight - 24 }]}>
        <Illustration
          page={item}
          scaleAnim={illustrationScale}
          opacityAnim={illustrationOpacity}
        />
      </View>
    </View>
  );
};

const pageStyles = StyleSheet.create({
  illustrationZone: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

// ── Animated feature item ──────────────────────────────────────────────────────
const FeatureItem = ({ feature, delay }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 400,
      delay,
      useNativeDriver: true,
    }).start();
  }, [feature.text]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] });
  const iconBg = feature.color + "20";

  return (
    <Animated.View
      style={[
        featureStyles.row,
        { opacity: anim, transform: [{ translateX }] },
      ]}
    >
      <View style={[featureStyles.iconWrap, { backgroundColor: iconBg, borderColor: feature.color + "30" }]}>
        <Ionicons name={feature.icon} size={15} color={feature.color} />
      </View>
      <Text style={featureStyles.text}>{feature.text}</Text>
    </Animated.View>
  );
};

const featureStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  text: {
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.1,
    color: "rgba(234,241,255,0.78)",  // colors.darkColors.text at ~78% opacity
  },
});

// ── Main Onboarding Screen ─────────────────────────────────────────────────────
const OnboardingScreen = ({ onComplete }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pages = getPages();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const panelHeight = BASE_PANEL_HEIGHT + insets.bottom;
  const currentPageData = pages[currentPage];

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

  // Derive CTA accent from current page (always a forest-green tone)
  const accentColor = currentPageData.accentColor;
  // Panel background: almost-opaque version of the darkest forest green
  const panelBg = "rgba(0,27,25,0.97)";          // near #001b19 — deeper than #002b29
  const skipColor = "rgba(158,208,205,0.40)";     // inverse-primary at low opacity

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      {/* Scrollable pages */}
      <FlatList
        ref={flatListRef}
        data={pages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <OnboardingPage item={item} index={index} scrollX={scrollX} panelHeight={panelHeight} />
        )}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfig}
        scrollEventThrottle={16}
      />

      {/* ── Bottom content panel ── */}
      <View
        style={[
          styles.panel,
          {
            height: panelHeight,
            backgroundColor: panelBg,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        {/* Thin accent top bar */}
        <View style={[styles.panelAccentBar, { backgroundColor: accentColor }]} />

        {/* Badge + title + description + features */}
        <View style={styles.panelContent}>
          {/* Badge */}
          <View style={[styles.badge, { backgroundColor: accentColor + "20", borderColor: accentColor + "40" }]}>
            <Ionicons name="leaf-outline" size={9} color={accentColor} />
            <Text style={[styles.badgeText, { color: accentColor }]}>{currentPageData.badge}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{currentPageData.title}</Text>

          {/* Description */}
          <Text style={styles.description}>{currentPageData.description}</Text>

          {/* Features */}
          <View style={styles.featureList}>
            {currentPageData.features.map((f, i) => (
              <FeatureItem key={`${currentPage}-${i}`} feature={f} delay={i * 80} />
            ))}
          </View>
        </View>

        {/* ── Nav bar ── */}
        <View style={styles.navBar}>
          {/* Skip / spacer */}
          {!isLast ? (
            <TouchableOpacity style={styles.skipBtn} onPress={handleComplete} activeOpacity={0.7}>
              <Text style={[styles.skipText, { color: skipColor }]}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.skipBtn} />
          )}

          {/* Dot indicators */}
          <View style={styles.dots}>
            {pages.map((p, i) => {
              const dotWidth = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [6, 22, 6],
                extrapolate: "clamp",
              });
              const dotOpacity = scrollX.interpolate({
                inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                outputRange: [0.30, 1, 0.30],
                extrapolate: "clamp",
              });
              return (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    { width: dotWidth, opacity: dotOpacity, backgroundColor: p.accentColor },
                  ]}
                />
              );
            })}
          </View>

          {/* Next / Get Started */}
          <TouchableOpacity
            onPress={goToNext}
            activeOpacity={0.8}
            style={[styles.nextBtn, isLast && { width: "auto" }]}
          >
            {isLast ? (
              <LinearGradient
                // Green-to-emerald gradient using forest palette
                colors={["#036d41", "#81d8a3"]}   // secondary → secondary-fixed-dim
                style={styles.getStartedGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.getStartedText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={16} color="#002b29" />
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.nextCircle,
                  { backgroundColor: accentColor + "20", borderColor: accentColor + "50" },
                ]}
              >
                <Ionicons name="arrow-forward" size={20} color={accentColor} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Page counter (top right) */}
      <View style={[styles.counterWrap, { top: insets.top + 12 }]}>
        <Text style={styles.counterText}>
          {currentPage + 1}/{pages.length}
        </Text>
      </View>
    </Animated.View>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Use darkColors.background as the root fallback
  root: { flex: 1, backgroundColor: "#002b29" },

  // Panel
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingTop: 0,
  },
  panelAccentBar: {
    height: 3,
    width: 48,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
    opacity: 0.85,
  },
  panelContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 7,
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  // Text
  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#eaf1ff",             // colors.darkColors.text
    lineHeight: 33,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 13,
    color: "rgba(158,208,205,0.60)",  // inverse-primary dimmed
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  featureList: {
    gap: 7,
  },

  // Nav bar
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  skipBtn: { width: 60 },
  skipText: { fontSize: 14, fontWeight: "600" },
  dots: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { height: 5, borderRadius: 2.5 },
  nextBtn: { width: 60, alignItems: "flex-end" },
  nextCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  getStartedGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  getStartedText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#002b29",           // dark text on bright green CTA — high contrast
  },

  // Counter
  counterWrap: { position: "absolute", right: 20 },
  counterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(158,208,205,0.22)",   // inverse-primary very dim
    letterSpacing: 0.5,
  },
});

// ── Utilities ──────────────────────────────────────────────────────────────────
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

export default OnboardingScreen;
