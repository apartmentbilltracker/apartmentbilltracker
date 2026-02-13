const supabase = require("./SupabaseClient");

/**
 * Sanitize Supabase error messages — strip HTML from Cloudflare/proxy error pages
 */
const sanitizeError = (msg) => {
  if (!msg) return "Unknown error";
  if (typeof msg === "string" && msg.includes("<!DOCTYPE")) {
    return "Supabase temporarily unavailable (503/500)";
  }
  return msg;
};

/**
 * Simple retry wrapper for transient Supabase errors (Cloudflare 500/503)
 */
const withRetry = async (fn, retries = 2, delayMs = 500) => {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      const isTransient =
        err.message &&
        (err.message.includes("<!DOCTYPE") ||
          err.message.includes("temporarily unavailable"));
      if (isTransient && i < retries) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
        continue;
      }
      throw err;
    }
  }
};

/**
 * Comprehensive Supabase service layer for database operations
 * Handles all CRUD operations and specialized queries
 */
class SupabaseService {
  // ============ RAW CLIENT ACCESS ============

  /**
   * Get the raw Supabase client for advanced queries (e.g. .in(), .or())
   * @returns {import('@supabase/supabase-js').SupabaseClient}
   */
  static getClient() {
    return supabase;
  }

  // ============ GENERIC CRUD OPERATIONS ============

  /**
   * Insert a single record into a table
   * @param {string} table - Table name
   * @param {object} data - Record data
   * @returns {Promise<object>} Created record
   */
  static async insert(table, data) {
    const { data: result, error } = await supabase
      .from(table)
      .insert([data])
      .select()
      .single();
    if (error) throw new Error(`Insert error: ${sanitizeError(error.message)}`);
    return result;
  }

  /**
   * Insert multiple records
   * @param {string} table - Table name
   * @param {array} dataArray - Array of records
   * @returns {Promise<array>} Created records
   */
  static async insertMany(table, dataArray) {
    const { data, error } = await supabase
      .from(table)
      .insert(dataArray)
      .select();
    if (error) throw new Error(`Insert error: ${sanitizeError(error.message)}`);
    return data;
  }

  /**
   * Find single record by column value
   * @param {string} table - Table name
   * @param {string} column - Column name
   * @param {*} value - Column value
   * @param {string} select - Columns to select (default: *)
   * @returns {Promise<object|null>} Found record or null
   */
  static async selectByColumn(table, column, value, select = "*") {
    return withRetry(async () => {
      const { data, error } = await supabase
        .from(table)
        .select(select)
        .eq(column, value)
        .single();
      if (error && error.code !== "PGRST116")
        throw new Error(`Select error: ${sanitizeError(error.message)}`);
      return data || null;
    });
  }

  /**
   * Find all records with a specific column value
   * @param {string} table - Table name
   * @param {string} column - Column name
   * @param {*} value - Column value
   * @param {string} select - Columns to select
   * @param {string} orderBy - Column to order by
   * @param {string} ascending - Order direction
   * @returns {Promise<array>} Found records
   */
  static async selectAll(
    table,
    column,
    value,
    select = "*",
    orderBy = "created_at",
    ascending = false,
  ) {
    return withRetry(async () => {
      let query = supabase.from(table).select(select).eq(column, value);

      if (orderBy) {
        query = query.order(orderBy, { ascending });
      }

      const { data, error } = await query;
      if (error)
        throw new Error(`Select error: ${sanitizeError(error.message)}`);
      return data || [];
    });
  }

  /**
   * Get all records from a table
   * @param {string} table - Table name
   * @param {string} select - Columns to select
   * @returns {Promise<array>} All records
   */
  static async selectAllRecords(table, select = "*") {
    return withRetry(async () => {
      const { data, error } = await supabase.from(table).select(select);
      if (error)
        throw new Error(`Select error: ${sanitizeError(error.message)}`);
      return data || [];
    });
  }

  /**
   * Find record by ID
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @param {string} select - Columns to select
   * @returns {Promise<object|null>} Found record or null
   */
  static async findById(table, id, select = "*") {
    return this.selectByColumn(table, "id", id, select);
  }

