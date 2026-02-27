import api from "./api";

// Helper to extract data from response
const extractData = (response) => response.data || response;

// Auth Services
export const authService = {
  // Simple login
  login: (data) => api.post("/api/v2/user/login-user", data).then(extractData),

  // Simple register
  register: (data) => api.post("/api/v2/user/register", data).then(extractData),

  // 3-step signup: Step 1 - Create user with email and name
  createUser: (data) =>
    api.post("/api/v2/user/create-user", data).then(extractData),

  // 3-step signup: Step 2 - Verify activation code
  verifyActivationCode: (data) =>
    api.post("/api/v2/user/verify-activation-code", data).then(extractData),

  // 3-step signup: Step 3 - Set password
  setPassword: (data) =>
    api.post("/api/v2/user/set-password", data).then(extractData),

  // Resend verification code
  resendVerification: (email) =>
    api.post("/api/v2/user/resend-verification", { email }).then(extractData),

  // Google login
  googleLogin: (data) =>
    api.post("/api/v2/user/google-login", data).then(extractData),

  // Facebook login
  facebookLogin: (data) =>
    api.post("/api/v2/user/facebook-login", data).then(extractData),

  // Request password reset (sends 6-digit code)
  requestPasswordReset: (email) =>
    api.post("/api/v2/user/forgot-password", { email }).then(extractData),

  // Verify reset code
  verifyResetCode: (email, resetCode) =>
    api
      .post("/api/v2/user/verify-reset-code", { email, resetCode })
      .then(extractData),

  // Reset password with code
  resetPassword: (email, resetCode, password) =>
    api
      .post("/api/v2/user/reset-password", { email, resetCode, password })
      .then(extractData),

  getProfile: () => api.get("/api/v2/user/getuser").then(extractData),
  updateProfile: (data) =>
    api.put("/api/v2/user/update-profile", data).then(extractData),
  logout: () => api.get("/api/v2/user/logout").then(extractData),

  // Fetch avatars for saved accounts (public, no auth)
  getAvatars: (emails) =>
    api.post("/api/v2/user/avatars", { emails }).then(extractData),
};

// Host Role Services
export const hostRoleService = {
  requestHost: () => api.post("/api/v2/user/request-host").then(extractData),
  getHostStatus: () => api.get("/api/v2/user/host-status").then(extractData),
  getPendingHostRequests: () =>
    api.get("/api/v2/user/pending-host-requests").then(extractData),
  approveHost: (userId) =>
    api.put(`/api/v2/user/approve-host/${userId}`).then(extractData),
  rejectHost: (userId) =>
    api.put(`/api/v2/user/reject-host/${userId}`).then(extractData),
  getAllUsers: () => api.get("/api/v2/user/all-users").then(extractData),
  demoteHost: (userId) =>
    api.put(`/api/v2/user/demote-host/${userId}`).then(extractData),
  changeRole: (userId, role) =>
    api.put(`/api/v2/user/change-role/${userId}`, { role }).then(extractData),
  toggleStatus: (userId, is_active) =>
    api
      .put(`/api/v2/user/toggle-status/${userId}`, { is_active })
      .then(extractData),
  deleteUser: (userId) =>
    api.delete(`/api/v2/user/delete-user/${userId}`).then(extractData),
};

// Room Services
export const roomService = {
  getRooms: () => api.get("/api/v2/rooms").then(extractData),
  getClientRooms: () =>
    api.get("/api/v2/rooms/client/my-rooms").then(extractData),
  getAvailableRooms: () =>
    api.get("/api/v2/rooms/browse/available").then(extractData),
  getRoomById: (id) => api.get(`/api/v2/rooms/${id}`).then(extractData),
  getRoomDetails: (id) => api.get(`/api/v2/rooms/${id}`).then(extractData),
  createRoom: (data) => api.post("/api/v2/rooms", data).then(extractData),
  updateRoom: (id, data) =>
    api.put(`/api/v2/rooms/${id}`, data).then(extractData),
  deleteRoom: (id) => api.delete(`/api/v2/rooms/${id}`).then(extractData),
  getAdminAllRooms: () => api.get("/api/v2/rooms/admin/all").then(extractData),
  adminDeleteRoom: (roomId) =>
    api.delete(`/api/v2/rooms/admin/${roomId}`).then(extractData),
  adminRemoveMember: (roomId, memberId) =>
    api
      .delete(`/api/v2/rooms/admin/${roomId}/members/${memberId}`)
      .then(extractData),
  adminTogglePayer: (roomId, memberId) =>
    api
      .put(`/api/v2/rooms/admin/${roomId}/members/${memberId}/toggle-payer`)
      .then(extractData),
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
  getPendingMembers: (roomId) =>
    api.get(`/api/v2/rooms/${roomId}/members/pending`).then(extractData),
  approveMember: (roomId, memberId) =>
    api
      .post(`/api/v2/rooms/${roomId}/members/${memberId}/approve`)
      .then(extractData),
  rejectMember: (roomId, memberId) =>
    api
      .post(`/api/v2/rooms/${roomId}/members/${memberId}/reject`)
      .then(extractData),
};

