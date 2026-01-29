import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";

const SplashScreen = () => {
  const authContext = useContext(AuthContext);
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.15,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      animation.reset();
    };
  }, [scaleAnim]);

  // Keep splash screen visible indefinitely for UI review
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000); // Very long timeout to keep splash visible

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Building Icon with Pulse Animation */}
      <Animated.View
        style={[styles.iconContainer, { transform: [{ scale: scaleAnim }] }]}
      >
        <Text style={{ fontSize: 60, color: "#bdb246" }}>🏢</Text>
      </Animated.View>

      {/* Title */}
      <Text style={styles.title}>Apartment Bill Tracker</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>Smart Billing for Shared Living</Text>

      {/* Loading Indicator */}
      <View style={styles.loaderSection}>
        <ActivityIndicator size="large" color="#bdb246" />
        <Text style={styles.status}>
          {showSplash ? "Loading App..." : "Initializing..."}
        </Text>
      </View>

      {/* Error Message if exists - only show if not loading */}
      {authContext?.state?.error && authContext?.isLoading === false && (
        <Text style={styles.error}>{authContext.state.error}</Text>
      )}

      {/* Decorative dots */}
      <View style={styles.decorativeSection}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#bdb246",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 40,
    fontWeight: "500",
  },
  loaderSection: {
    alignItems: "center",
    marginVertical: 20,
  },
  spinner: {
    marginTop: 10,
  },
  status: {
    marginTop: 16,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  error: {
    marginTop: 20,
    fontSize: 12,
    color: "#d32f2f",
    textAlign: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#ffebee",
    borderRadius: 6,
    overflow: "hidden",
  },
  decorativeSection: {
    flexDirection: "row",
    gap: 8,
    marginTop: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#bdb246",
    opacity: 0.6,
  },
});

export default SplashScreen;
