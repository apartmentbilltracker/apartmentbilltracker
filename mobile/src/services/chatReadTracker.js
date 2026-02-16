import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAT_READ_KEY = "@chat_last_read";

/**
 * Tracks the last-read timestamp per room for chat badge counts.
 * Stored as JSON: { "roomId1": 1708000000000, "roomId2": 1708100000000 }
 */
const chatReadTracker = {
  /**
   * Get the last-read timestamp for a room (epoch ms, or 0 if never read)
   */
  getLastRead: async (roomId) => {
    try {
      const raw = await AsyncStorage.getItem(CHAT_READ_KEY);
      if (!raw) return 0;
      const map = JSON.parse(raw);
      return map[roomId] || 0;
    } catch {
      return 0;
    }
  },

  /**
   * Mark a room's chat as read right now
   */
  markAsRead: async (roomId) => {
    try {
      const raw = await AsyncStorage.getItem(CHAT_READ_KEY);
      const map = raw ? JSON.parse(raw) : {};
      map[roomId] = Date.now();
      await AsyncStorage.setItem(CHAT_READ_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("Failed to save chat read timestamp:", e);
    }
  },

  /**
   * Clear all read timestamps (e.g. on logout)
   */
  clearAll: async () => {
    try {
      await AsyncStorage.removeItem(CHAT_READ_KEY);
    } catch {
      // ignore
    }
  },
};

export default chatReadTracker;
