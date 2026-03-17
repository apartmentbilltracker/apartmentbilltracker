/**
 * In-memory activity tracker for user online status.
 * Stores last-active timestamps per user. Automatically prunes
 * entries older than 24 hours every 10 minutes to prevent memory leaks.
 */

const activityMap = new Map(); // userId -> { ts: number, offline: boolean }

const PRUNE_INTERVAL = 10 * 60 * 1000; // 10 min
const STALE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

// Periodic cleanup
setInterval(() => {
  const cutoff = Date.now() - STALE_THRESHOLD;
  for (const [uid, entry] of activityMap) {
    if (entry.ts < cutoff) activityMap.delete(uid);
  }
}, PRUNE_INTERVAL);

module.exports = {
  /** Record that a user just made a request */
  touch(userId) {
    if (userId)
      activityMap.set(String(userId), { ts: Date.now(), offline: false });
  },

  /** Mark a user as offline immediately (e.g. on logout) but keep timestamp */
  setOffline(userId) {
    if (!userId) return;
    const key = String(userId);
    const entry = activityMap.get(key);
    if (entry) {
      entry.offline = true;
    } else {
      activityMap.set(key, { ts: Date.now(), offline: true });
    }
  },

  /** Get last-active timestamp (ms) for a user, or null */
  getLastActive(userId) {
    const entry = activityMap.get(String(userId));
    return entry ? entry.ts : null;
  },

  /** Get activity data for multiple user IDs at once */
  getActivityForUsers(userIds) {
    const now = Date.now();
    const result = {};
    for (const uid of userIds) {
      const entry = activityMap.get(String(uid));
      if (entry) {
        const diffMs = now - entry.ts;
        const isOnline = !entry.offline && diffMs < 5 * 60 * 1000;
        result[String(uid)] = {
          lastActiveAt: new Date(entry.ts).toISOString(),
          isOnline,
          isRecentlyActive: !entry.offline && diffMs < 60 * 60 * 1000,
        };
      } else {
        result[String(uid)] = {
          lastActiveAt: null,
          isOnline: false,
          isRecentlyActive: false,
        };
      }
    }
    return result;
  },
};
