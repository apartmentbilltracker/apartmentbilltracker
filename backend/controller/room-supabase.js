const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const { isAuthenticated } = require("../middleware/auth");
const ErrorHandler = require("../utils/ErrorHandler");
const createNotification = require("../utils/createNotification");
const sendMail = require("../utils/sendMail");
const WelcomeRoomContent = require("../utils/WelcomeRoomContent");
const PDFDocument = require("pdfkit");

// Helper to normalize snake_case Supabase fields to camelCase for mobile clients
const normalizeMember = (member) => ({
  ...member,
  isPayer: member.is_payer,
  joinedAt: member.joined_at,
  userId: member.user_id,
  roomId: member.room_id,
  status: member.status || "approved",
});

// Helper to add camelCase aliases to room objects
const normalizeRoom = (room) => {
  if (!room) return room;
  room.createdAt = room.created_at;
  room.createdBy = room.created_by;
  room.roomCode = room.room_code;
  return room;
};

// ============================================================
// CREATE ROOM
// ============================================================
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return next(new ErrorHandler("Name is required", 400));

    const code = `${name.replace(/\s+/g, "-").toLowerCase()}-${Date.now().toString().slice(-5)}`;

    const room = await SupabaseService.createRoom({
      name,
      code,
      description: description || "",
      created_by: req.user?.id || null,
    });

    res.status(201).json({ success: true, room });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// LIST ROOMS - Admin sees all, users see only their rooms
