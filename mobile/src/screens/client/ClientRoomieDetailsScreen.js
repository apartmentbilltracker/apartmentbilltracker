import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const getMessengerUrl = (facebookAccount) => {
  const raw = String(facebookAccount || "").trim();
  if (!raw) return null;

  const withoutAt = raw.replace(/^@/, "");
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
  } catch (_) {
    // Free-form values are treated as usernames.
  }

  const handle = withoutAt
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .trim();
  if (!handle) return null;

  return `https://m.me/${encodeURIComponent(handle)}`;
};

const ClientRoomieDetailsScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets);
  const [profile, setProfile] = useState(route.params?.profile || null);
  const [loading, setLoading] = useState(!!route.params?.profileId);

  const profileId = route.params?.profileId || profile?.id || profile?._id;
  const avatarSource = getAvatarSource(profile);
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

  const openMessenger = () => {
    const url = getMessengerUrl(profile?.facebookAccount);
    if (!url) {
      Alert.alert(
        "Facebook account needed",
        "This roomies profile has no Facebook or Messenger account yet.",
      );
      return;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Messenger unavailable",
        "Could not open this Messenger profile. Please check their Facebook account.",
      );
    });
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
            <Text style={styles.sectionTitle}>Messenger</Text>
            <Text style={styles.bioText}>
              {profile?.facebookAccount || "No Facebook account provided."}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.messageBtn}
          onPress={openMessenger}
          activeOpacity={0.85}
        >
          <Ionicons name="logo-facebook" size={18} color="#fff" />
          <Text style={styles.messageBtnText}>Message on Messenger</Text>
        </TouchableOpacity>
      </View>
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
    messageBtn: {
      height: 50,
      borderRadius: 15,
      backgroundColor: "#1877F2",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    messageBtnText: {
      fontSize: 15,
      fontWeight: "900",
      color: "#fff",
    },
  });

export default ClientRoomieDetailsScreen;
