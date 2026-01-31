const API_BASE_URL = "https://abt-server-rvgf.onrender.com";

export const setAPIBaseURL = (url) => {
  global.API_BASE_URL = url;
};

export const getAPIBaseURL = () => {
  return global.API_BASE_URL || API_BASE_URL;
};
