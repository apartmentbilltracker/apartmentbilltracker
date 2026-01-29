import * as SecureStore from "expo-secure-store";
import { getAPIBaseURL } from "../config/config";

class APIClient {
  constructor() {
    this.baseURL = getAPIBaseURL();
    this.timeout = 15000;

    console.log("\n=== API Initialization ===");
    console.log("Base URL:", this.baseURL);
    console.log("Timeout: 15000ms");
    console.log("============================\n");
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
      const token = await SecureStore.getItemAsync("authToken");

      const headers = {
        "Content-Type": "application/json",
        ...options.headers,
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const method = options.method || "GET";
      console.log("[API Request]", method, url);

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

      console.log("[API Response]", response.status, url);

      if (!response.ok) {
        if (response.status === 401) {
          await SecureStore.deleteItemAsync("authToken");
        }
        const error = new Error(data?.message || "API Error");
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return { data, status: response.status };
    } catch (error) {
      console.log(
        "[API Error]",
        error.status || error.code || "Unknown",
        endpoint,
      );
      console.log("[Error Message]", error.message);
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

  delete(endpoint) {
    return this.makeRequest(endpoint, { method: "DELETE" });
  }
}

export default new APIClient();