  /**
   * Update a single record
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @param {object} updates - Update data
   * @returns {Promise<object>} Updated record
   */
  static async update(table, id, updates) {
    if (!id) throw new Error("Update error: missing id");

    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq("id", id)
      .select();

    if (error) throw new Error(`Update error: ${sanitizeError(error.message)}`);
    if (Array.isArray(data)) {
      if (data.length === 0) return null;
      if (data.length === 1) return data[0];
      // More than one row updated unexpectedly when filtering by id
      throw new Error(
        "Update error: expected a single record but multiple rows were returned",
      );
    }

    return data;
  }

  /**
   * Update multiple records by column
   * @param {string} table - Table name
   * @param {string} column - Column to filter by
   * @param {*} value - Column value
   * @param {object} updates - Update data
   * @returns {Promise<array>} Updated records
   */
  static async updateMany(table, column, value, updates) {
    const { data, error } = await supabase
      .from(table)
      .update(updates)
      .eq(column, value)
      .select();
    if (error) throw new Error(`Update error: ${sanitizeError(error.message)}`);
    return data;
  }

  /**
   * Delete a record
   * @param {string} table - Table name
   * @param {string} id - Record ID
   * @returns {Promise<void>}
   */
  static async deleteRecord(table, id) {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw new Error(`Delete error: ${sanitizeError(error.message)}`);
  }

  /**
   * Delete multiple records
   * @param {string} table - Table name
   * @param {string} column - Column to filter by
   * @param {*} value - Column value
   * @returns {Promise<void>}
   */
  static async deleteMany(table, column, value) {
    const { error } = await supabase.from(table).delete().eq(column, value);
    if (error) throw new Error(`Delete error: ${sanitizeError(error.message)}`);
  }

  // ============ USER OPERATIONS ============

  /**
   * Parse user data to ensure avatar is properly formatted
   * @param {object} user - User object from database
   * @returns {object} Formatted user object
   */
  static formatUserData(user) {
    if (!user) return null;

    // Parse avatar if it's a string
    if (user.avatar && typeof user.avatar === "string") {
      try {
        user.avatar = JSON.parse(user.avatar);
      } catch (e) {
        // If parsing fails, keep as is
        console.warn("Could not parse avatar JSON:", e.message);
      }
    }

    return user;
  }

  static async createUser(userData) {
    return this.insert("users", userData);
  }

  static async findUserByEmail(email) {
    const user = await this.selectByColumn("users", "email", email);
    return this.formatUserData(user);
  }

  static async findUserById(id) {
    const user = await this.selectByColumn("users", "id", id);
    return this.formatUserData(user);
  }

  /**
   * Batch-fetch multiple users by IDs in a single query
   * Returns a Map of userId → formatted user data
   */
  static async findUsersByIds(ids) {
    if (!ids || ids.length === 0) return new Map();
    const uniqueIds = [...new Set(ids)];
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .in("id", uniqueIds);
    if (error) throw new Error(`Select error: ${sanitizeError(error.message)}`);
    const map = new Map();
    for (const user of data || []) {
      map.set(user.id, this.formatUserData(user));
    }
    return map;
  }

  static async findUserByPhone(phoneNumber) {
    const user = await this.selectByColumn(
      "users",
      "phone_number",
      phoneNumber,
    );
    return this.formatUserData(user);
  }

  static async updateUser(id, updates) {
    const user = await this.update("users", id, updates);
    return this.formatUserData(user);
  }

  static async getAllUsers() {
    return this.selectAllRecords("users");
  }

  // ============ ADDRESS OPERATIONS ============

  static async addAddress(addressData) {
    return this.insert("addresses", addressData);
  }

  static async getUserAddresses(userId) {
    return this.selectAll("addresses", "user_id", userId);
  }

  static async updateAddress(id, updates) {
    return this.update("addresses", id, updates);
  }

  static async deleteAddress(id) {
    return this.deleteRecord("addresses", id);
  }

  // ============ ROOM OPERATIONS ============

  static async createRoom(roomData) {
    return this.insert("rooms", roomData);
  }

  static async findRoomByCode(code) {
    return this.selectByColumn("rooms", "code", code);
  }

