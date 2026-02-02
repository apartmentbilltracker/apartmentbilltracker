import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
} from "react-native";
import { MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { authService } from "../../services/apiService";

const ResetPasswordScreen = ({ navigation, route }) => {
  const { email, resetCode } = route.params;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validatePasswords = () => {
    const newErrors = {};

    if (!password.trim()) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(password)) {
      newErrors.password =
        "Password must contain at least one uppercase letter";
    } else if (!/[0-9]/.test(password)) {
      newErrors.password = "Password must contain at least one number";
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleResetPassword = async () => {
    if (!validatePasswords()) {
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const response = await authService.resetPassword(
        email,
        resetCode,
        password,
      );

      if (response.success) {
        Alert.alert(
          "Success",
          "Password reset successfully! Please login with your new password.",
          [
            {
              text: "OK",
              onPress: () => {
                navigation.navigate("Login");
              },
            },
          ],
        );
      } else {
        setErrors({
          submit: response.message || "Failed to reset password",
        });
      }
    } catch (err) {
      console.error("Password reset error:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.data?.message ||
        err.message ||
        "Failed to reset password. Please try again.";
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = password.length >= 8 ? "Strong" : "Weak";
  const passwordStrengthColor =
    password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)
      ? "#27ae60"
      : "#f39c12";

  // Cleanup inputs when screen loses focus
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setErrors({});
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
          Create a strong new password for your account
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Submit Error */}
          {errors.submit ? (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error" size={16} color="#e74c3c" />
              <Text style={styles.errorText}>{errors.submit}</Text>
            </View>
          ) : null}

          {/* New Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>New Password</Text>
            <View
              style={[
                styles.inputWrapper,
                errors.password && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Enter new password"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (errors.password) {
                    setErrors({ ...errors, password: "" });
                  }
                }}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.iconButton}
              >
                <MaterialIcons
                  name={showPassword ? "visibility-off" : "visibility"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <Text style={styles.fieldErrorText}>{errors.password}</Text>
            ) : null}
            {password && (
              <View style={styles.strengthContainer}>
                <View
                  style={[
                    styles.strengthBar,
                    { backgroundColor: passwordStrengthColor },
                  ]}
                />
                <Text
                  style={[
                    styles.strengthText,
                    { color: passwordStrengthColor },
                  ]}
                >
                  {passwordStrength}
                </Text>
              </View>
            )}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Confirm Password</Text>
            <View
              style={[
                styles.inputWrapper,
                errors.confirmPassword && styles.inputWrapperError,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={(text) => {
                  setConfirmPassword(text);
                  if (errors.confirmPassword) {
                    setErrors({ ...errors, confirmPassword: "" });
                  }
                }}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.iconButton}
              >
                <MaterialIcons
                  name={showConfirmPassword ? "visibility-off" : "visibility"}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? (
              <Text style={styles.fieldErrorText}>
                {errors.confirmPassword}
              </Text>
            ) : null}
            {confirmPassword && password === confirmPassword && (
              <View style={styles.matchContainer}>
                <MaterialIcons name="check-circle" size={16} color="#27ae60" />
                <Text style={styles.matchText}>Passwords match</Text>
              </View>
            )}
          </View>

          {/* Requirements */}
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <View style={styles.requirementItem}>
              <MaterialIcons
                name={
                  password.length >= 8
                    ? "check-circle"
                    : "radio-button-unchecked"
                }
                size={16}
                color={password.length >= 8 ? "#27ae60" : "#999"}
              />
              <Text
                style={[
                  styles.requirementText,
                  password.length >= 8 && styles.requirementMet,
                ]}
              >
                At least 8 characters
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <MaterialIcons
                name={
                  /[A-Z]/.test(password)
                    ? "check-circle"
                    : "radio-button-unchecked"
                }
                size={16}
                color={/[A-Z]/.test(password) ? "#27ae60" : "#999"}
              />
              <Text
                style={[
                  styles.requirementText,
                  /[A-Z]/.test(password) && styles.requirementMet,
                ]}
              >
                One uppercase letter
              </Text>
            </View>
            <View style={styles.requirementItem}>
              <MaterialIcons
                name={
                  /[0-9]/.test(password)
                    ? "check-circle"
                    : "radio-button-unchecked"
                }
                size={16}
                color={/[0-9]/.test(password) ? "#27ae60" : "#999"}
              />
              <Text
                style={[
                  styles.requirementText,
                  /[0-9]/.test(password) && styles.requirementMet,
                ]}
              >
                One number
              </Text>
            </View>
          </View>

          {/* Reset Button */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              (loading || !password || !confirmPassword) &&
                styles.buttonDisabled,
            ]}
            onPress={handleResetPassword}
            disabled={loading || !password || !confirmPassword}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Reset Password</Text>
            )}
          </TouchableOpacity>

          {/* Back to Login */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              disabled={loading}
            >
              <Text style={styles.linkText}>Login Here</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Security Info */}
        <View style={styles.infoBox}>
          <MaterialIcons name="security" size={20} color="#8e44ad" />
          <Text style={styles.infoText}>
            Your password will be encrypted and securely stored. Never share
            your password with anyone.
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
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f9f9f9",
  },
  inputWrapperError: {
    borderColor: "#e74c3c",
    backgroundColor: "#fee",
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#333",
  },
  iconButton: {
    padding: 8,
  },
  fieldErrorText: {
    fontSize: 12,
    color: "#e74c3c",
    marginTop: 6,
  },
  strengthContainer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 8,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },
  matchContainer: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  matchText: {
    fontSize: 12,
    color: "#27ae60",
    marginLeft: 6,
    fontWeight: "500",
  },
  requirementsBox: {
    backgroundColor: "#f9f9f9",
    borderLeftWidth: 4,
    borderLeftColor: "#3498db",
    padding: 12,
    borderRadius: 4,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 8,
  },
  requirementMet: {
    color: "#27ae60",
    fontWeight: "500",
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
    backgroundColor: "#f3e5f5",
    borderLeftWidth: 4,
    borderLeftColor: "#8e44ad",
    padding: 14,
    borderRadius: 4,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 13,
    color: "#6a1b9a",
    marginLeft: 10,
    lineHeight: 20,
    flex: 1,
  },
});

export default ResetPasswordScreen;
