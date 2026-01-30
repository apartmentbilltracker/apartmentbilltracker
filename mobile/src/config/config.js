const API_BASE_URL = "http://10.18.100.4:8000";

export const setAPIBaseURL = (url) => {
  global.API_BASE_URL = url;
};

export const getAPIBaseURL = () => {
  return global.API_BASE_URL || API_BASE_URL;
};