// Billing Cycle Services
export const billingCycleService = {
  createCycle: (roomId, data) =>
    api.post(`/api/v2/billing-cycles`, { ...data, roomId }).then(extractData),
  getBillingCycles: (roomId) =>
    api.get(`/api/v2/billing-cycles/room/${roomId}`).then(extractData),
  getBillingCycleById: (cycleId) =>
    api.get(`/api/v2/billing-cycles/${cycleId}`).then(extractData),
  getActiveCycle: (roomId) =>
    api.get(`/api/v2/billing-cycles/room/${roomId}/active`).then(extractData),
  updateBillingCycle: (cycleId, data) =>
    api.put(`/api/v2/billing-cycles/${cycleId}`, data).then(extractData),
  closeBillingCycle: (cycleId) =>
    api.put(`/api/v2/billing-cycles/${cycleId}/close`).then(extractData),
  deleteBillingCycle: (cycleId) =>
    api.delete(`/api/v2/billing-cycles/${cycleId}`).then(extractData),
};

// Payment Services
export const paymentService = {
  markBillPaid: (
    roomId,
    memberId,
    billType,
    amount,
    paymentMethod,
    reference,
  ) =>
    api
      .post("/api/v2/payments/mark-bill-paid", {
        roomId,
        memberId,
        billType,
        amount,
        paymentMethod,
        reference,
      })
      .then(extractData),

  getPaymentHistory: (roomId) =>
    api.get(`/api/v2/payments/payment-history/${roomId}`).then(extractData),

  getMemberPaymentHistory: (roomId, memberId) =>
    api
      .get(`/api/v2/payments/member-payment-history/${roomId}/${memberId}`)
      .then(extractData),

  calculateSettlements: (roomId) =>
    api
      .post("/api/v2/payments/calculate-settlements", { roomId })
      .then(extractData),

  recordSettlement: (
    roomId,
    debtorId,
    creditorId,
    amount,
    settlementAmount,
    notes,
  ) =>
    api
      .post("/api/v2/payments/record-settlement", {
        roomId,
        debtorId,
        creditorId,
        amount,
        settlementAmount,
        notes,
      })
      .then(extractData),

  getSettlements: (roomId, status) =>
    api
      .get(
        `/api/v2/payments/settlements/${roomId}${status ? `?status=${status}` : ""}`,
      )
      .then(extractData),

  getMemberDebts: (roomId, memberId) =>
    api
      .get(`/api/v2/payments/member-debts/${roomId}/${memberId}`)
      .then(extractData),

  getMemberCredits: (roomId, memberId) =>
    api
      .get(`/api/v2/payments/member-credits/${roomId}/${memberId}`)
      .then(extractData),
};

// Payment Processing Services (GCash, Bank Transfer, Cash)
export const paymentProcessingService = {
  initiateGCash: (data) =>
    api
      .post("/api/v2/payment-processing/initiate-gcash", data)
      .then(extractData),

  verifyGCash: (data) =>
    api.post("/api/v2/payment-processing/verify-gcash", data).then(extractData),

  initiateBankTransfer: (data) =>
    api
      .post("/api/v2/payment-processing/initiate-bank-transfer", data)
      .then(extractData),

  confirmBankTransfer: (data) =>
    api
      .post("/api/v2/payment-processing/confirm-bank-transfer", data)
      .then(extractData),

  recordCash: (data) =>
    api.post("/api/v2/payment-processing/record-cash", data).then(extractData),

  // Cancel a pending transaction (user backs out before completing payment)
  cancelTransaction: (data) =>
    api
      .post("/api/v2/payment-processing/cancel-transaction", data)
      .then(extractData),

  getTransactions: (roomId) =>
    api
      .get(`/api/v2/payment-processing/transactions/${roomId}`)
      .then(extractData),

  getTransaction: (transactionId) =>
    api
      .get(`/api/v2/payment-processing/transaction/${transactionId}`)
      .then(extractData),

  getAnalytics: (roomId) =>
    api.get(`/api/v2/payment-processing/analytics/${roomId}`).then(extractData),
};

