import React, { useContext, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../context/AuthContext";
import { useTheme } from "@react-navigation/native";
import biometricAuth from "../utils/biometricAuth";

const BiometricSetupModal = () => {
  const theme = useTheme();
  const {
    state: {
      showBiometricSetupModal,
      pendingBiometricEmail,
      pendingBiometricPassword,
    },
    hideBiometricSetupModal,
    updateBiometricCredentials,
  } = useContext(AuthContext);

  const [isEnabling, setIsEnabling] = useState(false);

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      const result = await updateBiometricCredentials(
        pendingBiometricEmail,
        pendingBiometricPassword,
        true,
      );
      if (result.success) {
        // Biometric enabled successfully
      } else {
        Alert.alert(
          "Setup Failed",
          result.error || "Failed to enable biometric login",
        );
      }
    } catch (error) {
      Alert.alert("Error", "An unexpected error occurred");
      console.error("Error enabling biometric:", error);
    } finally {
      setIsEnabling(false);
      hideBiometricSetupModal();
    }
  };

  const handleSkip = () => {
    hideBiometricSetupModal();
  };

  if (!showBiometricSetupModal) {
    return null;
  }

  return (
    <Modal
      visible={showBiometricSetupModal}
      transparent
      animationType="fade"
      onRequestClose={handleSkip}
    >
      <View
        style={[styles.container, { backgroundColor: "rgba(0, 0, 0, 0.5)" }]}
      >
        <View
          style={[
            styles.modalContent,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name="finger-print"
              size={48}
              color={theme.colors.primary}
            />
          </View>

          <Text style={[styles.title, { color: theme.colors.text }]}>
            Enable Biometric Login?
          </Text>

          <Text
            style={[
              styles.description,
              { color: theme.colors.text, opacity: 0.7 },
            ]}
          >
            Use your fingerprint or Face ID for quick and secure access to your
            account.
          </Text>

          <View style={styles.buttonContainer}>
            <Pressable
              style={[
                styles.button,
                styles.skipButton,
                { borderColor: theme.colors.border },
              ]}
              onPress={handleSkip}
              disabled={isEnabling}
            >
              <Text style={[styles.buttonText, { color: theme.colors.text }]}>
                Not Now
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.button,
                styles.enableButton,
                { backgroundColor: theme.colors.primary },
                isEnabling && { opacity: 0.7 },
              ]}
              onPress={handleEnable}
              disabled={isEnabling}
            >
              {isEnabling ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.enableButtonText}>Enable</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    width: "100%",
    borderRadius: 20,
    padding: 28,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    maxWidth: 340,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(179, 134, 4, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    alignSelf: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    marginBottom: 26,
    textAlign: "center",
    lineHeight: 21,
    fontWeight: "500",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  skipButton: {
    borderWidth: 1.5,
  },
  enableButton: {
    minHeight: 42,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});

export default BiometricSetupModal;
