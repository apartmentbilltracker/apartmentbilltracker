import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Dimensions, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeContext";

const { width, height } = Dimensions.get("window");

/**
 * AuthBubbles — Redesigned ambient forest-green backdrop.
 *
 * Layers (back → front):
 *  1. Full-screen radial-ish gradient wash
 *  2. Two large translucent orbs with slow pulse animation
 *  3. Diagonal geometric band strips
 *  4. A fine hex/diamond tile grid rotated on one corner
 *  5. Delicate horizontal scan lines
 *  6. Two frosted corner panels
 *  7. A soft radial glow halo near the top
 */
const AuthBubbles = () => {
  const { isDark } = useTheme();

  // ── Subtle pulse for orbs ─────────────────────────────────────────────────
  const orbPulse1 = useRef(new Animated.Value(0)).current;
  const orbPulse2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = (anim, duration, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration, delay, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
        ]),
      ).start();

    loop(orbPulse1, 3800, 0);
    loop(orbPulse2, 4400, 900);
  }, []);

  const orb1Scale = orbPulse1.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const orb2Scale = orbPulse2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const orb1Opacity = orbPulse1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.72, 1, 0.72] });
  const orb2Opacity = orbPulse2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.85, 0.55] });

  // ── Colour palette ────────────────────────────────────────────────────────
  const p = isDark
    ? {
        // gradient wash
        washA: "rgba(0,43,41,0)",
        washB: "rgba(10,66,64,0.55)",
        washC: "rgba(0,43,41,0)",

        // orbs
        orb1A: "rgba(129,216,163,0.13)",
        orb1B: "rgba(129,216,163,0)",
        orb2A: "rgba(3,109,65,0.10)",
        orb2B: "rgba(3,109,65,0)",

        // bands
        band1: "rgba(129,216,163,0.07)",
        band2: "rgba(158,208,205,0.055)",
        band3: "rgba(10,66,64,0.18)",

        // grid tiles
        tile: "rgba(255,255,255,0.038)",
        tileBorder: "rgba(158,208,205,0.11)",
        tileAlt: "rgba(129,216,163,0.06)",
        tileAltBorder: "rgba(129,216,163,0.14)",

        // scan lines
        scanLine: "rgba(158,208,205,0.055)",

        // corners
        corner: "rgba(10,66,64,0.38)",
        cornerBorder: "rgba(158,208,205,0.13)",

        // halo
        haloA: "rgba(129,216,163,0.12)",
        haloB: "rgba(129,216,163,0)",
      }
    : {
        washA: "rgba(185,236,233,0)",
        washB: "rgba(154,242,187,0.28)",
        washC: "rgba(248,249,255,0)",

        orb1A: "rgba(3,109,65,0.09)",
        orb1B: "rgba(3,109,65,0)",
        orb2A: "rgba(185,236,233,0.52)",
        orb2B: "rgba(185,236,233,0)",

        band1: "rgba(3,109,65,0.05)",
        band2: "rgba(54,102,100,0.045)",
        band3: "rgba(185,236,233,0.30)",

        tile: "rgba(188,231,224,0.36)",
        tileBorder: "rgba(3,109,65,0.09)",
        tileAlt: "rgba(154,242,187,0.22)",
        tileAltBorder: "rgba(3,109,65,0.12)",

        scanLine: "rgba(3,109,65,0.06)",

        corner: "rgba(185,236,233,0.42)",
        cornerBorder: "rgba(3,109,65,0.10)",

        haloA: "rgba(3,109,65,0.08)",
        haloB: "rgba(3,109,65,0)",
      };

  // ── Diamond/hex grid ──────────────────────────────────────────────────────
  const COLS = 5;
  const ROWS = 8;
  const TILE_SIZE = 24;
  const TILE_GAP = 6;

  return (
    <View pointerEvents="none" style={styles.backdrop}>

      {/* 1 · Full-screen diagonal wash */}
      <LinearGradient
        colors={[p.washA, p.washB, p.washC]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* 2 · Large pulsing orb — top-right */}
      <Animated.View
        style={[
          styles.orb,
          styles.orbTopRight,
          { opacity: orb1Opacity, transform: [{ scale: orb1Scale }] },
        ]}
      >
        <LinearGradient
          colors={[p.orb1A, p.orb1B]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* 2 · Large pulsing orb — bottom-left */}
      <Animated.View
        style={[
          styles.orb,
          styles.orbBottomLeft,
          { opacity: orb2Opacity, transform: [{ scale: orb2Scale }] },
        ]}
      >
        <LinearGradient
          colors={[p.orb2A, p.orb2B]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 1, y: 1 }}
        />
      </Animated.View>

      {/* 3 · Diagonal bands */}
      <View style={[styles.band, styles.band1, { backgroundColor: p.band1 }]} />
      <View style={[styles.band, styles.band2, { backgroundColor: p.band2 }]} />
      <View style={[styles.band, styles.band3, { backgroundColor: p.band3 }]} />

      {/* 4 · Diamond tile grid — right edge, rotated 45° */}
      <View style={styles.gridWrap}>
        {Array.from({ length: ROWS }).map((_, row) =>
          Array.from({ length: COLS }).map((_, col) => {
            const isAccent = (row + col) % 4 === 0;
            return (
              <View
                key={`${row}-${col}`}
                style={[
                  styles.tile,
                  {
                    width: TILE_SIZE,
                    height: TILE_SIZE,
                    backgroundColor: isAccent ? p.tileAlt : p.tile,
                    borderColor: isAccent ? p.tileAltBorder : p.tileBorder,
                    opacity: 1 - row * 0.08,
                  },
                ]}
              />
            );
          }),
        )}
      </View>

      {/* 5 · Horizontal scan lines */}
      {[0.18, 0.34, 0.52, 0.68, 0.82].map((pos, i) => (
        <View
          key={i}
          style={[
            styles.scanLine,
            {
              top: height * pos,
              backgroundColor: p.scanLine,
              opacity: i % 2 === 0 ? 1 : 0.5,
            },
          ]}
        />
      ))}

      {/* 6 · Frosted corner accent panels */}
      <View
        style={[
          styles.corner,
          styles.cornerTL,
          { backgroundColor: p.corner, borderColor: p.cornerBorder },
        ]}
      />
      <View
        style={[
          styles.corner,
          styles.cornerBR,
          { backgroundColor: p.corner, borderColor: p.cornerBorder },
        ]}
      />

      {/* 7 · Soft radial halo at top-center */}
      <View style={styles.haloWrap} pointerEvents="none">
        <LinearGradient
          colors={[p.haloA, p.haloB]}
          style={styles.halo}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },

  // ── Orbs ──
  orb: {
    position: "absolute",
    borderRadius: 9999,
    overflow: "hidden",
  },
  orbTopRight: {
    width: width * 0.88,
    height: width * 0.88,
    top: -width * 0.28,
    right: -width * 0.28,
  },
  orbBottomLeft: {
    width: width * 0.76,
    height: width * 0.76,
    bottom: -width * 0.22,
    left: -width * 0.26,
  },

  // ── Diagonal Bands ──
  band: {
    position: "absolute",
    width: width * 1.6,
    height: 90,
    borderRadius: 6,
    transform: [{ rotate: "-16deg" }],
  },
  band1: {
    top: height * 0.06,
    left: -width * 0.3,
  },
  band2: {
    top: height * 0.31,
    right: -width * 0.35,
  },
  band3: {
    bottom: height * 0.08,
    left: -width * 0.25,
    height: 60,
  },

  // ── Diamond Grid ──
  gridWrap: {
    position: "absolute",
    top: height * 0.09,
    right: -14,
    flexDirection: "row",
    flexWrap: "wrap",
    width: 5 * (24 + 6) - 6,
    gap: 6,
    transform: [{ rotate: "-8deg" }],
  },
  tile: {
    borderRadius: 7,
    borderWidth: 1,
    transform: [{ rotate: "45deg" }],
  },

  // ── Scan Lines ──
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
  },

  // ── Corner Panels ──
  corner: {
    position: "absolute",
    width: 180,
    height: 120,
    borderRadius: 10,
    borderWidth: 1,
    transform: [{ rotate: "-12deg" }],
  },
  cornerTL: {
    top: -50,
    left: -80,
  },
  cornerBR: {
    bottom: -48,
    right: -70,
  },

  // ── Halo ──
  haloWrap: {
    position: "absolute",
    top: -60,
    alignSelf: "center",
    width: width * 0.9,
    height: 260,
    overflow: "hidden",
    borderRadius: 9999,
  },
  halo: {
    ...StyleSheet.absoluteFillObject,
  },
});

export default AuthBubbles;
