/**
 * CustomAlert.js
 * Drop-in replacement for React Native's Alert.alert()
 *
 * Exports:
 *  - InlineAlert   → animated error/warning/success banner inside modals
 *  - Toast         → auto-dismissing overlay notification over the screen
 *  - ConfirmModal  → custom confirmation dialog (replaces 2-button Alert)
 */

import React, { useEffect, useRef } from "react";
import { useTheme } from "../theme/ThemeContext";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// ─────────────────────────────────────────────────────────────────────────────
// Shared colour map used by all three components
// ─────────────────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  error: {
    bg: "rgba(220,53,69,0.10)",
    border: "rgba(220,53,69,0.35)",
    icon: "alert-circle",
    iconColor: "#DC3545",
    titleColor: "#C82333",
    // Toast — standard red
    toastBg: "#DC3545",
    toastIcon: "#FFE4E6",
  },
  warning: {
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.35)",
    icon: "warning",
    iconColor: "#D97706",
    titleColor: "#92610A",
    // Toast — standard amber
    toastBg: "#F59E0B",
    toastIcon: "#FFFBEB",
  },
  success: {
    bg: "rgba(22,163,74,0.10)",
    border: "rgba(22,163,74,0.28)",
    icon: "checkmark-circle",
    iconColor: "#16A34A",
    titleColor: "#15803D",
    // Toast — standard green
    toastBg: "#16A34A",
    toastIcon: "#DCFCE7",
  },
  info: {
    bg: "rgba(14,165,233,0.10)",
    border: "rgba(14,165,233,0.28)",
    icon: "information-circle",
    iconColor: "#0EA5E9",
    titleColor: "#0369A1",
    // Toast — standard sky blue (not indigo/purple)
    toastBg: "#0EA5E9",
    toastIcon: "#E0F2FE",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. InlineAlert — lives inside a modal/form; slides in from above
// ─────────────────────────────────────────────────────────────────────────────
export const InlineAlert = ({
  visible,
  type = "error",
  title,
  message,
  onDismiss,
  style,
}) => {
  const slideY = useRef(new Animated.Value(-16)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 90,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, {
          toValue: -16,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const c = TYPE_CONFIG[type] ?? TYPE_CONFIG.error;

  return (
    <Animated.View
      style={[
        inlineStyles.wrapper,
        { backgroundColor: c.bg, borderColor: c.border },
        { opacity, transform: [{ translateY: slideY }] },
        style,
      ]}
    >
      <Ionicons
        name={c.icon}
        size={17}
        color={c.iconColor}
        style={inlineStyles.icon}
      />
      <View style={inlineStyles.body}>
        {title ? (
          <Text style={[inlineStyles.title, { color: c.titleColor }]}>
            {title}
          </Text>
        ) : null}
        {message ? <Text style={inlineStyles.message}>{message}</Text> : null}
      </View>
      {onDismiss && (
        <Pressable onPress={onDismiss} hitSlop={10} style={inlineStyles.close}>
          <Ionicons name="close" size={14} color="#999" />
        </Pressable>
      )}
    </Animated.View>
  );
};

const inlineStyles = StyleSheet.create({
  wrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 14,
    gap: 9,
  },
  icon: { marginTop: 1 },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 12.5, fontWeight: "700", letterSpacing: 0.1 },
  message: { fontSize: 12.5, color: "#555", lineHeight: 18, fontWeight: "500" },
  close: { marginTop: 1 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Toast — auto-dismissing overlay banner; render it at the screen root
// ─────────────────────────────────────────────────────────────────────────────
const TOAST_DURATION = 3400; // ms before auto-dismiss

export const Toast = ({ visible, type = "success", message, onHide }) => {
  const slideY = useRef(new Animated.Value(-70)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const hide = () => {
    Animated.parallel([
      Animated.timing(slideY, {
        toValue: -70,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start(() => onHide?.());
  };

  useEffect(() => {
    if (visible) {
      // Reset animation values before showing
      slideY.setValue(-70);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 85,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 210,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(hide, TOAST_DURATION);
      return () => clearTimeout(timerRef.current);
    }
  }, [visible]);

  if (!visible) return null;

  const c = TYPE_CONFIG[type] ?? TYPE_CONFIG.info;

  return (
    <Animated.View
      style={[
        toastStyles.container,
        {
          backgroundColor: c.toastBg,
          opacity,
          transform: [{ translateY: slideY }],
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          toastStyles.iconBadge,
          { backgroundColor: "rgba(255,255,255,0.15)" },
        ]}
      >
        <Ionicons name={c.icon} size={18} color={c.toastIcon} />
      </View>
      <Text style={toastStyles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable onPress={hide} hitSlop={12} style={toastStyles.closeBtn}>
        <Ionicons name="close" size={17} color="rgba(255,255,255,0.6)" />
      </Pressable>
    </Animated.View>
  );
};

const toastStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 10,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 9999,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  message: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: "600",
    color: "#fff",
    lineHeight: 20,
  },
  closeBtn: { padding: 2 },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ConfirmModal — replaces 2-button Alert.alert()
// ─────────────────────────────────────────────────────────────────────────────
export const ConfirmModal = ({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  /** "default" | "destructive" */
  confirmStyle = "default",
  onConfirm,
  onCancel,
  /** onClose dismisses without triggering either action (the X button) */
  onClose,
}) => {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 85,
          friction: 11,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 0.88,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 160,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const isDestructive = confirmStyle === "destructive";
  const accentColor = isDestructive ? "#DC3545" : colors.accent;
  const accentSurface = isDestructive ? "rgba(220,53,69,0.10)" : colors.accentSurface;
  const iconName = isDestructive ? "warning-outline" : "help-circle-outline";

  // Close handler — falls back to onCancel if no dedicated onClose provided
  const handleClose = onClose ?? onCancel;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <Animated.View style={[confirmStyles.overlay, { opacity }]}>
        <Animated.View
          style={[
            confirmStyles.card,
            {
              backgroundColor: colors.card,
              shadowColor: colors.shadow,
              borderColor: colors.border,
              transform: [{ scale }],
            },
          ]}
        >
          {/* ── Close (X) button ── */}
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={[confirmStyles.closeBtn, { backgroundColor: colors.inputBg }]}
          >
            <Ionicons name="close" size={16} color={colors.textTertiary} />
          </Pressable>

          {/* ── Icon ring ── */}
          <View
            style={[confirmStyles.iconRing, { backgroundColor: accentSurface }]}
          >
            <Ionicons name={iconName} size={30} color={accentColor} />
          </View>

          <Text style={[confirmStyles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[confirmStyles.message, { color: colors.textSecondary }]}>
            {message}
          </Text>

          {/* ── Divider ── */}
          <View style={[confirmStyles.divider, { backgroundColor: colors.border }]} />

          <View style={confirmStyles.btnRow}>
            {/* Cancel */}
            <TouchableOpacity
              style={[confirmStyles.btn, { backgroundColor: colors.inputBg }]}
              onPress={onCancel}
              activeOpacity={0.75}
            >
              <Text style={[confirmStyles.cancelText, { color: colors.textSecondary }]}>
                {cancelText}
              </Text>
            </TouchableOpacity>

            {/* Confirm */}
            <TouchableOpacity
              style={[confirmStyles.btn, { backgroundColor: accentColor }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={confirmStyles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const confirmStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.50)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 26,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 44,       // extra top padding to clear the close button
    paddingBottom: 20,
    alignItems: "center",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  iconRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 22,
  },
  divider: {
    width: "100%",
    height: 1,
    marginBottom: 18,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "700" },
  confirmText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
