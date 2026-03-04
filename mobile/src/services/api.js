import * as SecureStore from "expo-secure-store";
import { getAPIBaseURL } from "../config/config";

// In-memory token cache — avoids an encrypted SecureStore disk read on every request.
// Invalidated on logout by calling api.clearTokenCache().
let _cachedToken = null;

class APIClient {
  constructor() {
    this.baseURL = getAPIBaseURL();
    this.timeout = 30000;
  }

  clearTokenCache() {
    _cachedToken = null;
  }

  // Call this immediately after writing a new token to SecureStore so the
  // next request doesn't need a SecureStore read.
  setTokenCache(token) {
    _cachedToken = token || null;
  }

  // Helper to get timeout promise
  getTimeoutPromise() {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timeout")), this.timeout),
    );
  }

  // Helper to make requests with token
  async makeRequest(endpoint, options = {}) {
    try {
      const url = `${this.baseURL}${endpoint}`;
      // Use cached token; fall back to SecureStore only on cache miss
      if (_cachedToken === null) {
        _cachedToken = (await SecureStore.getItemAsync("authToken")) ?? "";
      }
      const token = _cachedToken || null;

      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const method = options.method || "GET";

      const fetchPromise = fetch(url, {
        ...options,
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const response = await Promise.race([
        fetchPromise,
        this.getTimeoutPromise(),
      ]);

      const contentType = response.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else if (options.responseType === "blob") {
        data = await response.blob();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const error = new Error(data?.message || "API Error");
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return { data, status: response.status };
    } catch (error) {
      console.error(
        "[API Error]",
        error.status || "Unknown",
        endpoint,
        error.message,
      );
      throw error;
    }
  }

  // HTTP Methods
  get(endpoint) {
    return this.makeRequest(endpoint, { method: "GET" });
  }

  post(endpoint, body) {
    return this.makeRequest(endpoint, { method: "POST", body });
  }

  put(endpoint, body) {
    return this.makeRequest(endpoint, { method: "PUT", body });
  }

  patch(endpoint, body) {
    return this.makeRequest(endpoint, { method: "PATCH", body });
  }

  delete(endpoint) {
    return this.makeRequest(endpoint, { method: "DELETE" });
  }
}

export default new APIClient();
