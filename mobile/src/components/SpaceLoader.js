import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  useColorScheme,
  Image,
} from "react-native";

export default function HomeSpaceLoader() {
  const isDark = useColorScheme() === "dark";

  // 1. Setup Animation Controllers
  const spinValue = useRef(new Animated.Value(0)).current;
  const pingValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Continuous Infinite Loops
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    Animated.loop(
      Animated.timing(pingValue, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  // 2. Map Interpolations
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const pingScale = pingValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.6],
  });

  const pingOpacity = pingValue.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.4, 0],
  });

  const textOpacity = pulseValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.9],
  });

  // Dynamic Theme Styling
  const brandGreen = isDark ? "#7ee8a2" : "#1a7a52";
  const trackColor = isDark ? "#1e293b" : "#e2e8f0";

  return (
    <View style={styles.container}>
      <View style={styles.animationWrapper}>
        {/* Layer 1: Glowing Ripple Outer Ring */}
        <Animated.View
          style={[
            styles.pingRing,
            {
              backgroundColor: isDark
                ? "rgba(126, 232, 162, 0.15)"
                : "rgba(26, 122, 82, 0.15)",
              transform: [{ scale: pingScale }],
              opacity: pingOpacity,
            },
          ]}
        />

        {/* Layer 2: Spinning Progress Track */}
        <Animated.View
          style={[
            styles.spinner,
            {
              borderColor: trackColor,
              borderTopColor: brandGreen,
              transform: [{ rotate: spin }],
            },
          ]}
        />

        {/* Layer 3: Branded Centerpiece Core */}
        <View style={[styles.centerDot, { backgroundColor: "transparent" }]}>
          <Image
            source={require("../assets/icon.png")}
            style={styles.logoImage}
            resizeMode="contain"
            fadeDuration={0}
            progressiveRenderingEnabled
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  animationWrapper: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  pingRing: {
    position: "absolute",
    width: 68,
    height: 68,
    borderRadius: 22,
  },
  spinner: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 2.5,
  },
  centerDot: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  logoImage: {
    width: 24,
    height: 24,
  },
  loadingText: {
    marginTop: 24,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
});
