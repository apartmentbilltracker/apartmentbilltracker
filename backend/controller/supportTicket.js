const SupportTicket = require("../model/supportTicket");
const User = require("../model/user");

// Create support ticket
exports.createSupportTicket = async (req, res) => {
  try {
    const { subject, message, category } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    const ticket = new SupportTicket({
      user: userId,
      userName: user.name,
      userEmail: user.email,
      subject,
      message,
      category,
    });

    await ticket.save();

    res.status(201).json({
      success: true,
      message: "Support ticket created successfully",
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating support ticket",
      error: error.message,
    });
  }
};

// Get user's support tickets
exports.getUserTickets = async (req, res) => {
  try {
    const userId = req.user._id;
    const tickets = await SupportTicket.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching tickets",
      error: error.message,
    });
  }
};

// Get ticket details
exports.getTicketDetails = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await SupportTicket.findById(ticketId);

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching ticket",
      error: error.message,
    });
  }
};

// Add reply to ticket
exports.addReply = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const isAdmin = req.user.role && req.user.role.includes("admin");

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Check if user is the ticket creator or admin
    if (String(ticket.user) !== String(userId) && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!ticket.replies) {
      ticket.replies = [];
    }

    ticket.replies.push({
      from: isAdmin ? "admin" : "user",
      message,
      createdAt: new Date(),
    });
    ticket.updatedAt = new Date();

    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Reply added successfully",
      data: ticket,
    });
  } catch (error) {
    console.error("Error in addReply:", error);
    res.status(500).json({
      success: false,
      message: "Error adding reply",
      error: error.message,
    });
  }
};

// Get all tickets (admin only)
exports.getAllTickets = async (req, res) => {
  try {
    const tickets = await SupportTicket.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching tickets",
      error: error.message,
    });
  }
};

// Update ticket status (admin only)
exports.updateTicketStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, reply } = req.body;

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    ticket.status = status;
    if (reply) {
      ticket.replies.push({
        from: "admin",
        message: reply,
      });
    }
    ticket.updatedAt = new Date();

    if (status === "resolved" && !ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Ticket updated successfully",
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating ticket",
      error: error.message,
    });
  }
};

// Mark ticket as read by user
exports.markTicketAsRead = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role && req.user.role.includes("admin");

    const ticket = await SupportTicket.findById(ticketId);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    // Check if user is authorized to mark this ticket as read
    if (String(ticket.user) !== String(userId) && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Mark as read by appropriate party
    if (isAdmin) {
      ticket.isReadByAdmin = true;
    } else {
      ticket.isReadByUser = true;
    }

    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Ticket marked as read",
      data: ticket,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking ticket as read",
      error: error.message,
    });
  }
};
