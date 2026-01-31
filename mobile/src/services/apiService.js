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

export const apiService = {
  get: (url) => api.get(url).then(extractData),
  post: (url, data) => api.post(url, data).then(extractData),
  put: (url, data) => api.put(url, data).then(extractData),
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
  recordCash: (data) => paymentProcessingService.recordCash(data),
  getTransactions: (roomId) => paymentProcessingService.getTransactions(roomId),
  getTransaction: (transactionId) =>
    paymentProcessingService.getTransaction(transactionId),
  getAnalytics: (roomId) => paymentProcessingService.getAnalytics(roomId),
};

export default apiService;
