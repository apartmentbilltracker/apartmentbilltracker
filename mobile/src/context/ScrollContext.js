import React from "react";

/**
 * Context for tracking scroll position across navigators and screens.
 * Used to conditionally show/hide padding based on scroll position.
 */
export const ScrollContext = React.createContext({
  isScrolledToBottom: true,
  setIsScrolledToBottom: () => {},
});

/**
 * Hook to access scroll position state.
 * Must be used within a ScrollContext.Provider.
 */
export const useScrollToBottom = () => {
  const context = React.useContext(ScrollContext);
  if (!context) {
    console.warn(
      "useScrollToBottom must be used within ScrollContext.Provider",
    );
    return { isScrolledToBottom: true, setIsScrolledToBottom: () => {} };
  }
  return context;
};
