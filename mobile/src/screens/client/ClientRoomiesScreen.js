import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { roommateService } from "../../services/apiService";
import { useTheme } from "../../theme/ThemeContext";
import HomeSpaceLoader from "../../components/SpaceLoader";

const CARD_GAP = 12;
const H_PADDING = 16;
const MIN_CARD_WIDTH = 196;
const VISIBLE_CARD_UNITS = 1.65;

const getProfileId = (profile) => profile?.id || profile?._id;

const getAvatarSource = (profile) => {
  const avatar = profile?.avatar;
  if (avatar?.url?.startsWith?.("http")) return { uri: avatar.url };
  if (typeof avatar === "string" && avatar.startsWith("http")) {
    return { uri: avatar };
  }
  return null;
};

const getBudgetAmount = (profile) => {
  const amount = Number(profile?.budget);
  return Number.isFinite(amount) && amount > 0
    ? amount
    : Number.MAX_SAFE_INTEGER;
};

const getMoveInTime = (profile) => {
  const time = new Date(profile?.moveInDate || "").getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
};

const getPrimaryLocation = (profile) => {
  const locations = Array.isArray(profile?.preferredLocations)
    ? profile.preferredLocations
    : [];
  return locations[0] || "Location flexible";
};

const getLocationLabel = (profile) => {
  const locations = Array.isArray(profile?.preferredLocations)
    ? profile.preferredLocations
    : [];
  return locations.length > 0 ? locations.join(", ") : "Location flexible";
};

const formatBudget = (budget) => {
  const amount = Number(budget);
  if (!Number.isFinite(amount) || amount <= 0) return "Budget open";
  if (amount >= 1000) {
    return `PHP ${(amount / 1000).toFixed(amount % 1000 === 0 ? 0 : 1)}K/mo`;
  }
  return `PHP ${amount.toLocaleString()}/mo`;
};

const formatMoveInDate = (value) => {
  if (!value) return "Move-in flexible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const ClientRoomiesScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => {
    const availableWidth = screenWidth - H_PADDING * 2 - CARD_GAP;
    return Math.max(
      MIN_CARD_WIDTH,
      Math.floor(availableWidth / VISIBLE_CARD_UNITS),
    );
  }, [screenWidth]);
  const styles = createStyles(colors, insets, cardWidth);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const verifiedProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile?.isVerified !== false && (profile?.id || profile?._id),
      ),
    [profiles],
  );

  const budgetProfiles = useMemo(
    () =>
      [...verifiedProfiles].sort(
        (a, b) => getBudgetAmount(a) - getBudgetAmount(b),
      ),
    [verifiedProfiles],
  );

  const moveInProfiles = useMemo(
    () =>
      [...verifiedProfiles].sort((a, b) => getMoveInTime(a) - getMoveInTime(b)),
    [verifiedProfiles],
  );

  const locationProfiles = useMemo(
    () =>
      [...verifiedProfiles].sort((a, b) =>
        getPrimaryLocation(a).localeCompare(getPrimaryLocation(b)),
      ),
    [verifiedProfiles],
  );

  const fetchProfiles = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      const response = await roommateService.getProfiles();
      setProfiles(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error loading roomies:", error);
      setProfiles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchProfiles(true);
    }, [fetchProfiles]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchProfiles(false);
  }, [fetchProfiles]);

  const openDetails = (profile) => {
    navigation.navigate("RoomieDetails", {
      profileId: getProfileId(profile),
      profile,
    });
  };

  const renderCard = (profile, sectionType, index, count) => {
    const avatarSource = getAvatarSource(profile);
    const emphasis =
      sectionType === "budget"
        ? {
            icon: "wallet-outline",
            label: formatBudget(profile.budget),
          }
        : sectionType === "moveIn"
          ? {
              icon: "calendar-outline",
              label: formatMoveInDate(profile.moveInDate),
            }
          : {
              icon: "location-outline",
              label: getPrimaryLocation(profile),
            };

    return (
      <TouchableOpacity
        key={`${sectionType}-${getProfileId(profile)}`}
        style={[styles.roomieCard, index === count - 1 && styles.lastCard]}
        activeOpacity={0.86}
        onPress={() => openDetails(profile)}
      >
        <View style={styles.photoWrap}>
          {avatarSource ? (
            <Image source={avatarSource} style={styles.photo} />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoInitial}>
                {(profile.name || "R").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.photoShade} />
          <View style={styles.topBadges}>
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={11} color="#fff" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
            {profile.hasRoom && (
              <View style={styles.hasRoomBadge}>
                <Ionicons name="home" size={11} color="#063F39" />
                <Text style={styles.hasRoomText}>Has room</Text>
              </View>
            )}
          </View>
          <View style={styles.nameBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {profile.name}
              {profile.age ? `, ${profile.age}` : ""}
            </Text>
            {!!profile.work && (
              <Text style={styles.work} numberOfLines={1}>
                {profile.work}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.actionRow}>
            <View style={styles.emphasisPill}>
              <Ionicons name={emphasis.icon} size={12} color={colors.accent} />
              <Text style={styles.emphasisText} numberOfLines={1}>
                {emphasis.label}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.viewBtn}
              onPress={() => openDetails(profile)}
              activeOpacity={0.8}
            >
              <Text style={styles.viewBtnText}>View</Text>
              <Ionicons name="arrow-forward" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="location-outline"
              size={13}
              color={colors.textTertiary}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {getLocationLabel(profile)}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons
              name="wallet-outline"
              size={13}
              color={colors.textTertiary}
            />
            <Text style={styles.metaText} numberOfLines={1}>
              {formatBudget(profile.budget)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const Section = ({ title, subtitle, data, sectionType }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carouselContent}
        decelerationRate="fast"
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
      >
        {data.map((profile, index) =>
          renderCard(profile, sectionType, index, data.length),
        )}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Roomies</Text>
          <Text style={styles.headerSubtitle}>
            Browse verified renters by what matters most.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <View style={styles.centerLoader}>
            <HomeSpaceLoader />
          </View>
        </View>
      ) : verifiedProfiles.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
            />
          }
        >
          <View style={styles.emptyIcon}>
            <Ionicons name="people-outline" size={34} color={colors.accent} />
          </View>
          <Text style={styles.emptyTitle}>No roomies listed yet</Text>
          <Text style={styles.emptyText}>
            Verified roommate profiles will appear here.
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.accent]}
            />
          }
        >
          <Section
            title="By Budget"
            subtitle="Lower monthly budgets first."
            data={budgetProfiles}
            sectionType="budget"
          />
          <Section
            title="By Move-in Date"
            subtitle="Soonest move-in plans first."
            data={moveInProfiles}
            sectionType="moveIn"
          />
          <Section
            title="By Preferred Locations"
            subtitle="Grouped around each roomie's first preferred area."
            data={locationProfiles}
            sectionType="location"
          />
        </ScrollView>
      )}
    </View>
  );
};