// ============================================================
router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    let rooms = [];

    if (req.user.role && req.user.role.includes("admin")) {
      // Admin sees all rooms
      rooms = await SupabaseService.selectAllRecords("rooms");
    } else {
      // Regular user sees only rooms they're members of
      const userRooms = await SupabaseService.getUserRooms(req.user.id);
      rooms = userRooms || [];
    }

    // Enhance rooms with member details (populate-like functionality)
    for (let room of rooms) {
      const members = await SupabaseService.getRoomMembers(room.id);
      const enrichedMembers = [];
      for (let member of members || []) {
        const user = await SupabaseService.findUserById(member.user_id);
        enrichedMembers.push({
          ...normalizeMember(member),
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
              }
            : null,
        });
      }
      room.members = enrichedMembers;
      normalizeRoom(room);
    }

    res.status(200).json({ success: true, rooms });
  } catch (error) {
    console.error("Error in GET /api/v2/rooms:", error);
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// LIST ROOMS FOR CLIENT VIEW (respects membership only)
// ============================================================
router.get("/client/my-rooms", isAuthenticated, async (req, res, next) => {
  try {
    // Always filter by membership, even if user is admin
    const userRooms = await SupabaseService.getUserRooms(req.user.id);
    const rooms = userRooms || [];

    // Enhance rooms with member details
    for (let room of rooms) {
      const members = await SupabaseService.getRoomMembers(room.id);
      const enrichedMembers = [];
      for (let member of members || []) {
        const user = await SupabaseService.findUserById(member.user_id);
        enrichedMembers.push({
          ...normalizeMember(member),
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
              }
            : null,
        });
      }
      room.members = enrichedMembers;
      normalizeRoom(room);

      // Attach active billing cycle data
      try {
        const activeCycle = await SupabaseService.getActiveBillingCycle(
          room.id,
        );
        if (activeCycle) {
          room.currentCycleId = activeCycle.id;
          room.billing = {
            start: activeCycle.start_date,
            end: activeCycle.end_date,
            rent: activeCycle.rent || 0,
            electricity: activeCycle.electricity || 0,
            water: activeCycle.water_bill_amount || 0,
            internet: activeCycle.internet || 0,
            previousReading: activeCycle.previous_meter_reading ?? null,
            currentReading: activeCycle.current_meter_reading ?? null,
          };

          // Build memberPayments (payment status per payor)
          const payments =
            (await SupabaseService.getPaymentsForCycle(
              room.id,
              activeCycle.start_date,
              activeCycle.end_date,
            )) || [];
          const completedPayments = payments.filter(
            (p) => p.status === "completed",
          );

          const payerMembers = (members || []).filter((m) => m.is_payer);
          room.memberPayments = payerMembers.map((member) => {
            const memberPayments = completedPayments.filter(
              (p) => p.paid_by === member.user_id,
            );
            const rentPayment = memberPayments.find(
              (p) => p.bill_type === "rent",
            );
            const electricityPayment = memberPayments.find(
              (p) => p.bill_type === "electricity",
            );
            const waterPayment = memberPayments.find(
              (p) => p.bill_type === "water",
            );
            const internetPayment = memberPayments.find(
              (p) => p.bill_type === "internet",
            );
            const totalPayment = memberPayments.find(
              (p) => p.bill_type === "total",
            );
            const isTotalPaid = !!totalPayment;

            return {
              member: member.user_id,
              memberName: member.name,
              isPayer: member.is_payer,
              rentStatus: rentPayment || isTotalPaid ? "paid" : "unpaid",
              electricityStatus:
                electricityPayment || isTotalPaid ? "paid" : "unpaid",
              waterStatus: waterPayment || isTotalPaid ? "paid" : "unpaid",
              internetStatus:
                internetPayment || isTotalPaid ? "paid" : "unpaid",
              allPaid:
                !!totalPayment ||
                (!!rentPayment &&
                  !!electricityPayment &&
                  !!waterPayment &&
                  !!internetPayment),
            };
          });
        }
      } catch (billingError) {
        console.log(
          `[MY-ROOMS] No active billing for room ${room.name}:`,
          billingError.message,
        );
      }

      console.log(
        `[MY-ROOMS] ${room.name}: members=${enrichedMembers.length}, billing=${room.billing ? "yes" : "no"}`,
      );
    }

    res.status(200).json({ success: true, rooms });
  } catch (error) {
    console.error("Error in GET /client/my-rooms:", error);
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// BROWSE ALL ROOMS (for joining)
// ============================================================
router.get("/browse/available", isAuthenticated, async (req, res, next) => {
  try {
    console.log("GET /api/v2/rooms/browse/available - User ID:", req.user.id);

    const rooms = await SupabaseService.selectAllRecords("rooms");

    // Get user's pending memberships
    const allMemberships =
      await SupabaseService.selectAllRecords("room_members");
    const userPendingRoomIds = (allMemberships || [])
      .filter((m) => m.user_id === req.user.id && m.status === "pending")
      .map((m) => m.room_id);

    // Enhance rooms with member details (only approved members)
    for (let room of Array.isArray(rooms) ? rooms : []) {
      const members = await SupabaseService.getRoomMembers(room.id);
      const enrichedMembers = [];
      for (let member of members || []) {
        const user = await SupabaseService.findUserById(member.user_id);
        enrichedMembers.push({
          ...normalizeMember(member),
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
              }
            : null,
        });
      }
      room.members = enrichedMembers;
      normalizeRoom(room);
    }

    console.log("Available rooms for browse:", (rooms || []).length);
    res.status(200).json({
      success: true,
      rooms: Array.isArray(rooms) ? rooms : [],
      pendingRoomIds: userPendingRoomIds,
    });
  } catch (error) {
    console.error("Error in GET /browse/available:", error);
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET SINGLE ROOM
// ============================================================
router.get("/:id", async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Get members with user details (only approved)
    const allMembers = await SupabaseService.selectAllRecords("room_members");
    const members = (allMembers || []).filter(
      (m) => m.room_id === room.id && (m.status === "approved" || !m.status),
    );
    const enrichedMembers = [];
    for (let member of members) {
      const user = await SupabaseService.findUserById(member.user_id);
      enrichedMembers.push({
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    }
    room.members = enrichedMembers;
    normalizeRoom(room);

    // Attach active billing cycle data to room response
    const roomBillingCycles = await SupabaseService.getRoomBillingCycles(
      room.id,
    );
    const activeCycle = (roomBillingCycles || []).find(
      (c) => c.status === "active",
    );
    if (activeCycle) {
      room.currentCycleId = activeCycle.id;
      room.billing = {
        start: activeCycle.start_date,
        end: activeCycle.end_date,
        rent: activeCycle.rent || 0,
        electricity: activeCycle.electricity || 0,
        water: activeCycle.water_bill_amount || 0,
        internet: activeCycle.internet || 0,
        previousReading: activeCycle.previous_meter_reading ?? null,
        currentReading: activeCycle.current_meter_reading ?? null,
      };
    }

    console.log(
      `[ROOM GET] ${room.name}: Members count: ${room.members.length}, Active cycle: ${activeCycle ? activeCycle.id : "none"}`,
    );

    res.status(200).json({ success: true, room });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// JOIN ROOM
// ============================================================
router.post("/:id/join", isAuthenticated, async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Check if already a member or has pending request
    const allMemberships =
      await SupabaseService.selectAllRecords("room_members");
    const existingMember = (allMemberships || []).find(
      (m) => m.user_id === req.user.id && m.room_id === req.params.id,
    );

    if (existingMember) {
      if (existingMember.status === "pending") {
        return res.status(200).json({
          success: true,
          message: "Your join request is pending approval",
          pending: true,
        });
      }
      // Already approved member
      const members = await SupabaseService.getRoomMembers(room.id);
      const enrichedMembers = [];
      for (let member of members || []) {
        const user = await SupabaseService.findUserById(member.user_id);
        enrichedMembers.push({
          ...normalizeMember(member),
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
              }
            : null,
        });
      }
      room.members = enrichedMembers;
      normalizeRoom(room);
      return res.status(200).json({
        success: true,
        message: "Already joined",
        room,
      });
    }

    const { isPayer = true } = req.body;

    // Add user as room member with pending status
    await SupabaseService.addRoomMember({
      room_id: req.params.id,
      user_id: req.user.id,
      name: req.user.name || "",
      is_payer: isPayer,
      status: "pending",
    });

    // Notify admin
    try {
      await createNotification(room.created_by, {
        type: "join_request",
        title: "New Join Request",
        message: `${req.user.name || "A user"} has requested to join ${room.name}.`,
        relatedData: {
          roomId: room.id,
          userId: req.user.id,
          userName: req.user.name,
        },
      });
    } catch (notifErr) {
      console.error("Error creating join notification:", notifErr);
    }

    res.status(200).json({
      success: true,
      message: "Join request sent! Waiting for admin approval.",
      pending: true,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// LEAVE ROOM
// ============================================================
router.post("/:id/leave", isAuthenticated, async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Remove user from room_members
    const deleted = await SupabaseService.deleteRecord("room_members", {
      room_id: req.params.id,
      user_id: req.user.id,
    });

    if (!deleted) {
      return next(new ErrorHandler("Not a member of this room", 400));
    }

    res.status(200).json({ success: true, message: "Left room", room });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// UPDATE ROOM DETAILS
// ============================================================
router.put("/:id", isAuthenticated, async (req, res, next) => {
  try {
    const { name, description, maxOccupancy } = req.body;
    if (!name) return next(new ErrorHandler("Name is required", 400));

    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Update room
    const updatedRoom = await SupabaseService.update("rooms", req.params.id, {
      name: name.trim(),
      description: description ? description.trim() : room.description,
      max_occupancy: maxOccupancy ? Number(maxOccupancy) : room.max_occupancy,
    });

    // Enhance with member data
    const allMembers = await SupabaseService.selectAllRecords("room_members");
    const members = (allMembers || []).filter(
      (m) => m.room_id === updatedRoom.id,
    );
    const enrichedMembers = [];
    for (let member of members) {
      const user = await SupabaseService.findUserById(member.user_id);
      enrichedMembers.push({
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    }
    updatedRoom.members = enrichedMembers;
    normalizeRoom(updatedRoom);

    res.status(200).json({ success: true, room: updatedRoom });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// DELETE ROOM
// ============================================================
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    await SupabaseService.deleteRecord("rooms", req.params.id);

    res
      .status(200)
      .json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// UPDATE MEMBER IN ROOM (toggle payor status)
// ============================================================
router.put(
  "/:id/members/:memberId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const room = await SupabaseService.findRoomById(req.params.id);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      const member = await SupabaseService.selectByColumn(
        "room_members",
        "id",
        req.params.memberId,
      );
      if (!member) {
        return next(new ErrorHandler("Member not found in room", 404));
      }

      const oldPayorStatus = member.is_payer;
      const adminName = req.user?.name || "Administrator";

      // Update member
      const allowedUpdates = { is_payer: "is_payer" };
      const updateData = {};
      Object.keys(req.body).forEach((field) => {
        if (allowedUpdates[field]) {
          updateData[allowedUpdates[field]] = req.body[field];
        }
      });

      const updatedMember = await SupabaseService.update(
        "room_members",
        req.params.memberId,
        updateData,
      );

      // Send notification if payor status changed
      if (
        req.body.hasOwnProperty("is_payer") &&
        oldPayorStatus !== req.body.is_payer
      ) {
        const newStatus = req.body.is_payer
          ? "marked as payor"
          : "unmarked as payor";

        await createNotification(member.user_id, {
          type: "member_status_changed",
          title: "Status Changed",
          message: `Your status in ${room.name} has been ${newStatus} by ${adminName}.`,
          relatedData: {
            roomId: room.id,
            memberId: member.user_id,
            changeType: "payorStatus",
            newStatus: req.body.is_payer,
          },
        }).catch((error) => {
          console.error("Error creating notification:", error);
        });
      }

      res.status(200).json({
        success: true,
        message: "Member updated successfully",
        member: updatedMember,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// REMOVE MEMBER FROM ROOM
// ============================================================
router.delete(
  "/:id/members/:memberId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const room = await SupabaseService.findRoomById(req.params.id);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      await SupabaseService.deleteRecord("room_members", req.params.memberId);

      res.status(200).json({ success: true, message: "Member removed", room });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// APPROVE MEMBER JOIN REQUEST
// ============================================================
router.post(
  "/:id/members/:memberId/approve",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const room = await SupabaseService.findRoomById(req.params.id);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      // Only room creator can approve
      if (room.created_by !== req.user.id) {
        return next(
          new ErrorHandler("Only the room admin can approve members", 403),
        );
      }

      const member = await SupabaseService.selectByColumn(
        "room_members",
        "id",
        req.params.memberId,
      );
      if (!member) {
        return next(new ErrorHandler("Member not found", 404));
      }

      if (member.status === "approved") {
        return res.status(200).json({
          success: true,
          message: "Member is already approved",
        });
      }

      await SupabaseService.update("room_members", req.params.memberId, {
        status: "approved",
      });

      // Fetch user details for welcome email
      let memberUser = null;
      try {
        memberUser = await SupabaseService.findUserById(member.user_id);
      } catch (userErr) {
        console.error("Error fetching member user for welcome email:", userErr);
      }

      const memberName = (memberUser && memberUser.name) || member.name || "there";

      // Send welcome notification
      try {
        await createNotification(member.user_id, {
          type: "join_approved",
          title: "Welcome to " + room.name + "! 🎉",
          message: `Great news, ${memberName}! Your request to join ${room.name} has been approved. You can now view bills, make payments, and stay updated with announcements. Welcome aboard!`,
          relatedData: { roomId: room.id },
        });
      } catch (notifErr) {
        console.error("Error creating approval notification:", notifErr);
      }

      // Send welcome email
      if (memberUser && memberUser.email) {
        try {
          const emailContent = WelcomeRoomContent({
            userName: memberName,
            roomName: room.name,
            roomCode: room.room_code || null,
          });
          await sendMail({
            email: memberUser.email,
            subject: `Welcome to ${room.name}! Your join request has been approved 🎉`,
            message: emailContent,
          });
        } catch (emailErr) {
          console.error("Error sending welcome email:", emailErr);
        }
      }

      res.status(200).json({
        success: true,
        message: "Member approved successfully",
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// REJECT MEMBER JOIN REQUEST
// ============================================================
router.post(
  "/:id/members/:memberId/reject",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const room = await SupabaseService.findRoomById(req.params.id);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      // Only room creator can reject
      if (room.created_by !== req.user.id) {
        return next(
          new ErrorHandler("Only the room admin can reject members", 403),
        );
      }

      const member = await SupabaseService.selectByColumn(
        "room_members",
        "id",
        req.params.memberId,
      );
      if (!member) {
        return next(new ErrorHandler("Member not found", 404));
      }

      // Notify the member before deleting
      try {
        await createNotification(member.user_id, {
          type: "join_rejected",
          title: "Join Request Rejected",
          message: `Your request to join ${room.name} has been declined.`,
          relatedData: { roomId: room.id },
        });
      } catch (notifErr) {
        console.error("Error creating rejection notification:", notifErr);
      }

      // Remove the pending member record
      await SupabaseService.deleteRecord("room_members", req.params.memberId);

      res.status(200).json({
        success: true,
        message: "Member request rejected",
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// GET PENDING MEMBER REQUESTS FOR ROOM
// ============================================================
router.get("/:id/members/pending", isAuthenticated, async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    const allMembers = await SupabaseService.getAllRoomMembers(req.params.id);
    const pendingMembers = (allMembers || []).filter(
      (m) => m.status === "pending",
    );

    const enrichedPending = [];
    for (let member of pendingMembers) {
      const user = await SupabaseService.findUserById(member.user_id);
      enrichedPending.push({
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    }

    res.status(200).json({
      success: true,
      pendingMembers: enrichedPending,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// UPDATE BILLING FOR ROOM (Creates/updates billing cycle)
// ============================================================
router.put("/:id/billing", isAuthenticated, async (req, res, next) => {
  try {
    const roomId = req.params.id;
    if (!roomId || roomId === "undefined") {
      return next(
        new ErrorHandler("Room ID is required and must be valid", 400),
      );
    }

    const room = await SupabaseService.findRoomById(roomId);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Check authorization
    if (
      room.created_by &&
      room.created_by !== req.user.id &&
      !req.user.role?.includes("admin")
    ) {
      return next(new ErrorHandler("Forbidden", 403));
    }

    // NOTE: Billing cycle creation/update is handled by POST/PUT /api/v2/billing-cycles.
    // This endpoint only validates the room ownership and returns room + member data.
    // This avoids duplicate billing cycle creation.

    // Enhance room with member data
    const allMembers = await SupabaseService.selectAllRecords("room_members");
    const members = (allMembers || []).filter((m) => m.room_id === room.id);
    const enrichedMembers = [];
    for (let member of members) {
      const user = await SupabaseService.findUserById(member.user_id);
      enrichedMembers.push({
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    }
    room.members = enrichedMembers;
    normalizeRoom(room);

    res.status(200).json({
      success: true,
      room,
      message: "Room validated successfully",
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET BILLING HISTORY FOR ROOM
// ============================================================
router.get("/:id/billing-history", isAuthenticated, async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Check if user is a member
    const allMembers = await SupabaseService.selectAllRecords("room_members");
    const members = (allMembers || []).filter(
      (m) => m.room_id === req.params.id,
    );
    const isMember = members.some((m) => m.user_id === req.user.id);

    if (!isMember && room.created_by !== req.user.id) {
      return next(new ErrorHandler("Forbidden", 403));
    }

    // Get billing cycles for this room
    const billingCycles = await SupabaseService.getRoomBillingCycles(
      req.params.id,
    );

    res.status(200).json({ success: true, billing: billingCycles || [] });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// SAVE USER PRESENCE DATES FOR ROOM
// ============================================================
router.post("/:id/presence", isAuthenticated, async (req, res, next) => {
  try {
    const { presenceDates } = req.body;
    if (!Array.isArray(presenceDates)) {
      return next(new ErrorHandler("Presence dates must be an array", 400));
    }

    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Update presence for the member
    const allMembers = await SupabaseService.selectAllRecords("room_members");
    const members = (allMembers || []).filter(
      (m) => m.room_id === req.params.id,
    );
    const memberRecord = members.find((m) => m.user_id === req.user.id);
    if (!memberRecord) {
      return next(new ErrorHandler("Not a member of this room", 400));
    }

    await SupabaseService.update("room_members", memberRecord.id, {
      presence: presenceDates, // Store as JSON array
    });

    // Enhance room with members
    const presenceAllMembers =
      await SupabaseService.selectAllRecords("room_members");
    const presenceMembers = (presenceAllMembers || []).filter(
      (m) => m.room_id === room.id,
    );
    const enrichedMembers = [];
    for (let member of presenceMembers) {
      const user = await SupabaseService.findUserById(member.user_id);
      enrichedMembers.push({
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    }
    room.members = enrichedMembers;
    normalizeRoom(room);

    res.status(200).json({
      success: true,
      message: "Presence saved successfully",
      room,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// CLEAR ALL PRESENCE FOR ALL MEMBERS IN ROOM
// ============================================================
router.put("/:id/clear-presence", isAuthenticated, async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Check authorization
    if (
      room.created_by &&
      room.created_by !== req.user.id &&
      !req.user.role?.includes("admin")
    ) {
      return next(new ErrorHandler("Forbidden", 403));
    }

    // Get all members and clear their presence
    const allMembers = await SupabaseService.selectAllRecords("room_members");
    const members = (allMembers || []).filter(
      (m) => m.room_id === req.params.id,
    );

    for (let member of members) {
      await SupabaseService.update("room_members", member.id, {
        presence: [], // Clear presence array
      });
    }

    // Enhance room with members
    const clearPresenceAllMembers =
      await SupabaseService.selectAllRecords("room_members");
    const clearPresenceMembers = (clearPresenceAllMembers || []).filter(
      (m) => m.room_id === room.id,
    );
    const enrichedMembers = [];
    for (let member of clearPresenceMembers) {
      const user = await SupabaseService.findUserById(member.user_id);
      enrichedMembers.push({
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    }
    room.members = enrichedMembers;
    normalizeRoom(room);

    res.status(200).json({
      success: true,
      message: "Presence cleared for all members",
      room,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// EXPORT ROOM BILLING AS PDF
// ============================================================
router.get("/:id/export", isAuthenticated, async (req, res, next) => {
  try {
    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    const exportAllMembers =
      await SupabaseService.selectAllRecords("room_members");
    const members = (exportAllMembers || []).filter(
      (m) => m.room_id === room.id,
    );
    const enrichedMembers = [];
    for (let member of members) {
      const user = await SupabaseService.findUserById(member.user_id);
      enrichedMembers.push({
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      });
    }
    room.members = enrichedMembers;
    normalizeRoom(room);

    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 40, left: 40, right: 40, bottom: 60 },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="bill-${room.name.replace(/\s+/g, "-")}-${Date.now()}.pdf"`,
    );
    doc.pipe(res);

    // ===== HEADER SECTION =====
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .fillColor("#000000")
      .text(room.name, { align: "center" });
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666666")
      .text("BILLING STATEMENT", { align: "center" });
    doc.fontSize(8).fillColor("#999999");
    doc.text("━".repeat(80), { align: "center" });
    doc.moveDown(0.3);

    // Receipt Header Info
    doc.fontSize(8).font("Helvetica").fillColor("#333333");
    doc.text(`Room Code: ${room.code}`, 40);

    if (room.start && room.end) {
      const startDate = new Date(room.start).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const endDate = new Date(room.end).toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      doc.text(`Billing Period: ${startDate} to ${endDate}`);
    }
    doc.text(
      `Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
    );
    doc.moveDown(0.5);
    doc
      .fontSize(8)
      .fillColor("#999999")
      .text("━".repeat(80), { align: "center" });
    doc.moveDown(0.8);

    // ===== WATER BILL SECTION =====
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .fillColor("#1a1a1a")
      .text("💧 WATER CHARGES");
    doc.fontSize(8).fillColor("#999999").text("─".repeat(80));
    doc.moveDown(0.3);

    // Water table header
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
    doc.rect(40, doc.y, 475, 16).fill("#2c3e50");
    const waterHeaderY = doc.y + 3;
    doc.text("Member", 45, waterHeaderY, { width: 200 });
    doc.text("Days", 245, waterHeaderY, { width: 80, align: "center" });
    doc.text("Rate/Day", 325, waterHeaderY, { width: 70, align: "center" });
    doc.text("Amount", 395, waterHeaderY, { width: 110, align: "right" });
    doc.moveDown(1.1);

    // Water bill data
    doc.fontSize(8).font("Helvetica").fillColor("#000000");
    let waterTotal = 0;

    room.members.forEach((member, idx) => {
      const memberName = member.user?.name || "Unknown";
      const isCurrentUser = member.user_id === req.user.id;
      const displayName = isCurrentUser ? `${memberName} (You)` : memberName;
      const daysPresent = member.presence ? member.presence.length : 0;
      const rate = 5;
      const amount = daysPresent * rate;
      waterTotal += amount;

      if (isCurrentUser) {
        doc.rect(40, doc.y, 475, 14).fill("#fff9e6");
      } else if (idx % 2 === 0) {
        doc.rect(40, doc.y, 475, 14).fill("#fafafa");
      }

      const rowY = doc.y + 1;
      doc.fillColor(isCurrentUser ? "#d4860d" : "#000000");
      doc.font("Helvetica");
      if (isCurrentUser) doc.font("Helvetica-Bold");
      doc.text(displayName, 45, rowY, { width: 200 });
      doc.fillColor("#000000").font("Helvetica");
      doc.text(daysPresent.toString(), 245, rowY, {
        width: 80,
        align: "center",
      });
      doc.text(`₱${rate}`, 325, rowY, { width: 70, align: "center" });
      doc.text(`₱${amount}`, 395, rowY, { width: 110, align: "right" });
      doc.moveDown(0.95);
    });

    // Water total line
    doc.moveTo(40, doc.y).lineTo(515, doc.y).stroke("#cccccc");
    doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000");
    const waterTotalY = doc.y + 3;
    doc.text("SUBTOTAL (Water)", 45, waterTotalY, { width: 200 });
    doc.text(`₱${waterTotal}`, 395, waterTotalY, {
      width: 110,
      align: "right",
    });
    doc.moveDown(1.2);

    // ===== ELECTRICITY BILL SECTION =====
    if (room.electricity !== undefined || room.previous_reading !== undefined) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text("⚡ ELECTRICITY CHARGES");
      doc.fontSize(8).fillColor("#999999").text("─".repeat(80));
      doc.moveDown(0.3);

      const prevReading = room.previous_reading || 0;
      const currReading = room.current_reading || 0;
      const kwhUsed = currReading - prevReading;
      const ratePerKwh = 16;
      const totalElecBill = kwhUsed * ratePerKwh;

      doc.fontSize(8).font("Helvetica").fillColor("#333333");
      doc.text(`Previous Reading:  ${prevReading} kWh`);
      doc.text(`Current Reading:   ${currReading} kWh`);
      doc.text(`Consumption:       ${kwhUsed} kWh @ ₱${ratePerKwh}/kWh`);
      doc.moveDown(0.3);

      // Electricity total
      doc.moveTo(40, doc.y).lineTo(515, doc.y).stroke("#cccccc");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000");
      const elecTotalY = doc.y + 3;
      doc.text("SUBTOTAL (Electricity)", 45, elecTotalY, { width: 200 });
      doc.text(`₱${totalElecBill}`, 395, elecTotalY, {
        width: 110,
        align: "right",
      });
      doc.moveDown(0.8);

      // Payor breakdown
      const payors = room.members.filter((m) => m.is_payer !== false);
      if (payors.length > 0) {
        const perPayorElec = Math.round(totalElecBill / payors.length);
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("#333333")
          .text(`Per Payor Share (÷${payors.length}):`);
        doc.fontSize(8).font("Helvetica").fillColor("#555555");
        payors.forEach((payor) => {
          const payorName = payor.user?.name || "Unknown";
          const isCurrentUser = payor.user_id === req.user.id;
          const displayName = isCurrentUser ? `${payorName} (You)` : payorName;
          const amountStr = `₱${perPayorElec}`;
          const dotsNeeded = Math.max(
            0,
            50 - displayName.length - amountStr.length,
          );
          const dots = ".".repeat(dotsNeeded);
          const fullLine = `${displayName} ${dots} ${amountStr}`;
          doc.fillColor(isCurrentUser ? "#d4860d" : "#555555");
          if (isCurrentUser) doc.font("Helvetica-Bold");
          doc.text(fullLine);
          doc.font("Helvetica");
          doc.moveDown(0.4);
        });
      }
      doc.moveDown(0.8);
    }

    // ===== RENT BILL SECTION =====
    if (room.rent) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text("🏠 RENT CHARGES");
      doc.fontSize(8).fillColor("#999999").text("─".repeat(80));
      doc.moveDown(0.3);

      doc.fontSize(8).font("Helvetica").fillColor("#333333");
      doc.text(`Total Apartment Rate: ₱${room.rent}`);
      doc.moveDown(0.3);

      // Rent total
      doc.moveTo(40, doc.y).lineTo(515, doc.y).stroke("#cccccc");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000");
      const rentTotalY = doc.y + 3;
      doc.text("SUBTOTAL (Rent)", 45, rentTotalY, { width: 200 });
      doc.text(`₱${room.rent}`, 395, rentTotalY, {
        width: 110,
        align: "right",
      });
      doc.moveDown(0.8);

      // Payor breakdown
      const payors = room.members.filter((m) => m.is_payer !== false);
      if (payors.length > 0) {
        const perPayorRent = Math.round(room.rent / payors.length);
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("#333333")
          .text(`Per Payor Share (÷${payors.length}):`);
        doc.fontSize(8).font("Helvetica").fillColor("#555555");
        payors.forEach((payor) => {
          const payorName = payor.user?.name || "Unknown";
          const isCurrentUser = payor.user_id === req.user.id;
          const displayName = isCurrentUser ? `${payorName} (You)` : payorName;
          const amountStr = `₱${perPayorRent}`;
          const dotsNeeded = Math.max(
            0,
            50 - displayName.length - amountStr.length,
          );
          const dots = ".".repeat(dotsNeeded);
          const fullLine = `${displayName} ${dots} ${amountStr}`;
          doc.fillColor(isCurrentUser ? "#d4860d" : "#555555");
          if (isCurrentUser) doc.font("Helvetica-Bold");
          doc.text(fullLine);
          doc.font("Helvetica");
          doc.moveDown(0.4);
        });
      }
      doc.moveDown(1);
    }

    // ===== SUMMARY SECTION =====
    doc
      .fontSize(8)
      .fillColor("#999999")
      .text("━".repeat(80), { align: "center" });
    doc.moveDown(0.5);

    const totalAllBills =
      waterTotal +
      ((room.current_reading || 0) - (room.previous_reading || 0)) * 16 +
      (room.rent || 0);

    doc.fontSize(10).font("Helvetica-Bold").fillColor("#000000");
    doc.text("STATEMENT FOR THIS PERIOD", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(9).font("Helvetica-Bold");
    doc.text(`TOTAL DUE: ₱${Math.round(totalAllBills)}`, 45, doc.y, {
      width: 400,
      align: "left",
    });
    doc.moveDown(1);

    // ===== FOOTER SECTION =====
    doc.fontSize(7).font("Helvetica").fillColor("#999999");
    doc.text("━".repeat(80), { align: "center" });
    doc.moveDown(0.3);

    doc.fontSize(7).font("Helvetica").fillColor("#666666");
    doc.text(
      "Thank you for your payment. Please settle your balance by the due date.",
      { align: "center" },
    );
    doc.text("For inquiries, please contact the property manager.", {
      align: "center",
    });
    doc.moveDown(0.2);

    doc.fontSize(6).font("Helvetica").fillColor("#aaaaaa");
    doc.text("This is a computer-generated statement. No signature required.", {
      align: "center",
    });
    doc.text(
      `Report ID: ${room.id
        .toString()
        .substring(0, 8)
        .toUpperCase()} | Generated: ${new Date().toISOString()}`,
      { align: "center" },
    );

    doc.end();
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

module.exports = router;
