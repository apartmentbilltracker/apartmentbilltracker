// Support Ticket Controller (Supabase Version)
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");

// Helper to normalize ticket responses for mobile compatibility
const normalizeResponse = (response) => ({
  ...response,
  createdAt: response.created_at,
  responderId: response.responder_id,
  ticketId: response.ticket_id,
});

// Helper to normalize a ticket object for mobile compatibility
const normalizeTicket = (ticket) => ({
  ...ticket,
  createdAt: ticket.created_at,
  userId: ticket.user_id,
  roomId: ticket.room_id,
  // Add `replies` alias for mobile compatibility
  replies: (ticket.responses || []).map(normalizeResponse),
});

// ============================================================
// CREATE SUPPORT TICKET
// ============================================================
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId, title, description, category, priority } = req.body;

    if (!roomId || !title || !description) {
      return next(
        new ErrorHandler("Room ID, title, and description are required", 400),
      );
    }

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    const ticket = await SupabaseService.insert("support_tickets", {
      room_id: roomId,
      user_id: req.user.id,
      title,
      description,
      category: category || "general",
      priority: priority || "normal",
      status: "open",
      created_at: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      ticket: normalizeTicket(ticket),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET ALL TICKETS FOR A ROOM
// ============================================================
router.get("/room/:roomId", isAuthenticated, async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const { status } = req.query;

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) {
      return next(new ErrorHandler("Room not found", 404));
    }

    const allTickets = await SupabaseService.selectAll(
      "support_tickets",
      "room_id",
      roomId,
    );

    let tickets = Array.isArray(allTickets) ? allTickets : [];
    if (status) {
      tickets = tickets.filter((t) => t.status === status);
    }

    // Enrich with user details
    for (let ticket of tickets) {
      const user = await SupabaseService.findUserById(ticket.user_id);
      ticket.user = user;

      // Get responses
      const responses = await SupabaseService.selectAll(
        "support_ticket_responses",
        "ticket_id",
        ticket.id,
        "*",
        "created_at",
        true,
      );

      for (let response of Array.isArray(responses) ? responses : []) {
        const responder = await SupabaseService.findUserById(
          response.responder_id,
        );
        response.responder = responder;
      }

      ticket.responses = Array.isArray(responses) ? responses : [];
    }

    const sorted = tickets.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    res.status(200).json({
      success: true,
      tickets: sorted.map(normalizeTicket),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET USER'S TICKETS
// ============================================================
router.get("/my-tickets", isAuthenticated, async (req, res, next) => {
  try {
    const { status } = req.query;

    const allTickets = await SupabaseService.selectAll(
      "support_tickets",
      "user_id",
      req.user.id,
    );

    let tickets = Array.isArray(allTickets) ? allTickets : [];
    if (status) {
      tickets = tickets.filter((t) => t.status === status);
    }

    // Enrich with room and response details
    for (let ticket of tickets) {
      const room = await SupabaseService.findRoomById(ticket.room_id);
      ticket.room = room;

      const responses = await SupabaseService.selectAll(
        "support_ticket_responses",
        "ticket_id",
        ticket.id,
        "*",
        "created_at",
        true,
      );

      for (let response of Array.isArray(responses) ? responses : []) {
        const responder = await SupabaseService.findUserById(
          response.responder_id,
        );
        response.responder = responder;
      }

      ticket.responses = Array.isArray(responses) ? responses : [];
    }

    const sorted = tickets.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    res.status(200).json({
      success: true,
      tickets: sorted.map(normalizeTicket),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET SINGLE TICKET
// ============================================================
router.get("/ticket/:ticketId", isAuthenticated, async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const ticket = await SupabaseService.selectByColumn(
      "support_tickets",
      "id",
      ticketId,
    );

    if (!ticket) {
      return next(new ErrorHandler("Support ticket not found", 404));
    }

    // Enrich with user and room details
    const user = await SupabaseService.findUserById(ticket.user_id);
    const room = await SupabaseService.findRoomById(ticket.room_id);
    ticket.user = user;
    ticket.room = room;

    // Get responses
    const responses = await SupabaseService.selectAll(
      "support_ticket_responses",
      "ticket_id",
      ticketId,
      "*",
      "created_at",
      true,
    );

    for (let response of responses || []) {
      const responder = await SupabaseService.findUserById(
        response.responder_id,
      );
      response.responder = responder;
    }

    ticket.responses = responses;

    res.status(200).json({
      success: true,
      ticket: normalizeTicket(ticket),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// UPDATE TICKET STATUS
// ============================================================
router.put(
  "/ticket/:ticketId/status",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { ticketId } = req.params;
      const { status, priority } = req.body;

      const updateData = {};
      if (status) updateData.status = status;
      if (priority) updateData.priority = priority;
      updateData.updated_at = new Date();

      const updatedTicket = await SupabaseService.update(
        "support_tickets",
        ticketId,
        updateData,
      );

      res.status(200).json({
        success: true,
        message: "Ticket updated successfully",
        ticket: updatedTicket,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// ADD RESPONSE TO TICKET
// ============================================================
router.post(
  "/ticket/:ticketId/response",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { ticketId } = req.params;
      const { message } = req.body;

      if (!message) {
        return next(new ErrorHandler("Message is required", 400));
      }

      // Verify ticket exists
      const ticket = await SupabaseService.selectByColumn(
        "support_tickets",
        "id",
        ticketId,
      );

      if (!ticket) {
        return next(new ErrorHandler("Support ticket not found", 404));
      }

      const response = await SupabaseService.insert(
        "support_ticket_responses",
        {
          ticket_id: ticketId,
          responder_id: req.user.id,
          message,
          created_at: new Date(),
        },
      );

      // Enrich with responder details
      const responder = await SupabaseService.findUserById(req.user.id);
      response.responder = responder;

      res.status(201).json({
        success: true,
        message: "Response added successfully",
        response,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// GET TICKET RESPONSES
// ============================================================
router.get(
  "/ticket/:ticketId/responses",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { ticketId } = req.params;

      const responses =
        (await SupabaseService.selectAll(
          "support_ticket_responses",
          "ticket_id",
          ticketId,
          "*",
          "created_at",
          true,
        )) || [];

      // Enrich with responder details
      for (let response of responses) {
        const responder = await SupabaseService.findUserById(
          response.responder_id,
        );
        response.responder = responder;
      }

      const sorted = responses.sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at),
      );

      res.status(200).json({
        success: true,
        responses: sorted,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// DELETE TICKET
// ============================================================
router.delete("/ticket/:ticketId", isAuthenticated, async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    // Verify ownership
    const ticket = await SupabaseService.selectByColumn(
      "support_tickets",
      "id",
      ticketId,
    );

    if (!ticket) {
      return next(new ErrorHandler("Support ticket not found", 404));
    }

    if (ticket.user_id !== req.user.id) {
      return next(new ErrorHandler("Unauthorized", 403));
    }

    await SupabaseService.deleteRecord("support_tickets", ticketId);

    res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET ALL TICKETS (ADMIN ONLY)
// ============================================================
router.get("/all-tickets", isAuthenticated, async (req, res, next) => {
  try {
    // Check if user is admin
    const user = await SupabaseService.findUserById(req.user.id);
    if (!user || !user.is_admin) {
      return next(new ErrorHandler("Only admins can view all tickets", 403));
    }

    // Get all tickets
    const tickets = await SupabaseService.selectAllRecords("support_tickets");

    // Enrich with user and room details
    const enrichedTickets = [];
    for (let ticket of tickets || []) {
      const ticketUser = await SupabaseService.findUserById(ticket.user_id);
      const room = await SupabaseService.findRoomById(ticket.room_id);

      enrichedTickets.push({
        ...ticket,
        user: ticketUser,
        room: room,
      });
    }

    res.status(200).json({
      success: true,
      count: enrichedTickets.length,
      tickets: enrichedTickets,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

module.exports = router;