  static async findRoomById(id) {
    const { data, error } = await supabase
      .from("rooms")
      .select(
        `*,
        room_members(
          id,
          user_id,
          name,
          is_payer,
          joined_at,
          presence,
          status
        ),
        room_billing(*)`,
      )
      .eq("id", id)
      .single();
    if (error && error.code !== "PGRST116")
      throw new Error(`Select error: ${error.message}`);
    return data || null;
  }

  static async getUserRooms(userId) {
    const { data, error } = await supabase
      .from("room_members")
      .select(
        `room_id,
        is_payer,
        status,
        rooms(
          id,
          name,
          code,
          description,
          created_by,
          created_at,
          updated_at
        )`,
      )
      .eq("user_id", userId)
      .eq("status", "approved");
    if (error) throw new Error(`Select error: ${error.message}`);
    // Flatten: merge rooms data onto the top-level object so room.id works
    return (data || []).map((row) => ({
      ...row.rooms,
      _userIsPayer: row.is_payer,
    }));
  }

  static async updateRoom(id, updates) {
    return this.update("rooms", id, updates);
  }

  static async getRoomsByUser(userId) {
    const { data, error } = await supabase
      .from("rooms")
      .select("*")
      .eq("created_by", userId);
    if (error) throw new Error(`Select error: ${error.message}`);
    return data || [];
  }

  // ============ ROOM MEMBER OPERATIONS ============

  static async addRoomMember(data) {
    // Accept either a single data object or (roomId, userId, memberName, isPayer)
    if (typeof data === "object" && data.room_id) {
      return this.insert("room_members", {
        room_id: data.room_id,
        user_id: data.user_id,
        name: data.name || data.memberName || "",
        is_payer: data.is_payer !== undefined ? data.is_payer : true,
        joined_at: data.joined_at || new Date().toISOString(),
        presence: data.presence || [],
        status: data.status || "pending",
      });
    }
    // Fallback: treat first arg as room_id (legacy 4-arg call)
    const args = arguments;
    return this.insert("room_members", {
      room_id: args[0],
      user_id: args[1],
      name: args[2] || "",
      is_payer: args[3] !== undefined ? args[3] : true,
      joined_at: new Date().toISOString(),
      presence: [],
      status: "pending",
    });
  }

  static async getRoomMembers(roomId) {
    const all = await this.selectAll(
      "room_members",
      "room_id",
      roomId,
      "id, user_id, name, is_payer, joined_at, presence, status",
      "joined_at",
    );
    // Only return approved members (or members without a status column yet)
    return (all || []).filter((m) => m.status === "approved" || !m.status);
  }

  // Returns ALL members including pending (used for admin approval flow)
  static async getAllRoomMembers(roomId) {
    return this.selectAll(
      "room_members",
      "room_id",
      roomId,
      "id, user_id, name, is_payer, joined_at, presence, status",
      "joined_at",
    );
  }

  static async updateRoomMember(id, updates) {
    return this.update("room_members", id, updates);
  }

  static async removeRoomMember(id) {
    return this.deleteRecord("room_members", id);
  }

  // ============ BILLING CYCLE OPERATIONS ============

  static async createBillingCycle(cycleData) {
    return this.insert("billing_cycles", cycleData);
  }

  static async findBillingCycleById(id) {
    return this.selectByColumn("billing_cycles", "id", id);
  }

  static async getRoomBillingCycles(roomId) {
    return this.selectAll(
      "billing_cycles",
      "room_id",
      roomId,
      "*",
      "start_date",
      false,
    );
  }

  static async getActiveBillingCycle(roomId) {
    const { data, error } = await supabase
      .from("billing_cycles")
      .select("*")
      .eq("room_id", roomId)
      .eq("status", "active")
      .single();
    if (error && error.code !== "PGRST116")
      throw new Error(`Select error: ${error.message}`);
    return data || null;
  }

  static async updateBillingCycle(id, updates) {
    return this.update("billing_cycles", id, updates);
  }

  static async addBillingCycleCharge(chargeData) {
    return this.insert("billing_cycle_charges", chargeData);
  }

  static async getBillingCycleCharges(cycleId) {
    return this.selectAll(
      "billing_cycle_charges",
      "billing_cycle_id",
      cycleId,
      "*",
      "id",
      true,
    );
  }

  // ============ PAYMENT OPERATIONS ============

