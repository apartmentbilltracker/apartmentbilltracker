import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const { width, height } = Dimensions.get("window");

/**
 * Ambient auth backdrop shared by login, registration, recovery, and legal
 * screens. It stays decorative only, so it never participates in touches.
 */
const AuthBubbles = () => {
  const { isDark } = useTheme();

  const palette = isDark
    ? {
        washTop: "rgba(129,216,163,0.16)",
        washMiddle: "rgba(158,208,205,0.08)",
        washBottom: "rgba(0,32,31,0)",
        band: "rgba(129,216,163,0.09)",
        bandAlt: "rgba(158,208,205,0.07)",
        line: "rgba(158,208,205,0.16)",
        tile: "rgba(255,255,255,0.045)",
        tileBorder: "rgba(158,208,205,0.12)",
      }
    : {
        washTop: "rgba(185,236,233,0.58)",
        washMiddle: "rgba(154,242,187,0.18)",
        washBottom: "rgba(248,249,255,0)",
        band: "rgba(3,109,65,0.055)",
        bandAlt: "rgba(54,102,100,0.05)",
        line: "rgba(3,109,65,0.11)",
        tile: "rgba(188,231,224,0.42)",
        tileBorder: "rgba(3,109,65,0.10)",
      };

  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <LinearGradient
        colors={[palette.washTop, palette.washMiddle, palette.washBottom]}
        locations={[0, 0.5, 1]}
        style={styles.wash}
      />

      <View style={[styles.band, styles.bandTop, { backgroundColor: palette.band }]} />
      <View
        style={[
          styles.band,
          styles.bandBottom,
          { backgroundColor: palette.bandAlt },
        ]}
      />

      <View style={[styles.line, styles.lineOne, { backgroundColor: palette.line }]} />
      <View style={[styles.line, styles.lineTwo, { backgroundColor: palette.line }]} />

      <View style={styles.tileField}>
        {Array.from({ length: 18 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.tile,
              {
                backgroundColor: palette.tile,
                borderColor: palette.tileBorder,
                opacity: index % 3 === 0 ? 0.9 : 0.58,
              },
            ]}
          />
        ))}
      </View>

      <View
        style={[
          styles.cornerPanel,
          styles.cornerPanelTop,
          {
            backgroundColor: palette.tile,
            borderColor: palette.tileBorder,
          },
        ]}
      />
      <View
        style={[
          styles.cornerPanel,
          styles.cornerPanelBottom,
          {
            backgroundColor: palette.tile,
            borderColor: palette.tileBorder,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  wash: {
    ...StyleSheet.absoluteFillObject,
  },
  band: {
    position: "absolute",
    width: width * 1.35,
    height: 150,
    borderRadius: 8,
    transform: [{ rotate: "-14deg" }],
  },
  bandTop: {
    top: height * 0.07,
    left: -width * 0.22,
  },
  bandBottom: {
    bottom: height * 0.13,
    right: -width * 0.42,
  },
  line: {
    position: "absolute",
    height: 1,
    width: width * 0.78,
    transform: [{ rotate: "-14deg" }],
  },
  lineOne: {
    top: height * 0.2,
    right: -width * 0.18,
  },
  lineTwo: {
    bottom: height * 0.24,
    left: -width * 0.18,
  },
  tileField: {
    position: "absolute",
    top: height * 0.12,
    right: -18,
    width: 156,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    transform: [{ rotate: "-8deg" }],
  },
  tile: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
  },
  cornerPanel: {
    position: "absolute",
    width: 170,
    height: 116,
    borderRadius: 8,
    borderWidth: 1,
    transform: [{ rotate: "-12deg" }],
  },
  cornerPanelTop: {
    top: -44,
    left: -78,
  },
  cornerPanelBottom: {
    bottom: -46,
    right: -72,
  },
});

export default AuthBubbles;
