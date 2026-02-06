import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { authService } from "../../services/apiService";

const RegisterStep2Screen = ({ navigation, route }) => {
  const { email, name } = route.params || {};
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const timerRef = useRef(null);

  React.useEffect(() => {
    if (resendTimer > 0) {
      timerRef.current = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
    }
    return () => clearTimeout(timerRef.current);
  }, [resendTimer]);

  const handleVerify = async () => {
    setError("");

    if (!code.trim()) {
      setError("Please enter the verification code");
      return;
    }

    if (code.length < 6) {
      setError("Verification code must be 6 digits");
      return;
    }

    setLoading(true);
    try {
      const response = await authService.verifyActivationCode({
        email,
        activationCode: code,
      });

      if (response.success) {
        Alert.alert("Success", "Email verified successfully");
        navigation.navigate("RegisterStep3", {
          email,
          name,
        });
      } else {
        setError(response.message || "Invalid verification code");
      }
    } catch (err) {
      setError(err.message || "Verification failed");
      console.error("Verify code error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setResending(true);
    try {
      const response = await authService.resendVerification(email);

      if (response.success) {
        Alert.alert("Success", "New verification code sent to your email");
        setResendTimer(60); // 60 second cooldown
        setCode("");
      } else {
        setError(response.message || "Failed to resend code");
      }
    } catch (err) {
      setError("Failed to resend verification code");
      console.error("Resend code error:", err);
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.headerSection}>
          <View style={styles.header}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.icon}
            />
            <Text style={styles.appTitle}>Apartment Bill Tracker</Text>
            <Text style={styles.pageTitle}>Create Account</Text>
          </View>
          <View style={styles.progressDots}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
          </View>
          <Text style={styles.stepText}>Step 2 of 3</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Verification Code</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="verified-user"
                size={20}
                color="#b38604"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="000000"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
                placeholderTextColor="#999"
              />
            </View>
            <Text style={styles.helperText}>
              Enter the 6-digit code from your email
            </Text>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.resendSection}>
            <Text style={styles.resendText}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resending || resendTimer > 0}
            >
              <Text
                style={[
                  styles.resendButton,
                  (resending || resendTimer > 0) && styles.resendButtonDisabled,
                ]}
              >
                {resending
                  ? "Sending..."
                  : resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : "Resend Code"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Continue</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Didn't get a code? </Text>
            <TouchableOpacity
              onPress={handleResendCode}
              disabled={resending || resendTimer > 0}
            >
              <Text
                style={[
                  styles.linkText,
                  (resending || resendTimer > 0) && styles.linkTextDisabled,
                ]}
              >
                {resending
                  ? "Sending..."
                  : resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : "Resend Code"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Developer Credit Footer */}
          <View style={styles.developerFooter}>
            <Text style={styles.developerText}>Developed by: Rommel Belia</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  headerSection: {
    marginBottom: 32,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
  },
  icon: {
    width: 90,
    height: 90,
    resizeMode: "contain",
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#333",
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 16,
    color: "#666",
    fontWeight: "500",
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e0e0e0",
  },
  dotActive: {
    backgroundColor: "#b38604",
  },
  stepText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#b38604",
  },
  formSection: {
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    display: "none",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 8,
    paddingRight: 10,
    backgroundColor: "#f9f9f9",
    marginBottom: 12,
  },
  inputIcon: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 15,
    color: "#333",
  },
  helperText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    display: "none",
  },
  errorText: {
    color: "#d32f2f",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#ffebee",
    borderRadius: 6,
  },
  buttonSection: {
    marginTop: 10,
  },
  verifyButton: {
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    backgroundColor: "#b38604",
    marginTop: 6,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: "#666",
  },
  linkText: {
    fontSize: 14,
    color: "#b38604",
    fontWeight: "600",
  },
  linkTextDisabled: {
    color: "#ccc",
  },
  developerFooter: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    alignItems: "center",
  },
  developerText: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic",
  },
});

export default RegisterStep2Screen;
