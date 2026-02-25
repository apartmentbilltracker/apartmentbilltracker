/**
 * useScreenCache — stale-while-revalidate helper
 *
 * Usage:
 *   const cache = useScreenCache("my_key");
 *   const cached = await cache.read();    // returns null if expired / missing
 *   await cache.write(someData);          // persists for MAX_AGE_MS
 *
 * Keys are automatically namespaced with "sc_" to avoid collisions.
 * No extra API calls are made — this only touches AsyncStorage (local, free).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const MAX_AGE_MS = 10 * 60 * 1000; // cached data is fresh for 10 minutes

const PREFIX = "sc_";

export const screenCache = {
  read: async (key) => {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > MAX_AGE_MS) return null;
      return data;
    } catch {
      return null;
    }
  },

  write: async (key, data) => {
    try {
      await AsyncStorage.setItem(
        PREFIX + key,
        JSON.stringify({ data, ts: Date.now() }),
      );
    } catch {
      // storage errors should never crash the app
    }
  },

  clear: async (key) => {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {}
  },
};
