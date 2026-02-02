import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { authService } from "../../services/apiService";

const VerifyResetCodeScreen = ({ navigation, route }) => {
  const { email } = route.params;
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerifyCode = async () => {
    if (!code.trim()) {
      setError("Please enter the 6-digit code");
      return;
    }

    if (code.length !== 6) {
      setError("Code must be exactly 6 digits");
      return;
    }

    if (!/^\d+$/.test(code)) {
      setError("Code must contain only numbers");
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Verify the reset code
      const response = await authService.verifyResetCode(email, code);

      if (response.success) {
        Alert.alert("Success", "Code verified! Now set your new password.", [
          {
            text: "OK",
            onPress: () =>
              navigation.navigate("ResetPassword", { email, resetCode: code }),
          },
        ]);
      } else {
        setError(response.message || "Invalid code");
      }
    } catch (err) {
      console.error("Code verification error:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.data?.message ||
        err.message ||
        "Failed to verify code. Please try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup inputs when screen loses focus
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      setCode("");
      setError("");
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
          <Text style={styles.title}>Verify Code</Text>
        </View>

        {/* Icon */}
        <View style={styles.iconContainer}>
          <MaterialIcons name="verified-user" size={60} color="#b38604" />
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Enter the 6-digit code sent to your email: {"\n"}
          <Text style={styles.email}>{email}</Text>
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

          {/* Code Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>6-Digit Code</Text>
            <View style={styles.codeInput}>
              <Text
                style={[
                  styles.codeText,
                  code.length === 6 && styles.codeTextFilled,
                ]}
              >
                {code || "000000"}
              </Text>
            </View>
            <Text style={styles.hint}>{code.length}/6 digits entered</Text>
          </View>

          {/* Number Pad */}
          <View style={styles.numberPad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <TouchableOpacity
                key={num}
                style={[
                  styles.padButton,
                  code.length >= 6 && styles.padButtonDisabled,
                ]}
                onPress={() => {
                  if (code.length < 6) {
                    setCode(code + num);
                    setError("");
                  }
                }}
                activeOpacity={0.7}
                disabled={code.length >= 6}
              >
                <Text style={styles.padButtonText}>{num}</Text>
              </TouchableOpacity>
            ))}

            {/* Zero Button */}
            <TouchableOpacity
              style={[
                styles.padButton,
                code.length >= 6 && styles.padButtonDisabled,
              ]}
              onPress={() => {
                if (code.length < 6) {
                  setCode(code + "0");
                  setError("");
                }
              }}
              activeOpacity={0.7}
              disabled={code.length >= 6}
            >
              <Text style={styles.padButtonText}>0</Text>
            </TouchableOpacity>

            {/* Backspace Button in the pad */}
            <TouchableOpacity
              style={[styles.padButton, styles.backspaceButton]}
              onPress={() => setCode(code.slice(0, -1))}
              activeOpacity={0.7}
            >
              <MaterialIcons name="backspace" size={18} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              loading && styles.buttonDisabled,
            ]}
            onPress={handleVerifyCode}
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Verify Code</Text>
            )}
          </TouchableOpacity>

          {/* Resend Code Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Didn't receive the code? </Text>
            <TouchableOpacity
              onPress={() => {
                setCode("");
                navigation.goBack();
              }}
              disabled={loading}
            >
              <Text style={styles.linkText}>Try Another Email</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color="#3498db" />
          <Text style={styles.infoText}>
            The code is valid for 15 minutes. Check your spam folder if you
            don't see the email.
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
    paddingTop: 10,
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
  email: {
    fontWeight: "600",
    color: "#333",
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
    marginBottom: 12,
  },
  codeInput: {
    borderWidth: 2,
    borderColor: "#b38604",
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    marginBottom: 8,
  },
  codeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ccc",
    letterSpacing: 8,
  },
  codeTextFilled: {
    color: "#b38604",
  },
  hint: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
  numberPad: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  padButton: {
    width: "28%",
    aspectRatio: 1.2,
    borderRadius: 6,
    backgroundColor: "#e8e8e8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 0.5,
    borderColor: "#d0d0d0",
    elevation: 1,
  },
  padButtonDisabled: {
    opacity: 0.5,
  },
  padButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  backspaceButton: {
    width: "28%",
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
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

export default VerifyResetCodeScreen;