// App Settings Services (payment method toggles, version control, etc.)
export const settingsService = {
  getPaymentMethods: (roomId) =>
    api
      .get("/api/v2/settings/payment-methods", {
        params: roomId ? { room_id: roomId } : undefined,
      })
      .then(extractData),

  updatePaymentMethods: (data) =>
    api.put("/api/v2/settings/payment-methods", data).then(extractData),

  getVersionControl: () =>
    api.get("/api/v2/settings/version-control").then(extractData),

  updateVersionControl: (data) =>
    api.put("/api/v2/settings/version-control", data).then(extractData),
};

export const announcementService = {
  getRoomAnnouncements: (roomId) =>
    api.get(`/api/v2/announcements/room/${roomId}`).then(extractData),

  createAnnouncement: (
    roomId,
    title,
    content,
    isPinned = false,
    targetUserId = null,
  ) =>
    api
      .post("/api/v2/announcements", {
        roomId,
        title,
        content,
        isPinned,
        targetUserId,
      })
      .then(extractData),

  addComment: (announcementId, text) =>
    api
      .post(`/api/v2/announcements/${announcementId}/comments`, {
        text,
      })
      .then(extractData),

  markAsRead: (announcementId) =>
    api
      .put(`/api/v2/announcements/${announcementId}/mark-read`)
      .then(extractData),

  deleteAnnouncement: (announcementId) =>
    api.delete(`/api/v2/announcements/${announcementId}`).then(extractData),

  deleteComment: (announcementId, commentId) =>
    api
      .delete(`/api/v2/announcements/${announcementId}/comments/${commentId}`)
      .then(extractData),

  // Reactions
  addReaction: (announcementId, reactionType) =>
    api
      .post(`/api/v2/announcements/${announcementId}/reactions`, {
        reactionType,
      })
      .then(extractData),

  removeReaction: (announcementId) =>
    api
      .delete(`/api/v2/announcements/${announcementId}/reactions`)
      .then(extractData),

  getReactionSummary: (announcementId) =>
    api
      .get(`/api/v2/announcements/${announcementId}/reactions/summary`)
      .then(extractData),

  // Sharing
  shareAnnouncement: (announcementId) =>
    api.post(`/api/v2/announcements/${announcementId}/share`).then(extractData),

  getShareCount: (announcementId) =>
    api
      .get(`/api/v2/announcements/${announcementId}/shares/count`)
      .then(extractData),
};

export const apiService = {
  get: (url) => api.get(url).then(extractData),
  post: (url, data) => api.post(url, data).then(extractData),
  put: (url, data) => api.put(url, data).then(extractData),
  patch: (url, data = {}) => api.patch(url, data).then(extractData),
  delete: (url) => api.delete(url).then(extractData),
  // Payment methods
  getPaymentHistory: (roomId) => paymentService.getPaymentHistory(roomId),
  getMemberPaymentHistory: (roomId, memberId) =>
    paymentService.getMemberPaymentHistory(roomId, memberId),
  getSettlements: (roomId, status) =>
    paymentService.getSettlements(roomId, status),
  getMemberDebts: (roomId, memberId) =>
    paymentService.getMemberDebts(roomId, memberId),
  getMemberCredits: (roomId, memberId) =>
    paymentService.getMemberCredits(roomId, memberId),
  markBillPaid: (
    roomId,
    memberId,
    billType,
    amount,
    paymentMethod,
    reference,
  ) =>
    paymentService.markBillPaid(
      roomId,
      memberId,
      billType,
      amount,
      paymentMethod,
      reference,
    ),
  calculateSettlements: (roomId) => paymentService.calculateSettlements(roomId),
  recordSettlement: (
    roomId,
    debtorId,
    creditorId,
    amount,
    settlementAmount,
    notes,
  ) =>
    paymentService.recordSettlement(
      roomId,
      debtorId,
      creditorId,
      amount,
      settlementAmount,
      notes,
    ),
  // Payment Processing methods (GCash, Bank, Cash)
  initiateGCash: (data) => paymentProcessingService.initiateGCash(data),
  verifyGCash: (data) => paymentProcessingService.verifyGCash(data),
  initiateBankTransfer: (data) =>
    paymentProcessingService.initiateBankTransfer(data),
  confirmBankTransfer: (data) =>
    paymentProcessingService.confirmBankTransfer(data),
  // Payment Processing helpers
  cancelTransaction: (transactionId) =>
    paymentProcessingService.cancelTransaction({ transactionId }),
  recordCash: (data) => paymentProcessingService.recordCash(data),
  getTransactions: (roomId) => paymentProcessingService.getTransactions(roomId),
  getTransaction: (transactionId) =>
    paymentProcessingService.getTransaction(transactionId),
  getAnalytics: (roomId) => paymentProcessingService.getAnalytics(roomId),
};

// Badge counts — single API call for all badge counts
export const badgeService = {
  getCounts: () =>
    api
      .get("/api/v2/badges")
      .then(extractData)
      .then((r) => ({
        unreadNotifications: r?.unreadNotifications || 0,
        unreadAnnouncements: r?.unreadAnnouncements || 0,
        unreadSupport: r?.unreadSupport || 0,
      })),
};

