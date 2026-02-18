import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import AuthBubbles from "../../components/AuthBubbles";

const PrivacyPolicyScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const sections = [
    {
      title: "1. Information We Collect",
      subsections: [
        {
          subtitle: "Account Information",
          body: [
            "Full name",
            "Email address",
            "Password (encrypted/hashed — we never store plain text)",
            "Profile avatar (optional)",
            "Authentication provider (email, Google, or Facebook)",
          ],
        },
        {
          subtitle: "Usage Data",
          body: [
            "Room membership and role (admin/member)",
            "Presence/absence records for bill splitting",
            "Payment records and transaction history",
            "Billing cycle data and charge adjustments",
          ],
        },
        {
          subtitle: "Device Information",
          body: [
            "Push notification tokens (for reminders)",
            "Device type (for app compatibility)",
          ],
        },
      ],
    },
    {
      title: "2. How We Use Your Information",
      body: [
        "Create and manage your account",
        "Calculate fair bill splits based on presence",
        "Track payments and billing cycles",
        "Send push notifications for billing reminders and updates",
        "Generate billing reports and payment summaries",
        "Verify your identity for account security",
        "Provide customer support through the ticket system",
      ],
    },
    {
      title: "3. Data Storage & Security",
      content:
        "Your data is stored securely using Supabase (cloud database) with row-level security policies. Passwords are hashed using bcrypt. Authentication tokens (JWT) are stored securely on your device using encrypted storage (Expo SecureStore). We implement industry-standard security measures to protect your personal information.",
    },
    {
      title: "4. Data Sharing",
      content:
        "We do not sell, trade, or rent your personal data to third parties. Your information may be shared in the following limited circumstances:",
      body: [
        "With your room administrator — to manage billing and verify payments",
        "With room members — only aggregated billing data (not your personal payment details)",
        "With Google/Facebook — only if you choose to sign in via OAuth (limited to authentication)",
        "As required by law — if legally compelled to disclose information",
      ],
    },
    {
      title: "5. Payment Privacy",
      content:
        "Each member can only view their own payment history and transaction details. Administrators can view payment status (paid/unpaid) for billing management purposes but individual payment method details are kept private.",
    },
    {
      title: "6. Third-Party Services",
      content: "The app integrates with the following third-party services:",
      body: [
        "Supabase — database and data storage",
        "Google OAuth — optional sign-in method",
        "Facebook OAuth — optional sign-in method",
        "Expo Push Notifications — for billing reminders",
        "SMTP email service — for verification codes and password resets",
      ],
    },
    {
      title: "7. Data Retention",
      content:
        "Your account data is retained as long as your account is active. Billing history and payment records are kept for record-keeping purposes. If you request account deletion, your personal data will be removed, though anonymized billing records may be retained for the room's accounting integrity.",
    },
    {
      title: "8. Your Rights",
      body: [
        "Access your personal data through your profile",
        "Update or correct your account information",
        "Request deletion of your account and personal data",
        "Opt out of non-essential push notifications",
        "Export your billing and payment history (PDF export)",
      ],
    },
    {
      title: "9. Children's Privacy",
      content:
        "The Service is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal data, please contact us.",
    },
    {
      title: "10. Cookies & Local Storage",
      content:
        "The app uses local device storage (AsyncStorage and SecureStore) to save preferences, authentication tokens, and cached data for offline functionality. No browser cookies are used.",
    },
    {
      title: "11. Changes to This Policy",
      content:
        "We may update this Privacy Policy periodically. Changes will be communicated through the app. Your continued use of the Service after changes constitutes acceptance of the updated policy.",
    },
    {
      title: "12. Contact Us",
      content:
        "For privacy-related questions or to exercise your data rights, please use the in-app support ticket system or contact the app administrator.",
    },
  ];

  return (
    <View style={styles.container}>
      <AuthBubbles />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={36} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.lastUpdated}>Last updated: February 11, 2026</Text>

        <Text style={styles.intro}>
          Your privacy is important to us. This Privacy Policy explains how
          Apartment Bill Tracker collects, uses, and protects your personal
          information.
        </Text>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content ? (
              <Text style={styles.sectionContent}>{section.content}</Text>
            ) : null}
            {section.subsections
              ? section.subsections.map((sub, si) => (
                  <View key={si} style={styles.subsection}>
                    <Text style={styles.subtitle}>{sub.subtitle}</Text>
                    {sub.body.map((item, bi) => (
                      <View key={bi} style={styles.bulletRow}>
                        <View style={styles.bullet} />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                ))
              : null}
            {section.body
              ? section.body.map((item, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <View style={styles.bullet} />
                    <Text style={styles.bulletText}>{item}</Text>
                  </View>
                ))
              : null}
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      justifyContent: "center",
      alignItems: "center",
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: colors.text,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingBottom: 36,
    },
    iconWrap: {
      alignItems: "center",
      marginVertical: 20,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.accent + "15",
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.accent + "25",
    },
    lastUpdated: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
      marginBottom: 16,
      fontWeight: "500",
    },
    intro: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 24,
      textAlign: "center",
      paddingHorizontal: 8,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: 8,
    },
    sectionContent: {
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
      marginBottom: 6,
    },
    subsection: {
      marginTop: 10,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 6,
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 4,
    },
    bullet: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.accent,
      marginTop: 8,
    },
    bulletText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 22,
      color: colors.textSecondary,
    },
  });

export default PrivacyPolicyScreen;
