import React from "react";
import { ScrollView, FlatList } from "react-native";
import { useScrollToBottom } from "../context/ScrollContext";

/**
 * ScrollView wrapper that detects when user scrolls to bottom.
 * Updates ScrollContext to control padding visibility.
 */
export const ScrollViewWithDetection = React.forwardRef((props, ref) => {
  const { setIsScrolledToBottom } = useScrollToBottom();

  const handleScroll = (event) => {
    if (!event?.nativeEvent) return;

    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;

    setIsScrolledToBottom?.(isAtBottom);
  };

  return (
    <ScrollView
      ref={ref}
      {...props}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    />
  );
});

ScrollViewWithDetection.displayName = "ScrollViewWithDetection";

/**
 * FlatList wrapper that detects when user scrolls to bottom.
 * Updates ScrollContext to control padding visibility.
 */
export const FlatListWithDetection = React.forwardRef((props, ref) => {
  const { setIsScrolledToBottom } = useScrollToBottom();

  const handleScroll = (event) => {
    if (!event?.nativeEvent) return;

    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const isAtBottom =
      contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;

    setIsScrolledToBottom?.(isAtBottom);
  };

  return (
    <FlatList
      ref={ref}
      {...props}
      onScroll={handleScroll}
      scrollEventThrottle={16}
    />
  );
});

FlatListWithDetection.displayName = "FlatListWithDetection";
