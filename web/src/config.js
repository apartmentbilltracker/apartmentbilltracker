// API base URL — proxied through Vite dev server to avoid CORS in development.
// In production, set VITE_API_URL to your Render backend URL.
export const API_BASE_URL = import.meta.env.VITE_API_URL || "";