  static async createPayment(paymentData) {
    return this.insert("payments", paymentData);
  }

  static async findPaymentById(id) {
    return this.selectByColumn("payments", "id", id);
  }

  static async getRoomPayments(roomId) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("room_id", roomId)
      .order("payment_date", { ascending: false });
    if (error) throw new Error(`Select error: ${error.message}`);
    return data || [];
  }

  static async getUserPayments(userId) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("paid_by", userId)
      .order("payment_date", { ascending: false });
    if (error) throw new Error(`Select error: ${error.message}`);
    return data || [];
  }

  static async updatePayment(id, updates) {
    return this.update("payments", id, updates);
  }

  static async getPaymentsForCycle(roomId, startDate, endDate) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("room_id", roomId)
      .eq("billing_cycle_start", startDate)
      .eq("billing_cycle_end", endDate)
      .order("payment_date", { ascending: false });
    if (error) throw new Error(`Select error: ${error.message}`);
    return data || [];
  }

  // ============ SETTLEMENT OPERATIONS ============

  static async createSettlement(settlementData) {
    return this.insert("settlements", settlementData);
  }

  static async getRoomSettlements(roomId) {
    return this.selectAll("settlements", "room_id", roomId);
  }

  static async getPendingSettlements(debtorId) {
    return this.selectAll("settlements", "debtor_id", debtorId);
  }

  static async updateSettlement(id, updates) {
    return this.update("settlements", id, updates);
  }

  // ============ SUPPORT TICKET OPERATIONS ============

  static async createSupportTicket(ticketData) {
    return this.insert("support_tickets", ticketData);
  }

  static async findTicketById(id) {
    return this.selectByColumn("support_tickets", "id", id);
  }

  static async getUserTickets(userId) {
    return this.selectAll("support_tickets", "user_id", userId);
  }

  static async getAllTickets() {
    return this.selectAll("support_tickets", "status", "open");
  }

  static async updateTicket(id, updates) {
    return this.update("support_tickets", id, updates);
  }

  static async addTicketResponse(responseData) {
    return this.insert("support_ticket_responses", responseData);
  }

  static async getTicketResponses(ticketId) {
    return this.selectAll(
      "support_ticket_responses",
      "ticket_id",
      ticketId,
      "*",
      "response_time",
      true,
    );
  }

  // ============ BUG REPORT OPERATIONS ============

  static async createBugReport(reportData) {
    return this.insert("bug_reports", reportData);
  }

  static async getAllBugReports() {
    return this.selectAllRecords("bug_reports");
  }

  static async updateBugReport(id, updates) {
    return this.update("bug_reports", id, updates);
  }

  // ============ ANNOUNCEMENT OPERATIONS ============

  static async createAnnouncement(announcementData) {
    return this.insert("announcements", announcementData);
  }

  static async getRoomAnnouncements(roomId) {
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("room_id", roomId)
      .order("pin_priority", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Select error: ${error.message}`);
    return data || [];
  }

  static async updateAnnouncement(id, updates) {
    return this.update("announcements", id, updates);
  }

  static async deleteAnnouncement(id) {
    return this.deleteRecord("announcements", id);
  }

  // ============ NOTIFICATION OPERATIONS ============

  static async createNotification(notificationData) {
    return this.insert("notification_logs", notificationData);
  }

  static async getUserNotifications(userId) {
    return this.selectAll(
      "notification_logs",
      "user_id",
      userId,
      "*",
      "created_at",
      false,
    );
  }

  static async markNotificationAsRead(id) {
    return this.update("notification_logs", id, { is_read: true });
  }

  // ============ FAQ OPERATIONS ============

  static async getAllFAQs() {
    return this.selectAllRecords("faqs");
  }

  static async getFAQsByCategory(category) {
    return this.selectAll("faqs", "category", category);
  }

  // ============ PAYMENT TRANSACTION OPERATIONS ============

  static async createPaymentTransaction(transactionData) {
    return this.insert("payment_transactions", transactionData);
  }

  static async findTransactionById(id) {
    return this.selectByColumn("payment_transactions", "id", id);
  }

  static async getPaymentTransactions(paymentId) {
    return this.selectAll("payment_transactions", "payment_id", paymentId);
  }
}

module.exports = SupabaseService;
