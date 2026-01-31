import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { authService } from "../../services/apiService";

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Call the backend password reset endpoint
      const response = await authService.requestPasswordReset(email);

      if (response.success) {
        setSuccess(true);
        Alert.alert(
          "Code Sent",
          response.message ||
            "A 6-digit verification code has been sent to your email.",
          [
            {
              text: "OK",
              onPress: () => navigation.navigate("VerifyResetCode", { email }),
            },
          ],
        );
      } else {
        setError(response.message || "Failed to send reset code");
      }
    } catch (err) {
      console.error("Password reset error:", err);
      // Get better error message from response
      const errorMessage =
        err.response?.data?.message ||
        err.data?.message ||
        err.message ||
        "An error occurred. Please try again later.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup inputs when screen loses focus
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      setEmail("");
      setError("");
      setSuccess(false);
    });
    return unsubscribe;
  }, [navigation]);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Reset Password</Text>
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="lock-reset" size={60} color="#b38604" />
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Enter your email address and we'll send you a 6-digit verification
          code to reset your password.
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={16} color="#e74c3c" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError("");
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              placeholderTextColor="#999"
            />
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              disabled={loading}
            >
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color="#3498db" />
          <Text style={styles.infoText}>
            The password reset link will expire in 24 hours. Check your spam
            folder if you don't see the email.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 20,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
    position: "relative",
  },
  backButton: {
    position: "absolute",
    left: -10,
    padding: 10,
    zIndex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    flex: 1,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 24,
  },
  form: {
    marginBottom: 30,
  },
  errorContainer: {
    backgroundColor: "#fee",
    borderLeftWidth: 4,
    borderLeftColor: "#e74c3c",
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    color: "#c0392b",
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f9f9f9",
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#b38604",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
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
  infoBox: {
    backgroundColor: "#e3f2fd",
    borderLeftWidth: 4,
    borderLeftColor: "#3498db",
    padding: 14,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 13,
    color: "#1565c0",
    marginLeft: 10,
    lineHeight: 20,
    flex: 1,
  },
});

export default ForgotPasswordScreen;
