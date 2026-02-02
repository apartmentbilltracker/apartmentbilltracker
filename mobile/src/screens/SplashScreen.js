import React, { useContext, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
} from "react-native";
import { BlurView } from "expo-blur";
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
    }, 8000); // Very long timeout to keep splash visible

    return () => clearTimeout(timer);
  }, []);

  return (
    <ImageBackground
      source={require("../assets/icon.png")}
      style={styles.backgroundImage}
      blurRadius={90}
    >
      <BlurView intensity={70} style={styles.blurContainer}>
        <View style={styles.container}>
          {/* Building Icon with Pulse Animation */}

          <Image source={require("../assets/icon.png")} style={styles.icon} />

          {/* Title */}
          <Text style={styles.title}>Apartment Bill Tracker</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>Smart Billing for Shared Living</Text>

          {/* Loading Indicator */}
          <View style={styles.loaderSection}>
            <ActivityIndicator size="large" color="#b38604" />
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
      </BlurView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  blurContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 24,
    justifyContent: "center",
    alignItems: "center",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 4,
    borderColor: "#b38604",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 15,
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
    backgroundColor: "#b38604",
    opacity: 0.6,
  },
  icon: {
    width: 140,
    height: 140,
    resizeMode: "contain",
  },
});

export default SplashScreen;
