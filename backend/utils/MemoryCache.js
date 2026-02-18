/**
 * Simple in-memory cache with TTL support.
 * Dramatically reduces Supabase egress by caching frequently accessed,
 * rarely changing data on the server side.
 */
class MemoryCache {
  constructor() {
    this._store = new Map();
    // Sweep expired entries every 60 seconds
    this._sweepInterval = setInterval(() => this._sweep(), 60_000);
  }

  /**
   * Get a cached value. Returns undefined if missing or expired.
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Set a value with a TTL in seconds.
   */
  set(key, value, ttlSeconds = 60) {
    this._store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete a specific key.
   */
  del(key) {
    this._store.delete(key);
  }

  /**
   * Delete all keys matching a prefix.
   */
  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  clear() {
    this._store.clear();
  }

  /**
   * Remove expired entries.
   */
  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._store.entries()) {
      if (now > entry.expiresAt) {
        this._store.delete(key);
      }
    }
  }

  /**
   * Get-or-set helper: returns cached value if available,
   * otherwise calls fn() and caches the result.
   */
  async getOrSet(key, fn, ttlSeconds = 60) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await fn();
    this.set(key, value, ttlSeconds);
    return value;
  }
}

// Export a singleton instance
module.exports = new MemoryCache();
