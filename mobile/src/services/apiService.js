import api from "./api";

// Helper to extract data from response
const extractData = (response) => response.data || response;

// Auth Services
export const authService = {
  // Simple login
  login: (data) => api.post("/api/v2/user/login-user", data).then(extractData),

  // Simple register
  register: (data) => api.post("/api/v2/user/register", data).then(extractData),

  // Google login
  googleLogin: (data) =>
    api.post("/api/v2/user/google-login", data).then(extractData),

  // Facebook login
  facebookLogin: (data) =>
    api.post("/api/v2/user/facebook-login", data).then(extractData),

  getProfile: () => api.get("/api/v2/user/getuser").then(extractData),
  updateProfile: (data) =>
    api.put("/api/v2/user/profile", data).then(extractData),
  logout: () => api.get("/api/v2/user/logout").then(extractData),
};

// Room Services
export const roomService = {
  getRooms: () => api.get("/api/v2/rooms").then(extractData),
  getRoomById: (id) => api.get(`/api/v2/rooms/${id}`).then(extractData),
  getRoomDetails: (id) => api.get(`/api/v2/rooms/${id}`).then(extractData),
  createRoom: (data) => api.post("/api/v2/rooms", data).then(extractData),
  updateRoom: (id, data) =>
    api.put(`/api/v2/rooms/${id}`, data).then(extractData),
  deleteRoom: (id) => api.delete(`/api/v2/rooms/${id}`).then(extractData),
};

// Presence Services
export const presenceService = {
  markPresence: (roomId, data) =>
    api.post(`/api/v2/rooms/${roomId}/presence`, data).then(extractData),
  // Note: Presence data is embedded in room members, fetch via roomService.getRoomById()
};

// Billing Services
export const billingService = {
  saveBilling: (roomId, data) =>
    api.put(`/api/v2/rooms/${roomId}/billing`, data).then(extractData),
  getBilling: (roomId) =>
    api.get(`/api/v2/rooms/${roomId}/billing`).then(extractData),
  exportBillingPDF: (roomId) =>
    api
      .makeRequest(`/api/v2/rooms/${roomId}/export`, {
        method: "GET",
        responseType: "blob",
      })
      .then(extractData),
};

// Member Services
export const memberService = {
  addMember: (roomId, data) =>
    api.post(`/api/v2/rooms/${roomId}/join`, data).then(extractData),
  updateMember: (roomId, memberId, data) =>
    api
      .put(`/api/v2/rooms/${roomId}/members/${memberId}`, data)
      .then(extractData),
  deleteMember: (roomId, memberId) =>
    api.delete(`/api/v2/rooms/${roomId}/members/${memberId}`).then(extractData),
  getMembers: (roomId) =>
    api.get(`/api/v2/rooms/${roomId}/members`).then(extractData),
};

// Billing Cycle Services
export const billingCycleService = {
  createCycle: (roomId, data) =>
    api
      .post(`/api/v2/billing-cycles/create`, { ...data, roomId })
      .then(extractData),
  getBillingCycles: (roomId) =>
    api.get(`/api/v2/billing-cycles/room/${roomId}`).then(extractData),
  getBillingCycleById: (cycleId) =>
    api.get(`/api/v2/billing-cycles/${cycleId}`).then(extractData),
  getActiveCycle: (roomId) =>
    api.get(`/api/v2/billing-cycles/active/${roomId}`).then(extractData),
  updateBillingCycle: (cycleId, data) =>
    api.put(`/api/v2/billing-cycles/${cycleId}`, data).then(extractData),
  closeBillingCycle: (cycleId) =>
    api.put(`/api/v2/billing-cycles/${cycleId}/close`).then(extractData),
  deleteBillingCycle: (cycleId) =>
    api.delete(`/api/v2/billing-cycles/${cycleId}`).then(extractData),
};

// Export apiService object for backward compatibility
export const apiService = {
  get: (url) => api.get(url).then(extractData),
  post: (url, data) => api.post(url, data).then(extractData),
  put: (url, data) => api.put(url, data).then(extractData),
  delete: (url) => api.delete(url).then(extractData),
};
