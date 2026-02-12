import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../theme/ThemeContext";
import AuthBubbles from "../../components/AuthBubbles";

const TermsOfServiceScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const sections = [
    {
      title: "1. Acceptance of Terms",
      content:
        "By downloading, installing, or using the Apartment Bill Tracker application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.",
    },
    {
      title: "2. Description of Service",
      content:
        'Apartment Bill Tracker is a mobile application designed to help apartment residents and administrators manage shared utility bills, track payments, and split costs fairly among roommates. The app provides features including bill tracking, presence-based water billing, payment management, and billing cycle administration ("the Service").',
    },
    {
      title: "3. User Accounts",
      content:
        "To use the Service, you must create an account by providing accurate and complete information including your name and email address. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.",
    },
    {
      title: "4. User Responsibilities",
      body: [
        "Provide accurate billing and payment information",
        "Mark your presence/absence honestly for fair bill splitting",
        "Not attempt to manipulate billing calculations or payment records",
        "Not use the Service for any unlawful purpose",
        "Not interfere with or disrupt the Service or servers",
        "Keep your account credentials secure",
      ],
    },
    {
      title: "5. Administrator Responsibilities",
      content:
        "Room administrators are responsible for accurately entering utility bill amounts, managing billing cycles, verifying payments, and ensuring fair treatment of all room members. Administrators must not abuse their privileges to manipulate bills or payments.",
    },
    {
      title: "6. Billing & Payments",
      content:
        "The app facilitates tracking of shared bills and payments between roommates. Apartment Bill Tracker is not a payment processor — it tracks and records payments made through external methods (cash, bank transfer, GCash, etc.). We are not responsible for disputes between users regarding payments made outside the app.",
    },
    {
      title: "7. Data Accuracy",
      content:
        "While we strive for accuracy in bill calculations and splitting, users should verify all amounts before making payments. We use penny-accurate math to ensure fair splitting, but the accuracy of results depends on the accuracy of data entered by administrators.",
    },
    {
      title: "8. Intellectual Property",
      content:
        "The Service, including its design, features, and content, is owned by the developer. You are granted a limited, non-exclusive, non-transferable license to use the application for its intended purpose.",
    },
    {
      title: "9. Limitation of Liability",
      content:
        'The Service is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Service, including but not limited to financial losses from incorrect bill calculations or payment disputes.',
    },
    {
      title: "10. Termination",
      content:
        "We reserve the right to suspend or terminate your account at any time for violation of these terms. You may delete your account at any time by contacting an administrator. Upon termination, your access to the Service will cease immediately.",
    },
    {
      title: "11. Changes to Terms",
      content:
        "We may update these Terms of Service from time to time. Continued use of the Service after changes constitutes acceptance of the modified terms. We will notify users of significant changes through the app.",
    },
    {
      title: "12. Contact",
      content:
        "If you have questions about these Terms of Service, please contact the app administrator or developer through the in-app support ticket system.",
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
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="document-text" size={36} color={colors.accent} />
          </View>
        </View>

        <Text style={styles.lastUpdated}>Last updated: February 11, 2026</Text>

        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content ? (
              <Text style={styles.sectionContent}>{section.content}</Text>
            ) : null}
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
      paddingTop: Platform.OS === "ios" ? 56 : 44,
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
      marginBottom: 24,
      fontWeight: "500",
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
    },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 6,
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

export default TermsOfServiceScreen;
