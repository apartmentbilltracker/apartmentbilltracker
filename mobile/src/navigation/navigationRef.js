import React from "react";

// Shared navigation ref so any component outside the navigator tree
// (e.g. ChatNotificationBanner rendered at App root) can call navigate()
// without useNavigation(), which requires being inside a Navigator.
export const navigationRef = React.createRef();