const createStyles = (colors, insets, cardWidth) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingTop: 20,
      paddingHorizontal: 16,
      paddingBottom: 18,
      backgroundColor: "#063F39",
      borderBottomLeftRadius: 26,
      borderBottomRightRadius: 26,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "900",
      color: "#fff",
    },
    headerSubtitle: {
      fontSize: 12,
      color: "rgba(255,255,255,0.76)",
      marginTop: 3,
    },
    centered: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingTop: 14,
      paddingBottom: Math.max(30, insets.bottom + 20),
      gap: 18,
    },
    section: {
      gap: 10,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: 16,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.text,
    },
    sectionSubtitle: {
      fontSize: 12,
      color: colors.textTertiary,
      marginTop: 3,
    },
    carouselContent: {
      paddingLeft: 16,
      paddingRight: 8,
      paddingBottom: 2,
    },
    roomieCard: {
      width: cardWidth,
      marginRight: CARD_GAP,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 4,
    },
    lastCard: {
      marginRight: 16,
    },
    photoWrap: {
      height: 164,
      backgroundColor: "#063F39",
      position: "relative",
    },
    photo: {
      width: "100%",
      height: "100%",
    },
    photoFallback: {
      width: "100%",
      height: "100%",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#0B5A52",
    },
    photoInitial: {
      fontSize: 44,
      fontWeight: "900",
      color: "rgba(255,255,255,0.84)",
    },
    photoShade: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.24)",
    },
    topBadges: {
      position: "absolute",
      top: 10,
      left: 10,
      right: 10,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 7,
    },
    verifiedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(6,63,57,0.78)",
    },
    verifiedText: {
      fontSize: 10,
      fontWeight: "900",
      color: "#fff",
    },
    hasRoomBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.88)",
    },
    hasRoomText: {
      fontSize: 10,
      fontWeight: "900",
      color: "#063F39",
    },
    nameBlock: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 11,
    },
    name: {
      fontSize: 17,
      fontWeight: "900",
      color: "#fff",
    },
    work: {
      fontSize: 12,
      fontWeight: "800",
      color: "rgba(255,255,255,0.86)",
      marginTop: 3,
    },
    cardBody: {
      padding: 11,
      gap: 7,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    emphasisPill: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minWidth: 0,
      paddingHorizontal: 9,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.borderLight || colors.border,
    },
    emphasisText: {
      flex: 1,
      fontSize: 11,
      fontWeight: "900",
      color: colors.text,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaText: {
      flex: 1,
      fontSize: 11,
      fontWeight: "600",
      color: colors.textTertiary,
    },
    viewBtn: {
      height: 32,
      minWidth: 62,
      paddingHorizontal: 10,
      borderRadius: 999,
      backgroundColor: "#063F39",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    viewBtnText: {
      fontSize: 11,
      fontWeight: "900",
      color: "#fff",
    },
    emptyContent: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 28,
    },
    emptyIcon: {
      width: 70,
      height: 70,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accentSurface,
      marginBottom: 14,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: colors.text,
    },
    emptyText: {
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      color: colors.textTertiary,
      marginTop: 5,
    },
  });

export default ClientRoomiesScreen;
