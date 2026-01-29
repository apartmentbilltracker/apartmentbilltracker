// Change this to your backend server IP address
// For local development: Use your machine's IP (e.g., 192.168.x.x or 10.x.x.x)
// For production: Use your Render.com URL (e.g., https://your-app.onrender.com)
// NOT localhost - localhost refers to the device itself in React Native
const API_BASE_URL = "https://abt-server.onrender.com"; // Replace with your Render.com URL

export const setAPIBaseURL = (url) => {
  global.API_BASE_URL = url;
};

export const getAPIBaseURL = () => {
  return global.API_BASE_URL || API_BASE_URL;
};
