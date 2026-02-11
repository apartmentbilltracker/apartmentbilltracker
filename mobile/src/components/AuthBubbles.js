import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useTheme } from "../theme/ThemeContext";

const { height } = Dimensions.get("window");

/**
 * Decorative background bubbles used across auth & splash screens.
 * Just drop <AuthBubbles /> inside any screen with position: relative.
 */
const AuthBubbles = () => {
  const { isDark } = useTheme();
  const bg = isDark ? "rgba(179,134,4,0.12)" : "rgba(179,134,4,0.06)";

  return (
    <>
      <View style={[styles.bubble, styles.bubble1, { backgroundColor: bg }]} />
      <View style={[styles.bubble, styles.bubble2, { backgroundColor: bg }]} />
      <View style={[styles.bubble, styles.bubble3, { backgroundColor: bg }]} />
    </>
  );
};

const styles = StyleSheet.create({
  bubble: { position: "absolute", borderRadius: 999 },
  bubble1: { width: 340, height: 340, top: -60, right: -80 },
  bubble2: { width: 240, height: 240, bottom: 60, left: -60 },
  bubble3: { width: 160, height: 160, top: height * 0.4, right: -40 },
});

export default AuthBubbles;
