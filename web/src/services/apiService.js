import api from "./api";

// ── Auth ──────────────────────────────────────────────
export const authService = {
  login: (data) => api.post("/api/v2/user/login-user", data),
  createUser: (data) => api.post("/api/v2/user/create-user", data),
  verifyActivationCode: (data) =>
    api.post("/api/v2/user/verify-activation-code", data),
  setPassword: (data) => api.post("/api/v2/user/set-password", data),
  resendVerification: (email) =>
    api.post("/api/v2/user/resend-verification", { email }),
  requestPasswordReset: (email) =>
    api.post("/api/v2/user/forgot-password", { email }),
  verifyResetCode: (email, resetCode) =>
    api.post("/api/v2/user/verify-reset-code", { email, resetCode }),
  resetPassword: (email, resetCode, password) =>
    api.post("/api/v2/user/reset-password", { email, resetCode, password }),
  getProfile: () => api.get("/api/v2/user/getuser"),
  updateProfile: (data) => api.put("/api/v2/user/update-profile", data),
  logout: () => api.get("/api/v2/user/logout"),
};

// ── Rooms ─────────────────────────────────────────────
export const roomService = {
  getClientRooms: () => api.get("/api/v2/rooms/client/my-rooms"),
  getAvailableRooms: () => api.get("/api/v2/rooms/browse/available"),
  getRoomById: (id) => api.get(`/api/v2/rooms/${id}`),
};

// ── Members ───────────────────────────────────────────
export const memberService = {
  addMember: (roomId, data) => api.post(`/api/v2/rooms/${roomId}/join`, data),
};

// ── Host Role ─────────────────────────────────────────
export const hostRoleService = {
  requestHost: () => api.post("/api/v2/user/request-host"),
  getHostStatus: () => api.get("/api/v2/user/host-status"),
};

// ── Billing ───────────────────────────────────────────
export const billingCycleService = {
  getBillingCycles: (roomId) =>
    api.get(`/api/v2/billing-cycles/room/${roomId}`),
  getActiveCycle: (roomId) =>
    api.get(`/api/v2/billing-cycles/room/${roomId}/active`),
  getOutstandingBalance: (roomId) =>
    api.get(`/api/v2/billing-cycles/room/${roomId}/outstanding`),
  getBillingCycleById: (cycleId) =>
    api.get(`/api/v2/billing-cycles/${cycleId}`),
};

// ── Payments ──────────────────────────────────────────
export const paymentService = {
  getPaymentHistory: (roomId) =>
    api.get(`/api/v2/payments/payment-history/${roomId}`),
  getMemberPaymentHistory: (roomId, memberId) =>
    api.get(`/api/v2/payments/member-payment-history/${roomId}/${memberId}`),
  getMyPayments: (roomId) =>
    api.get(`/api/v2/payment-processing/transactions/${roomId}`),
  getSettlements: (roomId, status) =>
    api.get(
      `/api/v2/payments/settlements/${roomId}${status ? `?status=${status}` : ""}`,
    ),
  calculateSettlements: (roomId) =>
    api.post("/api/v2/payments/calculate-settlements", { roomId }),
  recordSettlement: (
    roomId,
    debtorId,
    creditorId,
    amount,
    settlementAmount,
    notes,
  ) =>
    api.post("/api/v2/payments/record-settlement", {
      roomId,
      debtorId,
      creditorId,
      amount,
      settlementAmount,
      notes,
    }),
};

export const paymentProcessingService = {
  initiateGCash: (data) =>
    api.post("/api/v2/payment-processing/initiate-gcash", data),
  verifyGCash: (data) =>
    api.post("/api/v2/payment-processing/verify-gcash", data),
  initiateBankTransfer: (data) =>
    api.post("/api/v2/payment-processing/initiate-bank-transfer", data),
  confirmBankTransfer: (formData) =>
    api.post(
      "/api/v2/payment-processing/confirm-bank-transfer",
      formData,
      true,
    ),
  recordCash: (data) =>
    api.post("/api/v2/payment-processing/record-cash", data),
  cancelTransaction: (data) =>
    api.post("/api/v2/payment-processing/cancel-transaction", data),
  getTransactions: (roomId) =>
    api.get(`/api/v2/payment-processing/transactions/${roomId}`),
};

export const settingsService = {
  getPaymentMethods: (roomId) =>
    api.get(
      `/api/v2/settings/payment-methods${roomId ? `?room_id=${roomId}` : ""}`,
    ),
  getVersionControl: () => api.get("/api/v2/settings/version-control"),
};

// ── Announcements ─────────────────────────────────────
export const announcementService = {
  getRoomAnnouncements: (roomId) =>
    api.get(`/api/v2/announcements/room/${roomId}`),
  markAsRead: (announcementId) =>
    api.put(`/api/v2/announcements/${announcementId}/mark-read`),
  addComment: (announcementId, text) =>
    api.post(`/api/v2/announcements/${announcementId}/comments`, { text }),
};

// ── Presence ──────────────────────────────────────────
// Note: presence data is embedded in room.members[].presence (no separate GET endpoint)
export const presenceService = {
  markPresence: (roomId, data) =>
    api.post(`/api/v2/rooms/${roomId}/presence`, data),
};

// ── Chat ──────────────────────────────────────────────
export const chatService = {
  getChatStatus: (roomId) => api.get(`/api/v2/chat/room/${roomId}/status`),
  getMessages: (roomId, params = {}) => {
    const q = new URLSearchParams();
    if (params.before) q.append("before", params.before);
    if (params.after) q.append("after", params.after);
    if (params.limit) q.append("limit", params.limit);
    const qs = q.toString();
    return api.get(`/api/v2/chat/room/${roomId}/messages${qs ? `?${qs}` : ""}`);
  },
  getNewMessages: (roomId, afterId) =>
    chatService.getMessages(roomId, { after: afterId }),
  sendMessage: (roomId, text) =>
    api.post(`/api/v2/chat/room/${roomId}/messages`, { text }),
  deleteMessage: (roomId, messageId) =>
    api.delete(`/api/v2/chat/room/${roomId}/messages/${messageId}`),
};

// ── Notifications ─────────────────────────────────────
export const notificationService = {
  getNotifications: () => api.get("/api/v2/notifications/all"),
  markAsRead: (id) => api.patch(`/api/v2/notifications/${id}/read`),
  markAllAsRead: () => api.patch("/api/v2/notifications/read-all"),
};

// ── Support ───────────────────────────────────────────
export const supportService = {
  createTicket: (data) => api.post("/api/v2/support", data),
  getMyTickets: () => api.get("/api/v2/support/my-tickets"),
  getUserTickets: () => api.get("/api/v2/support/my-tickets"),
  getTicketDetails: (id) =>
    api.get(`/api/v2/support/ticket/${id}`).then((r) => r?.ticket || r),
  addTicketReply: (id, message) =>
    api.post(`/api/v2/support/ticket/${id}/response`, { message }),
  reportBug: (data) => api.post("/api/v2/support/create-bug-report", data),
  createBugReport: (data) =>
    api.post("/api/v2/support/create-bug-report", data),
  getMyBugReports: () => api.get("/api/v2/support/my-bug-reports"),
  getUserBugReports: () => api.get("/api/v2/support/my-bug-reports"),
};

// ── Badges ────────────────────────────────────────────
export const badgeService = {
  getCounts: () =>
    api.get("/api/v2/badges").then((r) => ({
      unreadNotifications: r?.unreadNotifications || 0,
      unreadAnnouncements: r?.unreadAnnouncements || 0,
      unreadSupport: r?.unreadSupport || 0,
    })),
};