// Support Services (Support Tickets, FAQs, Bug Reports)
export const supportService = {
  // Support Tickets
  createTicket: (data) => api.post("/api/v2/support", data).then(extractData),
  getUserTickets: () =>
    api
      .get("/api/v2/support/my-tickets")
      .then(extractData)
      .then((r) => r?.tickets || []),
  getTicketDetails: (ticketId) =>
    api
      .get(`/api/v2/support/ticket/${ticketId}`)
      .then(extractData)
      .then((r) => r?.ticket || r),
  addTicketReply: (ticketId, message) =>
    api
      .post(`/api/v2/support/ticket/${ticketId}/response`, { message })
      .then(extractData),
  markTicketAsRead: (ticketId) =>
    api.post(`/api/v2/support/ticket/${ticketId}/read`).then(extractData),

  // FAQs
  getAllFAQs: (category) =>
    api
      .get(`/api/v2/faqs${category ? `?category=${category}` : ""}`)
      .then(extractData)
      .then((r) => r?.data || []),
  getFAQCategories: () =>
    api
      .get("/api/v2/faqs/categories")
      .then(extractData)
      .then((r) => r?.data || []),
  markFAQHelpful: (faqId) =>
    api.post(`/api/v2/faqs/${faqId}/helpful`).then(extractData),
  markFAQNotHelpful: (faqId) =>
    api.post(`/api/v2/faqs/${faqId}/not-helpful`).then(extractData),

  // Admin methods
  getAllTickets: () =>
    api
      .get("/api/v2/support/all-tickets")
      .then(extractData)
      .then((r) => r?.tickets || []),
  updateTicketStatus: (ticketId, status) =>
    api
      .put(`/api/v2/support/ticket/${ticketId}/status`, { status })
      .then(extractData),
  getAdminFAQs: () =>
    api
      .get("/api/v2/faqs")
      .then(extractData)
      .then((r) => r?.data || []),
  createFAQ: (data) => api.post("/api/v2/faqs", data).then(extractData),
  updateFAQ: (faqId, data) =>
    api.put(`/api/v2/faqs/${faqId}`, data).then(extractData),
  deleteFAQ: (faqId) => api.delete(`/api/v2/faqs/${faqId}`).then(extractData),
  getAllBugReports: () =>
    api
      .get("/api/v2/support/all-bug-reports")
      .then(extractData)
      .then((r) => r?.reports || []),
  updateBugReportStatus: (reportId, status) =>
    api
      .put(`/api/v2/support/bug-report/${reportId}/status`, { status })
      .then(extractData),

  // Bug Reports
  createBugReport: (data) =>
    api.post("/api/v2/support/create-bug-report", data).then(extractData),
  getUserBugReports: () =>
    api
      .get("/api/v2/support/my-bug-reports")
      .then(extractData)
      .then((r) => r?.reports || []),
  getBugReportDetails: (reportId) =>
    api
      .get(`/api/v2/support/bug-report/${reportId}`)
      .then(extractData)
      .then((r) => r?.report || r),
  addBugReportResponse: (reportId, message) =>
    api
      .post(`/api/v2/support/bug-report/${reportId}/response`, { message })
      .then(extractData),
  markBugReportAsRead: (reportId) =>
    api.post(`/api/v2/support/bug-report/${reportId}/read`).then(extractData),
};

export const chatService = {
  // Enable chat for a room (host only)
  enableChat: (roomId) =>
    api.post(`/api/v2/chat/room/${roomId}/enable`).then(extractData),

  // Disable chat for a room (host only)
  disableChat: (roomId) =>
    api.post(`/api/v2/chat/room/${roomId}/disable`).then(extractData),

  // Get chat status
  getChatStatus: (roomId) =>
    api.get(`/api/v2/chat/room/${roomId}/status`).then(extractData),

  // Send a message
  sendMessage: (roomId, text) =>
    api
      .post(`/api/v2/chat/room/${roomId}/messages`, { text })
      .then(extractData),

  // Get messages (with optional pagination)
  getMessages: (roomId, params = {}) => {
    const query = new URLSearchParams();
    if (params.before) query.append("before", params.before);
    if (params.limit) query.append("limit", params.limit);
    const qs = query.toString();
    return api
      .get(`/api/v2/chat/room/${roomId}/messages${qs ? `?${qs}` : ""}`)
      .then(extractData);
  },

  // Delete a message
  deleteMessage: (roomId, messageId) =>
    api
      .delete(`/api/v2/chat/room/${roomId}/messages/${messageId}`)
      .then(extractData),
};

export default apiService;
