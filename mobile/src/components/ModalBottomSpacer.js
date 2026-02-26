/**
 * ModalBottomSpacer
 *
 * Drop this at the very bottom of any bottom-sheet Modal content.
 * It automatically adds the correct amount of bottom padding so the
 * sheet never overlaps the phone's gesture navigation bar, both in
 * Expo Go and in production APK builds.
 *
 * Usage:
 *   import ModalBottomSpacer from "../../components/ModalBottomSpacer";
 *   ...
 *   <ScrollView ...>
 *     ... modal content ...
 *     <ModalBottomSpacer />
 *   </ScrollView>
 *
 *   — OR at the bottom of a non-scrollable modal sheet —
 *   <View style={styles.modalButtons}>...</View>
 *   <ModalBottomSpacer />
 */

import React from "react";
import { View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const ModalBottomSpacer = ({ extra = 0 }) => {
  const insets = useSafeAreaInsets();
  // On Android with gesture nav: insets.bottom > 0 (e.g. 24–48 dp)
  // On Android with 3-button nav or no nav bar: insets.bottom === 0, use 16 dp minimum
  // On iOS: insets.bottom reflects the home indicator
  const height =
    Platform.OS === "ios"
      ? Math.max(insets.bottom, 8) + extra
      : Math.max(insets.bottom, 16) + extra;
  return <View style={{ height }} />;
};

export default ModalBottomSpacer;
