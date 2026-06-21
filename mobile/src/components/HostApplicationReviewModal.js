import React from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import ModalBottomSpacer from "./ModalBottomSpacer";

const DetailRow = ({ label, value, sensitive }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, sensitive && styles.sensitiveValue]}
        selectable
      >
        {value || "Not provided"}
      </Text>
    </View>
  );
};

const VerificationImage = ({ label, uri, icon }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.imageCard}>
      <View style={styles.imageHeader}>
        <Ionicons name={icon} size={15} color={colors.accent} />
        <Text style={styles.imageLabel}>{label}</Text>
      </View>
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.verificationImage} />
          <TouchableOpacity
            style={styles.openButton}
            onPress={() => Linking.openURL(uri)}
          >
            <Ionicons name="open-outline" size={14} color={colors.accent} />
            <Text style={styles.openButtonText}>Open full image</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.missingImage}>
          <Ionicons name="image-outline" size={26} color={colors.textTertiary} />
          <Text style={styles.missingText}>No image uploaded</Text>
        </View>
      )}
    </View>
  );
};

const HostApplicationReviewModal = ({
  visible,
  request,
  onClose,
  onApprove,
  onReject,
  processing,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const application = request?.host_application || {};
  const personal = application.personalDetails || {};
  const address = personal.address || {};
  const governmentId = application.governmentId || {};
  const documents = application.documents || {};
  const facial = application.facialVerification || {};
  const consent = application.consent || {};

  return (
    <Modal animationType="slide" transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons
                name="shield-checkmark"
                size={20}
                color={colors.textOnAccent}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title} numberOfLines={1}>
                Host Application
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {request?.name || "Unknown applicant"}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={processing}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.summaryCard}>
              <View style={styles.avatarWrap}>
                {request?.avatar?.url ? (
                  <Image
                    source={{ uri: request.avatar.url }}
                    style={styles.avatar}
                  />
                ) : (
                  <Text style={styles.avatarText}>
                    {(request?.name || "U").charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.applicantName}>{request?.name}</Text>
                <Text style={styles.applicantEmail}>{request?.email}</Text>
                <Text style={styles.reviewNote}>
                  ID formats are checked automatically. Image authenticity still
                  requires visual review.
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Personal Details</Text>
            <View style={styles.detailCard}>
              <DetailRow label="Legal Name" value={personal.legalName} />
              <DetailRow label="Birth Date" value={personal.birthDate} />
              <DetailRow label="Phone" value={personal.phoneNumber} />
              <DetailRow
                label="Address"
                value={[
                  address.line,
                  address.city,
                  address.province,
                  address.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
            </View>

            <Text style={styles.sectionLabel}>Government ID</Text>
            <View style={styles.detailCard}>
              <DetailRow label="ID Type" value={governmentId.typeLabel} />
              <DetailRow
                label="ID Number"
                value={governmentId.number}
                sensitive
              />
              <DetailRow
                label="Validation"
                value={
                  governmentId.formatValid
                    ? "Format passed"
                    : "Format did not pass"
                }
              />
            </View>

            <Text style={styles.sectionLabel}>Verification Images</Text>
            <VerificationImage
              label="ID Front"
              uri={documents.idFront?.signedUrl}
              icon="card-outline"
            />
            <VerificationImage
              label="ID Back"
              uri={documents.idBack?.signedUrl}
              icon="albums-outline"
            />
            <VerificationImage
              label="Live Selfie"
              uri={facial.selfie?.signedUrl}
              icon="person-circle-outline"
            />

            <Text style={styles.sectionLabel}>Consent and Notes</Text>
            <View style={styles.detailCard}>
              <DetailRow
                label="Consent"
                value={consent.accepted ? "Accepted" : "Not accepted"}
              />
              <DetailRow label="Submitted" value={application.submittedAt} />
              <DetailRow label="Applicant Notes" value={application.notes} />
            </View>

            <View style={styles.actions}>
              {processing ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => onApprove(request?.id, request?.name)}
                  >
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color={colors.textOnAccent}
                    />
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.rejectButton}
                    onPress={() => onReject(request?.id, request?.name)}
                  >
                    <Ionicons name="close" size={18} color={colors.error} />
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <ModalBottomSpacer />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      maxHeight: "92%",
    },
    handle: {
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.skeleton,
      alignSelf: "center",
      marginTop: 10,
      marginBottom: 14,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
    },
    headerCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
    },
    summaryCard: {
      flexDirection: "row",
      gap: 12,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 14,
    },
    avatarWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      overflow: "hidden",
    },
    avatar: {
      width: "100%",
      height: "100%",
    },
    avatarText: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
    summaryCopy: {
      flex: 1,
      minWidth: 0,
    },
    applicantName: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.text,
    },
    applicantEmail: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },
    reviewNote: {
      marginTop: 6,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textTertiary,
    },
    sectionLabel: {
      marginTop: 8,
      marginBottom: 8,
      fontSize: 12,
      fontWeight: "800",
      color: colors.textTertiary,
      textTransform: "uppercase",
    },
    detailCard: {
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 12,
      overflow: "hidden",
    },
    detailRow: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    detailLabel: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.textTertiary,
      textTransform: "uppercase",
      marginBottom: 3,
    },
    detailValue: {
      fontSize: 14,
      lineHeight: 19,
      color: colors.text,
      fontWeight: "600",
    },
    sensitiveValue: {
      letterSpacing: 0.3,
    },
    imageCard: {
      padding: 12,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderLight,
      marginBottom: 10,
    },
    imageHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 9,
    },
    imageLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.text,
    },
    verificationImage: {
      width: "100%",
      height: 180,
      borderRadius: 12,
      backgroundColor: colors.inputBg,
    },
    missingImage: {
      height: 110,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.inputBg,
      gap: 4,
    },
    missingText: {
      fontSize: 12,
      color: colors.textTertiary,
    },
    openButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 11,
      backgroundColor: colors.accentSurface,
      marginTop: 10,
    },
    openButtonText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.accent,
    },
    actions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    approveButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 15,
      backgroundColor: colors.success,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    approveText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textOnAccent,
    },
    rejectButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 15,
      backgroundColor: colors.errorBg,
      borderWidth: 1,
      borderColor: colors.error,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
    },
    rejectText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.error,
    },
  });

export default HostApplicationReviewModal;
