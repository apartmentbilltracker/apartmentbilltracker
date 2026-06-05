import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { roommateService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import { Toast } from "../../components/CustomAlert";

const getAvatarSource = (profile) => {
  const avatar = profile?.avatar;
  if (avatar?.url?.startsWith?.("http")) return { uri: avatar.url };
  if (typeof avatar === "string" && avatar.startsWith("http")) {
    return { uri: avatar };
  }
  return null;
};

const formatBudget = (budget) => {
  const amount = Number(budget);
  if (!Number.isFinite(amount) || amount <= 0) return "Budget open";
  return `PHP ${amount.toLocaleString()}/mo`;
};

const formatMoveInDate = (value) => {
  if (!value) return "Move-in flexible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const getLocationLabel = (profile) => {
  const locations = Array.isArray(profile?.preferredLocations)
    ? profile.preferredLocations
    : [];
  return locations.length > 0 ? locations.join(", ") : "Location flexible";
};

const SOCIAL_CONFIG = {
  facebook: {
    icon: "logo-facebook",
    color: "#1877F2",
    label: "Facebook",
  },
  instagram: {
    icon: "logo-instagram",
    color: "#C13584",
    label: "Instagram",
  },
  telegram: {
    icon: "paper-plane",
    color: "#229ED9",
    label: "Telegram",
  },
  whatsapp: {
    icon: "logo-whatsapp",
    color: "#25D366",
    label: "WhatsApp",
  },
  tiktok: {
    icon: "logo-tiktok",
    color: "#111111",
    label: "TikTok",
  },
  twitter: {
    icon: "logo-twitter",
    color: "#1DA1F2",
    label: "X",
  },
  linkedin: {
    icon: "logo-linkedin",
    color: "#0A66C2",
    label: "LinkedIn",
  },
  email: {
    icon: "mail-outline",
    color: "#7C3AED",
    label: "Email",
  },
  phone: {
    icon: "call-outline",
    color: "#0F766E",
    label: "Phone",
  },
  link: {
    icon: "link-outline",
    color: "#063F39",
    label: "Social",
  },
};

const getSocialUrl = (value, platformHint = "facebook") => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  if (/^(mailto:|tel:|sms:)/i.test(raw)) return raw;
  if (platformHint === "email") {
    const email = raw.replace(/^mailto:/i, "").trim();
    return email.includes("@") ? `mailto:${email}` : null;
  }
  if (platformHint === "phone") {
    const phone = raw.replace(/[^\d+]/g, "");
    return phone ? `tel:${phone}` : null;
  }

  const withoutAt = raw.replace(/^@/, "");
  const hasUrlShape =
    /^https?:\/\//i.test(withoutAt) ||
    withoutAt.includes(".") ||
    withoutAt.includes("/");
  const withProtocol = /^https?:\/\//i.test(withoutAt)
    ? withoutAt
    : `https://${withoutAt}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    const pathParts = parsed.pathname.split("/").filter(Boolean);

    if (host === "m.me" && pathParts[0]) {
      return `https://m.me/${encodeURIComponent(pathParts[0])}`;
    }

    if (host === "facebook.com" || host === "fb.com") {
      const profileId = parsed.searchParams.get("id");
      const handle = profileId || pathParts[0];
      if (handle && handle !== "profile.php") {
        return `https://m.me/${encodeURIComponent(handle)}`;
      }
      if (profileId) {
        return `https://m.me/${encodeURIComponent(profileId)}`;
      }
    }

    if (hasUrlShape) {
      return parsed.toString();
    }
  } catch (_) {
    // Free-form values are treated as usernames.
  }

  const handle = withoutAt
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .trim();
  if (!handle) return null;

  switch (platformHint) {
    case "instagram":
      return `https://instagram.com/${encodeURIComponent(handle)}`;
    case "telegram":
      return `https://t.me/${encodeURIComponent(handle)}`;
    case "whatsapp": {
      const phone = handle.replace(/[^\d+]/g, "");
      return phone ? `https://wa.me/${phone.replace(/^\+/, "")}` : null;
    }
    case "tiktok":
      return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
    case "twitter":
      return `https://x.com/${encodeURIComponent(handle)}`;
    case "linkedin":
      return `https://www.linkedin.com/in/${encodeURIComponent(handle)}`;
    case "facebook":
    default:
      return `https://m.me/${encodeURIComponent(handle)}`;
  }
};

