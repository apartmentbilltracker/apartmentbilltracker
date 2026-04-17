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
export const AdsCarousel = ({ screen = "home", style = {} }) => {
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

      // Open link if available
      if (ad.buttonLink) {
        const canOpen = await Linking.canOpenURL(ad.buttonLink);
        if (canOpen) {
          await Linking.openURL(ad.buttonLink);
        }
      }
    } catch (error) {
      console.error("Error tracking ad click:", error);
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
      <View
        style={[
          styles.modalContainer,
          { backgroundColor: "rgba(0, 0, 0, 0.5)" },
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
              {/* Centered Portrait Ad Card */}
              <View
                style={{
                  width: AD_CONTAINER_WIDTH,
                  height: AD_CONTAINER_HEIGHT,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: "#000",
                  borderWidth: 2,
                  borderColor: colors.accent,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                {/* Close Button */}
                <TouchableOpacity
                  style={[
                    styles.closeButton,
                    { backgroundColor: colors.surface },
                  ]}
                  onPress={handleCloseModal}
                >
                  <Ionicons name="close" size={18} color={colors.text} />
                </TouchableOpacity>

                {/* Ad Image - Full Card */}
                <Image
                  source={{ uri: ad.imageUrl }}
                  style={styles.adImage}
                  resizeMode="cover"
                />

                {/* Ad Content Overlay - More Transparent */}
                <View
                  style={[styles.adContent, { backgroundColor: "transparent" }]}
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

                  {/* CTA Button - Only show if buttonLink exists */}
                  {ad.buttonLink && (
                    <TouchableOpacity
                      style={[
                        styles.ctaButton,
                        { backgroundColor: colors.accent },
                      ]}
                      onPress={() => handleAdClick(ad)}
                      activeOpacity={0.8}
                    >
                      <Text
                        style={[styles.ctaText, { color: colors.textOnAccent }]}
                      >
                        {ad.buttonText || "Learn More"}
                      </Text>
                      <Ionicons
                        name="arrow-forward"
                        size={16}
                        color={colors.textOnAccent}
                        style={{ marginLeft: 4 }}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Ad Indicators - Shows Multiple Ads Info */}
        <View
          style={[
            styles.indicatorContainer,
            { backgroundColor: colors.surface },
          ]}
        >
          {/* Swipe Hint for Multiple Ads */}
          {visibleAds.length > 1 && (
            <View style={styles.swipeHintContainer}>
              <Ionicons
                name="hand-left-outline"
                size={14}
                color={colors.textTertiary}
              />
              <Text
                style={[styles.swipeHintText, { color: colors.textTertiary }]}
              >
                Swipe for more ads
              </Text>
            </View>
          )}

          {/* Ad Counter */}
          {visibleAds.length > 1 && (
            <Text
              style={[
                styles.adCounter,
                { color: colors.accent, backgroundColor: colors.accentSurface },
              ]}
            >
              {currentIndex + 1} / {visibleAds.length}
            </Text>
          )}

          {/* Dot Indicators */}
          <View style={styles.dotContainer}>
            {visibleAds.map((_, index) => {
              const inputRange = [
                (index - 1) * width,
                index * width,
                (index + 1) * width,
              ];

              const dotWidth = scrollX.interpolate({
                inputRange,
                outputRange: [8, 24, 8],
                extrapolate: "clamp",
              });

              const opacity = scrollX.interpolate({
                inputRange,
                outputRange: [0.5, 1, 0.5],
                extrapolate: "clamp",
              });

              return (
                <Animated.View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      width: dotWidth,
                      opacity,
                      backgroundColor: colors.accent,
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
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
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 40,
    justifyContent: "flex-end",
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
  dotContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
};

export default AdsCarousel;
