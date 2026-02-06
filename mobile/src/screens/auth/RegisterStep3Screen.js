import React, { useState, useContext } from "react";
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
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { AuthContext } from "../../context/AuthContext";
import { authService } from "../../services/apiService";

const RegisterStep3Screen = ({ navigation, route }) => {
  const { email, name } = route.params || {};
  const { signIn } = useContext(AuthContext);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getPasswordStrength = () => {
    if (!password) return null;

    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;

    if (strength <= 1) return { level: "Weak", color: "#e74c3c" };
    if (strength <= 2) return { level: "Fair", color: "#f39c12" };
    if (strength <= 3) return { level: "Good", color: "#3498db" };
    return { level: "Strong", color: "#27ae60" };
  };

  const validatePassword = () => {
    if (!password.trim()) {
      setError("Password is required");
      return false;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }

    if (!/[A-Z]/.test(password)) {
      setError("Password must contain at least one uppercase letter");
      return false;
    }

    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number");
      return false;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    return true;
  };

  const handleCompleteSignup = async () => {
    setError("");

    if (!validatePassword()) {
      return;
    }

    setLoading(true);
    try {
      const response = await authService.setPassword({
        email,
        password,
      });

      if (response.success) {
        Alert.alert("Success", "Account created successfully!");

        // Use AuthContext signIn to properly update auth state
        const loginResult = await signIn(email, password);

        if (loginResult.success) {
          // signIn will automatically update AuthContext, which triggers RootNavigator to show main app
          console.log("Signup complete, user logged in automatically");
        } else {
          // Fallback: If auto-login fails, show message and let user log in manually
          Alert.alert(
            "Info",
            "Account created! Please log in with your credentials.",
          );
          navigation.navigate("Login");
        }
      } else {
        setError(response.message || "Failed to create account");
      }
    } catch (err) {
      setError(err.message || "An error occurred during signup");
      console.error("Complete signup error:", err);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = getPasswordStrength();

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
            <View style={[styles.dot, styles.dotActive]} />
          </View>
          <Text style={styles.stepText}>Step 3 of 3</Text>
        </View>

        <View style={styles.formSection}>
          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons
                name="lock"
                size={20}
                color="#b38604"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.toggleButton}
              >
                <MaterialIcons
                  name={showPassword ? "visibility" : "visibility-off"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            {/* Password Strength Indicator */}
            {password ? (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  <View
                    style={[
                      styles.strengthFill,
                      { backgroundColor: passwordStrength.color },
                      {
                        width:
                          passwordStrength.level === "Weak"
                            ? "25%"
                            : passwordStrength.level === "Fair"
                              ? "50%"
                              : passwordStrength.level === "Good"
                                ? "75%"
                                : "100%",
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.strengthText,
                    { color: passwordStrength.color },
                  ]}
                >
                  {passwordStrength.level}
                </Text>
              </View>
            ) : null}

            {/* Password Requirements */}
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>
                Password requirements:
              </Text>
              <PasswordRequirement
                met={password.length >= 8}
                text="At least 8 characters"
              />
              <PasswordRequirement
                met={/[A-Z]/.test(password)}
                text="One uppercase letter (A-Z)"
              />
              <PasswordRequirement
                met={/[0-9]/.test(password)}
                text="One number (0-9)"
              />
              <PasswordRequirement
                met={/[!@#$%^&*]/.test(password)}
                text="One special character (!@#$%^&*)"
              />
            </View>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.inputContainer}>
              <MaterialCommunityIcons
                name="lock-check"
                size={20}
                color="#b38604"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                editable={!loading}
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.toggleButton}
              >
                <MaterialIcons
                  name={showConfirm ? "visibility" : "visibility-off"}
                  size={20}
                  color="#999"
                />
              </TouchableOpacity>
            </View>
            {confirmPassword && password === confirmPassword ? (
              <Text style={styles.matchText}>✓ Passwords match</Text>
            ) : confirmPassword && password !== confirmPassword ? (
              <Text style={styles.mismatchText}>✕ Passwords do not match</Text>
            ) : null}
          </View>

          {/* Error Message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.buttonSection}>
          <TouchableOpacity
            style={[styles.signupButton, loading && styles.buttonDisabled]}
            onPress={handleCompleteSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.signupButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already created? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")}>
              <Text style={styles.linkText}>Sign In</Text>
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

const PasswordRequirement = ({ met, text }) => (
  <View style={styles.requirement}>
    <MaterialIcons
      name={met ? "check-circle" : "radio-button-unchecked"}
      size={16}
      color={met ? "#27ae60" : "#ccc"}
    />
    <Text style={[styles.requirementText, met && styles.requirementMet]}>
      {text}
    </Text>
  </View>
);

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
  toggleButton: {
    padding: 8,
  },
  strengthContainer: {
    marginTop: 12,
    gap: 6,
  },
  strengthBar: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: 3,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },
  requirementsContainer: {
    marginTop: 16,
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
  },
  requirementsTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 8,
  },
  requirement: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 12,
    color: "#999",
  },
  requirementMet: {
    color: "#27ae60",
    fontWeight: "500",
  },
  matchText: {
    fontSize: 12,
    color: "#27ae60",
    marginTop: 6,
    fontWeight: "500",
  },
  mismatchText: {
    fontSize: 12,
    color: "#e74c3c",
    marginTop: 6,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffe8e8",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
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
  signupButton: {
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
  signupButtonText: {
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

export default RegisterStep3Screen;