const getSocialPlatform = (value) => {
  const raw = String(value || "").toLowerCase();
  if (raw.includes("instagram.com")) return "instagram";
  if (raw.includes("t.me") || raw.includes("telegram")) return "telegram";
  if (raw.includes("wa.me") || raw.includes("whatsapp")) return "whatsapp";
  if (raw.includes("tiktok.com")) return "tiktok";
  if (raw.includes("twitter.com") || raw.includes("x.com")) return "twitter";
  if (raw.includes("linkedin.com")) return "linkedin";
  if (raw.includes("@") && !raw.startsWith("@") && !raw.includes("/")) {
    return "email";
  }
  if (/^\+?[\d\s().-]{7,}$/.test(raw.trim())) return "phone";
  if (
    raw.includes("facebook.com") ||
    raw.includes("fb.com") ||
    raw.includes("m.me")
  ) {
    return "facebook";
  }
  if (raw.trim().startsWith("@")) return "facebook";
  if (raw.trim() && !raw.includes(".") && !raw.includes("/")) return "facebook";
  return "link";
};

const getSocialLinks = (profile) => {
  const configured = [];
  const rawSocials = profile?.socials;

  if (Array.isArray(rawSocials)) {
    rawSocials.forEach((item) => {
      const value = item?.url || item?.value || item;
      const platform = item?.platform || getSocialPlatform(value);
      const url = getSocialUrl(value, platform);
      if (!url) return;
      configured.push({
        platform,
        url,
        ...(SOCIAL_CONFIG[platform] || SOCIAL_CONFIG.link),
        label:
          item?.label ||
          SOCIAL_CONFIG[platform]?.label ||
          SOCIAL_CONFIG.link.label,
      });
    });
  } else if (rawSocials && typeof rawSocials === "object") {
    Object.entries(rawSocials).forEach(([platformKey, value]) => {
      const platform = SOCIAL_CONFIG[platformKey] ? platformKey : "link";
      const url = getSocialUrl(value, platform);
      if (!url) return;
      configured.push({
        platform,
        url,
        ...(SOCIAL_CONFIG[platform] || SOCIAL_CONFIG.link),
      });
    });
  }

  const primarySocialPlatform = getSocialPlatform(profile?.facebookAccount);
  const primarySocialUrl = getSocialUrl(
    profile?.facebookAccount,
    primarySocialPlatform,
  );
  if (primarySocialUrl) {
    const config = SOCIAL_CONFIG[primarySocialPlatform] || SOCIAL_CONFIG.link;
    configured.push({
      platform: primarySocialPlatform,
      url: primarySocialUrl,
      ...config,
    });
  }

  const seen = new Set();
  return configured.filter((item) => {
    const key = `${item.platform}:${item.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const ClientRoomieDetailsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);
  const [profile, setProfile] = useState(route.params?.profile || null);
  const [loading, setLoading] = useState(!!route.params?.profileId);
  const [toast, setToast] = useState({
    visible: false,
    type: "success",
    message: "",
  });
  const [openingSocialKey, setOpeningSocialKey] = useState(null);

  const showToast = (message, type = "info") =>
    setToast({ visible: true, type, message });

  const profileId = route.params?.profileId || profile?.id || profile?._id;
  const avatarSource = getAvatarSource(profile);
  const socialLinks = useMemo(() => getSocialLinks(profile), [profile]);
  const stats = useMemo(
    () => [
      {
        icon: "wallet-outline",
        label: "Budget",
        value: formatBudget(profile?.budget),
      },
      {
        icon: "calendar-outline",
        label: "Move In",
        value: formatMoveInDate(profile?.moveInDate),
      },
      {
        icon: "person-outline",
        label: "Gender",
        value: profile?.gender || "Not specified",
      },
      {
        icon: "briefcase-outline",
        label: "Work",
        value: profile?.work || "Not specified",
      },
    ],
    [profile],
  );

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!profileId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const latest = await roommateService.getProfile(profileId);
        if (mounted && latest) setProfile(latest);
      } catch (error) {
        console.error("Error loading roomie details:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      mounted = false;
    };
  }, [profileId]);

  const getSocialKey = (social) => `${social.platform}-${social.url}`;

  const openSocial = async (social) => {
    const url = social?.url;
    if (!url) {
      showToast("This roomie has not configured socials yet.", "warning");
      return;
    }

    const socialKey = getSocialKey(social);
    setOpeningSocialKey(socialKey);

    try {
      await Linking.openURL(url);
    } catch (_) {
      showToast(
        `Could not open this ${social.label || "social"} profile.`,
        "error",
      );
    } finally {
      setOpeningSocialKey((current) => (current === socialKey ? null : current));
    }
  };

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Toast
        visible={toast.visible}
        type={toast.type}
        message={toast.message}
        onHide={() => setToast((t) => ({ ...t, visible: false }))}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.heroImage} />
          ) : (
            <View style={styles.heroFallback}>
              <Text style={styles.heroInitial}>
                {(profile?.name || "R").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.heroShade} />
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.heroInfo}>
            <View style={styles.badgeRow}>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
              {profile?.hasRoom && (
                <View style={styles.roomBadge}>
                  <Ionicons name="home" size={12} color="#063F39" />
                  <Text style={styles.roomBadgeText}>Has room</Text>
                </View>
              )}
            </View>
            <Text style={styles.name}>
              {profile?.name || "Roommate seeker"}
              {profile?.age ? `, ${profile.age}` : ""}
            </Text>
            {!!profile?.work && <Text style={styles.work}>{profile.work}</Text>}
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Preferred Locations</Text>
            <Text style={styles.locationText}>{getLocationLabel(profile)}</Text>
          </View>

          <View style={styles.statsGrid}>
            {stats.map((item) => (
              <View key={item.label} style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name={item.icon} size={17} color={colors.accent} />
                </View>
                <Text style={styles.statLabel}>{item.label}</Text>
                <Text style={styles.statValue}>{item.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>
              {profile?.bio || "No additional details shared yet."}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Socials</Text>
            {socialLinks.length > 0 ? (
              <View style={styles.socialRow}>
                {socialLinks.map((social) => {
                  const socialKey = getSocialKey(social);
                  const isOpening = openingSocialKey === socialKey;

                  return (
                    <TouchableOpacity
                      key={socialKey}
                      style={[
                        styles.socialButton,
                        { backgroundColor: social.color },
                        isOpening && styles.socialButtonLoading,
                      ]}
                      onPress={() => openSocial(social)}
                      activeOpacity={0.82}
                      accessibilityLabel={`Open ${social.label}`}
                      disabled={!!openingSocialKey}
                    >
                      {isOpening ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Ionicons name={social.icon} size={22} color="#fff" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.bioText}>No socials provided yet.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const createStyles = (colors, insets) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingBottom: Math.max(110, insets.bottom + 88),
    },
    hero: {
      height: 340,
      backgroundColor: "#063F39",
      position: "relative",
    },
    heroImage: {
      width: "100%",
      height: "100%",
    },
    heroFallback: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0B5A52",
    },
    heroInitial: {
      fontSize: 84,
      fontWeight: "900",
      color: "rgba(255,255,255,0.84)",
    },
    heroShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.28)",
    },
    backBtn: {
      position: "absolute",
      top: 20,
      left: 16,
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.34)",
    },
    heroInfo: {
      position: "absolute",
      left: 18,
      right: 18,
      bottom: 22,
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 10,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(6,63,57,0.78)",
    },
    verifiedText: {
      fontSize: 11,
      fontWeight: "900",
      color: "#fff",
    },
    roomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.88)",
    },
    roomBadgeText: {
      fontSize: 11,
      fontWeight: "900",
      color: "#063F39",
    },
    name: {
      fontSize: 30,
      fontWeight: "900",
      color: "#fff",
    },
    work: {
      fontSize: 14,
      fontWeight: "800",
      color: "rgba(255,255,255,0.86)",
      marginTop: 4,
    },
    body: {
      padding: 16,
      gap: 14,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "900",
      color: colors.text,
      marginBottom: 7,
    },
    locationText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    bioText: {
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
    },
    socialRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    socialButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    socialButtonLoading: {
      opacity: 0.78,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statCard: {
      width: "48.5%",
      minHeight: 116,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 13,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    statIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSurface,
      marginBottom: 9,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      marginBottom: 4,
    },
    statValue: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900",
      color: colors.text,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: Math.max(18, insets.bottom + 10),
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight || colors.border,
    },
    contactGateway: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
    },
    contactIconBtn: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
    },
    contactGatewayEmpty: {
      minHeight: 50,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      backgroundColor: colors.cardAlt,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    contactGatewayEmptyText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textTertiary,
    },
  });

export default ClientRoomieDetailsScreen;
