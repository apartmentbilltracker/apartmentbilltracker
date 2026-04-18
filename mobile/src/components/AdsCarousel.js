import React, { useEffect, useState, useRef } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  Linking,
  Modal,
} from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { adsService } from "../services/apiService";
import { useTheme } from "../theme/ThemeContext";

const { width, height } = Dimensions.get("window");
const AD_CONTAINER_HEIGHT = height * 0.75; // 75% of screen height for portrait ads
const AD_CONTAINER_WIDTH = (AD_CONTAINER_HEIGHT * 9) / 16; // 9:16 portrait aspect ratio

/**
 * AdsCarousel Component
 * Displays promotional ads in a full-screen modal
 * Features:
 * - Full-screen modal display
 * - Swipeable carousel for multiple ads
 * - Click tracking
 * - Dismiss functionality
 * - Dot indicators
 */
export const AdsCarousel = ({
  screen = "home",
  style = {},
  navigation = null,
}) => {
  const { colors } = useTheme();
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedAds, setDismissedAds] = useState(new Set());
  const [showModal, setShowModal] = useState(false);
  const scrollViewRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAds();
  }, [screen]);

  const loadAds = async () => {
    try {
      setLoading(true);
      const response = await adsService.getAds(screen);
      setAds(response || []);
      // Show modal if ads exist
      if (response && response.length > 0) {
        setShowModal(true);
      }
    } catch (error) {
      console.error("Error loading ads:", error);
      setAds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAdClick = async (ad) => {
    try {
      // Track the click
      await adsService.trackAdClick(ad.id);

      // Handle link - supports both external URLs and app screen routes
      if (ad.buttonLink) {
        // Check if it's an internal app route (starts with / or is a screen name)
        const isInternalRoute =
          ad.buttonLink.startsWith("/") || ad.buttonLink.match(/^[a-zA-Z]+$/);

        if (isInternalRoute && navigation) {
          // Internal app screen navigation with support for nested screens
          const screenName = ad.buttonLink.startsWith("/")
            ? ad.buttonLink.substring(1)
            : ad.buttonLink;

          // Map screens to their parent stacks (for nested navigation)
          const screenToStackMap = {
            // BillsStack
            BillsMain: "BillsStack",
            BillingHistory: "BillsStack",
            PaymentMethod: "BillsStack",
            GCashPayment: "BillsStack",
            BankTransferPayment: "BillsStack",
            CashPayment: "BillsStack",
            PaymentHistory: "BillsStack",
            Settlement: "BillsStack",

            // HomeStack
            ClientHome: "HomeStack",
            RoomDetails: "HomeStack",
            Presence: "HomeStack",

            // PresenceStack
            PresenceMain: "PresenceStack",
            Billing: "HomeStack",

            // ProfileStack
            Profile: "ProfileStack",
            MyTickets: "ProfileStack",
            MyBugReports: "ProfileStack",
            TermsOfService: "ProfileStack",
            PrivacyPolicy: "ProfileStack",

            // AnnouncementsStack
            AnnouncementsMain: "AnnouncementsStack",

            // NotificationsStack
            NotificationsInbox: "NotificationsStack",

            // Top-level/ChatRoom
            ChatRoom: null, // Top-level, no parent
          };

          const parentStack = screenToStackMap[screenName];

          if (parentStack) {
            // Navigate to nested screen via parent stack
            navigation.navigate(parentStack, { screen: screenName });
          } else {
            // Direct navigation for top-level screens
            navigation.navigate(screenName);
          }
        } else {
          // External URL - open in browser
          const canOpen = await Linking.canOpenURL(ad.buttonLink);
          if (canOpen) {
            await Linking.openURL(ad.buttonLink);
          }
        }
      }
    } catch (error) {
      console.error("Error handling ad click:", error);
    }
  };

  const handleDismissAd = async (adId) => {
    try {
      // Dismiss on backend
      await adsService.dismissAd(adId);

      // Remove from local state
      const newDismissed = new Set(dismissedAds);
      newDismissed.add(adId);
      setDismissedAds(newDismissed);

      // Filter out dismissed ad
      const updatedAds = ads.filter((ad) => ad.id !== adId);
      setAds(updatedAds);

      // Adjust current index if needed
      if (currentIndex >= updatedAds.length && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      }

      // Close modal if no ads left
      if (updatedAds.length === 0) {
        setShowModal(false);
      }
    } catch (error) {
      console.error("Error dismissing ad:", error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false },
  );

  const handleScrollEnd = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const currentIndex = Math.round(contentOffsetX / width);
    setCurrentIndex(currentIndex);
  };

  if (loading || ads.length === 0) {
    return null;
  }

  const visibleAds = ads.filter((ad) => !dismissedAds.has(ad.id));

  if (visibleAds.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={showModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseModal}
    >
      <BlurView intensity={10} style={{ flex: 1 }}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: "rgba(0, 0, 0, 0.6)" },
          ]}
        >
          {/* Carousel */}
          <ScrollView
            ref={scrollViewRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            onMomentumScrollEnd={handleScrollEnd}
            scrollEventThrottle={16}
            style={styles.carousel}
          >
            {visibleAds.map((ad, index) => (
              <View
                key={ad.id}
                style={[
                  styles.adContainer,
                  {
                    width: width,
                    height: height,
                    justifyContent: "center",
                    alignItems: "center",
                  },
                ]}
              >
                {/* Centered Portrait Ad Card - Clickable */}
                <TouchableOpacity
                  activeOpacity={ad.buttonLink ? 0.85 : 1}
                  onPress={ad.buttonLink ? () => handleAdClick(ad) : null}
                  disabled={!ad.buttonLink}
                  style={{
                    width: AD_CONTAINER_WIDTH,
                    height: AD_CONTAINER_HEIGHT,
                    borderRadius: 16,
                    overflow: "hidden",
                    backgroundColor: "#000",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  {/* Ad Image - Full Card */}
                  <Image
                    source={{ uri: ad.imageUrl }}
                    style={styles.adImage}
                    resizeMode="cover"
                  />

                  {/* Ad Content Overlay - More Transparent */}
                  <View
                    style={[
                      styles.adContent,
                      { backgroundColor: "transparent" },
                    ]}
                  >
                    {/* Title - Optional */}
                    {ad.title && (
                      <Text
                        style={[styles.adTitle, { color: colors.textOnAccent }]}
                        numberOfLines={2}
                      >
                        {ad.title}
                      </Text>
                    )}

                    {/* Description - Optional */}
                    {ad.description && (
                      <Text
                        style={[
                          styles.adDescription,
                          { color: colors.textOnAccent },
                        ]}
                        numberOfLines={2}
                      >
                        {ad.description}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                {/* Reminder Text - Outside Ad Card */}
                <TouchableOpacity
                  style={styles.reminderBar}
                  onPress={handleCloseModal}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.remindMeLaterText, { color: "#D0D0D0" }]}
                  >
                    Remind me later
                  </Text>
                  {visibleAds.length > 1 && (
                    <View style={styles.counterContainer}>
                      <Ionicons name="chevron-back" size={14} color="#D0D0D0" />
                      <Text
                        style={[
                          {
                            color: "#D0D0D0",
                            fontWeight: "700",
                            marginHorizontal: 4,
                          },
                        ]}
                      >
                        {currentIndex + 1}/{visibleAds.length}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color="#D0D0D0"
                      />
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = {
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    flexDirection: "column",
  },
  carousel: {
    flex: 1,
  },
  adContainer: {
    position: "relative",
  },
  closeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    elevation: 5,
  },
  adImage: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  adContent: {
    position: "absolute",
    bottom: 60,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 40,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  reminderBar: {
    marginTop: -4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    gap: 8,
  },
  counterContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  adTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 28,
    textAlign: "center",
  },
  adDescription: {
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
  },
  ctaButton: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "600",
  },
  indicatorContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  adIndicatorContainer: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  remindMeLaterText: {
    fontSize: 13,
    fontWeight: "600",
  },
  swipeHintContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  swipeHintText: {
    fontSize: 12,
    fontWeight: "500",
  },
  adCounter: {
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
};

export default AdsCarousel;
