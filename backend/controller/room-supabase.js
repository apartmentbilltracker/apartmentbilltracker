const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const { isAuthenticated } = require("../middleware/auth");
const ErrorHandler = require("../utils/ErrorHandler");
const createNotification = require("../utils/createNotification");
const sendMail = require("../utils/sendMail");
const WelcomeRoomContent = require("../utils/WelcomeRoomContent");
const PDFDocument = require("pdfkit");
const { enrichBillingCycle } = require("../utils/enrichBillingCycle");
const { checkAndAutoCloseCycle } = require("../utils/autoCloseCycle");
const cache = require("../utils/MemoryCache");

// Invalidate room caches on any mutating request
router.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    // Use response hook to invalidate AFTER successful mutation
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode < 400) {
        cache.invalidatePrefix("roomlist:");
        cache.invalidatePrefix("browse:");
        cache.invalidatePrefix("room_members:");
        cache.invalidatePrefix("room:");
        cache.del("admin_all_rooms");
      }
      return originalJson(body);
    };
  }
  next();
});

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
  // Location fields (lat/lng stored as floats, address as text)
  if (room.latitude != null) room.latitude = parseFloat(room.latitude);
  if (room.longitude != null) room.longitude = parseFloat(room.longitude);
  // Keep address as-is
  // Parse amenities & house_rules from JSON if stored as string
  if (typeof room.amenities === "string") {
    try {
      room.amenities = JSON.parse(room.amenities);
    } catch {
      room.amenities = [];
    }
  }
  if (typeof room.house_rules === "string") {
    try {
      room.house_rules = JSON.parse(room.house_rules);
    } catch {
      room.house_rules = [];
    }
  }
  room.amenities = room.amenities || [];
  room.houseRules = room.house_rules || [];
  // Parse photos from JSON if stored as string
  if (typeof room.photos === "string") {
    try {
      room.photos = JSON.parse(room.photos);
    } catch {
      room.photos = [];
    }
  }
  room.photos = room.photos || [];
  // Chat enabled flag
  room.chatEnabled = !!room.chat_enabled;
  return room;
};

// Helper: fetch approved members for a room with user details (cached 30s)
const enrichRoomMembers = async (roomId) => {
  return cache.getOrSet(
    `room_members:${roomId}`,
    async () => {
      const members = await SupabaseService.getRoomMembers(roomId);
      const userMap = await SupabaseService.findUsersByIds(
        (members || []).map((m) => m.user_id),
      );
      return (members || []).map((member) => {
        const user = userMap.get(member.user_id);
        return {
          ...normalizeMember(member),
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
              }
            : null,
        };
      });
    },
    30,
  );
};

// ============================================================
// CREATE ROOM
// ============================================================
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const {
      name,
      description,
      latitude,
      longitude,
      address,
      amenities,
      house_rules,
      photos,
    } = req.body;
    if (!name) return next(new ErrorHandler("Name is required", 400));

    const code = `${name.replace(/\s+/g, "-").toLowerCase()}-${Date.now().toString().slice(-5)}`;

    const roomData = {
      name,
      code,
      description: description || "",
      created_by: req.user?.id || null,
    };
    if (latitude != null && longitude != null) {
      roomData.latitude = parseFloat(latitude);
      roomData.longitude = parseFloat(longitude);
    }
    if (address) roomData.address = address;
    if (amenities)
      roomData.amenities = JSON.stringify(
        Array.isArray(amenities) ? amenities : [],
      );
    if (house_rules)
      roomData.house_rules = JSON.stringify(
        Array.isArray(house_rules) ? house_rules : [],
      );
    if (photos)
      roomData.photos = JSON.stringify(Array.isArray(photos) ? photos : []);

    const room = await SupabaseService.createRoom(roomData);
    normalizeRoom(room);

    res.status(201).json({ success: true, room });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// LIST ROOMS - Admin sees all, hosts see rooms they created, users see only their rooms
// ============================================================
router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    let rooms = [];
    const role = (req.user.role || "").toLowerCase();
    const userId = req.user.id;

    // Cache room list for 30 seconds per user
    const cacheKey = `roomlist:${userId}:${role}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, rooms: cached });
    }

    if (role === "admin") {
      rooms = await SupabaseService.selectAllRecords("rooms");
    } else if (role === "host") {
      // Hosts see rooms they created
      rooms = await SupabaseService.getRoomsByUser(req.user.id);
    } else {
      const userRooms = await SupabaseService.getUserRooms(req.user.id);
      rooms = userRooms || [];
    }

    // Parallel member enrichment + billing cycles for all rooms
    const [enrichedMembersPerRoom, billingCyclesPerRoom] = await Promise.all([
      Promise.all(rooms.map((r) => enrichRoomMembers(r.id))),
      Promise.all(
        rooms.map((r) => SupabaseService.getActiveBillingCycle(r.id)),
      ),
    ]);
    for (let i = 0; i < rooms.length; i++) {
      rooms[i].members = enrichedMembersPerRoom[i];
      normalizeRoom(rooms[i]);

      // Add billing info for dropdown display
      const activeCycle = billingCyclesPerRoom[i];
      if (activeCycle) {
        rooms[i].currentCycleId = activeCycle.id;
        rooms[i].cycleStatus = activeCycle.status || "active";
        rooms[i].billing = {
          start: activeCycle.start_date,
          end: activeCycle.end_date,
          rent: activeCycle.rent || 0,
          electricity: activeCycle.electricity || 0,
          water: computeDynamicWater(
            rooms[i].members,
            activeCycle.start_date,
            activeCycle.end_date,
            activeCycle.water_bill_amount || 0,
          ),
          internet: activeCycle.internet || 0,
          previousReading: activeCycle.previous_meter_reading ?? null,
          currentReading: activeCycle.current_meter_reading ?? null,
        };
      } else {
        rooms[i].currentCycleId = null;
        rooms[i].cycleStatus = null;
      }
    }

    cache.set(cacheKey, rooms, 30);
    res.status(200).json({ success: true, rooms });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// LIST ROOMS FOR CLIENT VIEW (respects membership only)
// ============================================================
router.get("/client/my-rooms", isAuthenticated, async (req, res, next) => {
  try {
    const userRooms = await SupabaseService.getUserRooms(req.user.id);
    const rooms = userRooms || [];

    // ── Parallel: fetch members + billing cycles for ALL rooms at once ──
    const [membersPerRoom, cyclesPerRoom] = await Promise.all([
      Promise.all(rooms.map((r) => SupabaseService.getRoomMembers(r.id))),
      Promise.all(
        rooms.map((r) => SupabaseService.getActiveBillingCycle(r.id)),
      ),
    ]);

    // Collect all unique user IDs across all rooms for a single batch lookup
    const allUserIds = new Set();
    membersPerRoom.forEach((members) =>
      (members || []).forEach((m) => allUserIds.add(m.user_id)),
    );

    // ── Parallel: batch user lookup + payments + closed cycles (all independent) ──
    const paymentPromises = cyclesPerRoom.map((cycle, i) =>
      cycle
        ? SupabaseService.getPaymentsForCycle(
            rooms[i].id,
            cycle.start_date,
            cycle.end_date,
          )
        : Promise.resolve(null),
    );
    const closedCyclePromises = cyclesPerRoom.map((cycle, i) =>
      !cycle
        ? SupabaseService.getRoomBillingCycles(rooms[i].id)
        : Promise.resolve(null),
    );

    const [userMap, paymentsPerRoom, allCyclesPerRoom] = await Promise.all([
      SupabaseService.findUsersByIds([...allUserIds]),
      Promise.all(paymentPromises),
      Promise.all(closedCyclePromises),
    ]);

    // ── Assemble room data (no more awaits, pure in-memory) ──
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const members = membersPerRoom[i] || [];

      // Enrich members from batch user map
      room.members = members.map((member) => {
        const user = userMap.get(member.user_id);
        return {
          ...normalizeMember(member),
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
              }
            : null,
        };
      });
      normalizeRoom(room);

      const activeCycle = cyclesPerRoom[i];
      if (activeCycle) {
        room.currentCycleId = activeCycle.id;
        room.cycleStatus = "active";
        room.billing = {
          start: activeCycle.start_date,
          end: activeCycle.end_date,
          rent: activeCycle.rent || 0,
          electricity: activeCycle.electricity || 0,
          water: computeDynamicWater(
            membersPerRoom[i],
            activeCycle.start_date,
            activeCycle.end_date,
            activeCycle.water_bill_amount || 0,
          ),
          internet: activeCycle.internet || 0,
          previousReading: activeCycle.previous_meter_reading ?? null,
          currentReading: activeCycle.current_meter_reading ?? null,
        };

        // Build memberPayments
        const payments = paymentsPerRoom[i] || [];
        const completedPayments = payments.filter(
          (p) => p.status === "completed" || p.status === "verified",
        );
        const payerMembers = members.filter((m) => m.is_payer);
        room.memberPayments = payerMembers.map((member) => {
          const mp = completedPayments.filter(
            (p) => p.paid_by === member.user_id,
          );
          const isTotalPaid = mp.some((p) => p.bill_type === "total");
          const rentPaid =
            isTotalPaid || mp.some((p) => p.bill_type === "rent");
          const elecPaid =
            isTotalPaid || mp.some((p) => p.bill_type === "electricity");
          const waterPaid =
            isTotalPaid || mp.some((p) => p.bill_type === "water");
          const internetPaid =
            isTotalPaid || mp.some((p) => p.bill_type === "internet");
          return {
            member: member.user_id,
            memberName: member.name,
            isPayer: member.is_payer,
            rentStatus: rentPaid ? "paid" : "unpaid",
            electricityStatus: elecPaid ? "paid" : "unpaid",
            waterStatus: waterPaid ? "paid" : "unpaid",
            internetStatus: internetPaid ? "paid" : "unpaid",
            allPaid: rentPaid && elecPaid && waterPaid && internetPaid,
          };
        });

        // Auto-close if all payors paid
        if (
          room.memberPayments.length > 0 &&
          room.memberPayments.every((mp) => mp.allPaid)
        ) {
          try {
            await SupabaseService.update("billing_cycles", activeCycle.id, {
              status: "completed",
              closed_at: new Date(),
            });
            room.cycleStatus = "completed";
          } catch (_) {
            /* ignore auto-close errors */
          }
        }
      } else {
        // No active cycle — find most recent closed cycle
        const allCycles = allCyclesPerRoom[i] || [];
        const closedCycle = allCycles
          .filter((c) => c.status === "completed" || c.status === "closed")
          .sort(
            (a, b) =>
              new Date(b.closed_at || b.end_date) -
              new Date(a.closed_at || a.end_date),
          )[0];
        if (closedCycle) {
          room.cycleStatus = "completed";
          room.closedCycleId = closedCycle.id;
          room.billing = {
            start: closedCycle.start_date,
            end: closedCycle.end_date,
            rent: closedCycle.rent || 0,
            electricity: closedCycle.electricity || 0,
            water: closedCycle.water_bill_amount || 0,
            internet: closedCycle.internet || 0,
            previousReading: closedCycle.previous_meter_reading ?? null,
            currentReading: closedCycle.current_meter_reading ?? null,
          };
          const payerMembers = members.filter((m) => m.is_payer);
          room.memberPayments = payerMembers.map((member) => ({
            member: member.user_id,
            memberName: member.name,
            isPayer: member.is_payer,
            rentStatus: "paid",
            electricityStatus: "paid",
            waterStatus: "paid",
            internetStatus: "paid",
            allPaid: true,
          }));
        }
      }
    }

    res.status(200).json({ success: true, rooms });
  } catch (error) {
    console.error("Error in GET /client/my-rooms:", error);
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// ADMIN: ALL ROOMS OVERVIEW (with member counts & owner info)
// ============================================================

/**
 * Compute the total water bill for a billing cycle.
 * If the cycle already has a stored water_bill_amount > 0, use that (admin set it).
 * Otherwise compute dynamically from member presence data (₱5/day).
 */
function computeDynamicWater(
  members,
  cycleStartDate,
  cycleEndDate,
  storedAmount,
) {
  if (storedAmount > 0) return storedAmount;
  const start = new Date(cycleStartDate);
  const end = new Date(cycleEndDate);
  const total = (members || []).reduce((sum, m) => {
    const presenceArr = Array.isArray(m.presence) ? m.presence : [];
    const days = presenceArr.filter((d) => {
      const day = new Date(d);
      return day >= start && day <= end;
    }).length;
    return sum + days * 5;
  }, 0);
  return Math.round(total * 100) / 100;
}

router.get("/admin/all", isAuthenticated, async (req, res, next) => {
  try {
    const requester = await SupabaseService.findUserById(req.user.id);
    if (!requester || !requester.is_admin) {
      return next(new ErrorHandler("Admin access required", 403));
    }

    // Cache admin room list for 30 seconds
    const cacheKey = `admin_all_rooms`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, rooms: cached });
    }

    const allRooms = await SupabaseService.selectAllRecords("rooms");

    // Parallel: members + billing cycles + creator IDs for all rooms
    const creatorIds = [
      ...new Set((allRooms || []).map((r) => r.created_by).filter(Boolean)),
    ];
    const [membersPerRoom, cyclesPerRoom, creatorMap] = await Promise.all([
      Promise.all(
        (allRooms || []).map((r) => SupabaseService.getRoomMembers(r.id)),
      ),
      Promise.all(
        (allRooms || []).map((r) =>
          SupabaseService.getActiveBillingCycle(r.id),
        ),
      ),
      SupabaseService.findUsersByIds(creatorIds),
    ]);

    // Batch user lookup for member emails
    const allMemberUserIds = new Set();
    membersPerRoom.forEach((members) =>
      (members || []).forEach((m) => allMemberUserIds.add(m.user_id)),
    );
    const memberUserMap = await SupabaseService.findUsersByIds([
      ...allMemberUserIds,
    ]);

    const rooms = (allRooms || []).map((room, i) => {
      const members = membersPerRoom[i] || [];
      const creator = creatorMap.get(room.created_by);
      const activeCycle = cyclesPerRoom[i];

      // Normalize location & amenities/house_rules from raw DB row
      normalizeRoom(room);

      return {
        id: room.id,
        name: room.name,
        code: room.code,
        description: room.description,
        created_at: room.created_at,
        created_by: room.created_by,
        latitude: room.latitude ?? null,
        longitude: room.longitude ?? null,
        address: room.address || null,
        amenities: room.amenities || [],
        house_rules: room.house_rules || [],
        houseRules: room.houseRules || [],
        photos: room.photos || [],
        memberCount: members.length,
        payerCount: members.filter((m) => m.is_payer).length,
        creator: creator
          ? {
              id: creator.id,
              name: creator.name,
              email: creator.email,
              avatar: creator.avatar,
            }
          : null,
        billingCycle: activeCycle
          ? {
              id: activeCycle.id,
              status: activeCycle.status || "active",
              startDate: activeCycle.start_date,
              endDate: activeCycle.end_date,
              rent: activeCycle.rent || 0,
              electricity: activeCycle.electricity || 0,
              water: computeDynamicWater(
                members,
                activeCycle.start_date,
                activeCycle.end_date,
                activeCycle.water_bill_amount || 0,
              ),
              internet: activeCycle.internet || 0,
            }
          : null,
        members: members.map((m) => {
          const user = memberUserMap.get(m.user_id);
          return {
            id: m.id,
            user_id: m.user_id,
            name: user?.name || m.name || "Unknown",
            email: user?.email || null,
            avatar: user?.avatar || null,
            is_payer: m.is_payer,
            status: m.status || "approved",
            joined_at: m.joined_at,
          };
        }),
      };
    });

    cache.set(cacheKey, rooms, 30);
    res.status(200).json({ success: true, rooms });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// ADMIN: REMOVE MEMBER FROM ROOM
// ============================================================
router.delete(
  "/admin/:roomId/members/:memberId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { roomId, memberId } = req.params;
      const room = await SupabaseService.findRoomById(roomId);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      await SupabaseService.delete("room_members", memberId);

      res.status(200).json({
        success: true,
        message: "Member removed successfully",
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// ADMIN: TOGGLE PAYER STATUS
// ============================================================
router.put(
  "/admin/:roomId/members/:memberId/toggle-payer",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const requester = await SupabaseService.findUserById(req.user.id);
      if (!requester || !requester.is_admin) {
        return next(new ErrorHandler("Admin access required", 403));
      }

      const { roomId, memberId } = req.params;
      const room = await SupabaseService.findRoomById(roomId);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      // Get current member
      const members = await SupabaseService.getRoomMembers(roomId);
      const member = (members || []).find((m) => m.id === memberId);
      if (!member) return next(new ErrorHandler("Member not found", 404));

      const newPayerStatus = !member.is_payer;
      await SupabaseService.update("room_members", memberId, {
        is_payer: newPayerStatus,
      });

      res.status(200).json({
        success: true,
        message: `Member is now a ${newPayerStatus ? "payer" : "non-payer"}`,
        isPayer: newPayerStatus,
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// ADMIN: DELETE ROOM
// ============================================================
router.delete("/admin/:roomId", isAuthenticated, async (req, res, next) => {
  try {
    const requester = await SupabaseService.findUserById(req.user.id);
    if (!requester || !requester.is_admin) {
      return next(new ErrorHandler("Admin access required", 403));
    }

    const { roomId } = req.params;
    const room = await SupabaseService.findRoomById(roomId);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Delete all related data first: members, billing cycles, payments
    const [members, cycles] = await Promise.all([
      SupabaseService.getRoomMembers(roomId),
      SupabaseService.getRoomBillingCycles(roomId),
    ]);

    // Delete members
    if (members?.length) {
      await Promise.all(
        members.map((m) => SupabaseService.delete("room_members", m.id)),
      );
    }

    // Delete billing cycles
    if (cycles?.length) {
      await Promise.all(
        cycles.map((c) => SupabaseService.delete("billing_cycles", c.id)),
      );
    }

    // Delete the room itself
    await SupabaseService.delete("rooms", roomId);

    res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// BROWSE ALL ROOMS (for joining)
// ============================================================
router.get("/browse/available", isAuthenticated, async (req, res, next) => {
  try {
    // Cache the full rooms + members lists for 60 seconds (shared across users)
    const [rooms, allMembers] = await Promise.all([
      cache.getOrSet(
        "browse:rooms",
        () => SupabaseService.selectAllRecords("rooms"),
        60,
      ),
      cache.getOrSet(
        "browse:members",
        () => SupabaseService.selectAllRecords("room_members"),
        60,
      ),
    ]);

    // User-specific: pending memberships (lightweight, not cached)
    const userMemberships = await SupabaseService.selectAll(
      "room_members",
      "user_id",
      req.user.id,
      "room_id, status",
      "joined_at",
    );

    const userPendingRoomIds = (userMemberships || [])
      .filter((m) => m.status === "pending")
      .map((m) => m.room_id);

    // Build member count map from all members (avoids N+1 enrichRoomMembers queries)
    const memberCountMap = {};
    (allMembers || []).forEach((m) => {
      if (m.status === "approved" || m.status === "active") {
        memberCountMap[m.room_id] = (memberCountMap[m.room_id] || 0) + 1;
      }
    });

    // Lightweight room list — only name, description, member count (no full enrichment)
    const roomList = (Array.isArray(rooms) ? rooms : []).map((r) => {
      normalizeRoom(r);
      r.members = Array.from({ length: memberCountMap[r.id] || 0 }, () => ({})); // stub array for .length compat
      r.memberCount = memberCountMap[r.id] || 0;
      return r;
    });

    res.status(200).json({
      success: true,
      rooms: roomList,
      pendingRoomIds: userPendingRoomIds,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET SINGLE ROOM
// ============================================================
router.get("/:id", async (req, res, next) => {
  try {
    // Parallel: room data + members + billing cycles
    const [room, members, roomBillingCycles] = await Promise.all([
      SupabaseService.findRoomById(req.params.id),
      SupabaseService.getRoomMembers(req.params.id),
      SupabaseService.getRoomBillingCycles(req.params.id),
    ]);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Batch user lookup instead of N sequential queries
    const memberUserIds = (members || []).map((m) => m.user_id);
    const userMap = await SupabaseService.findUsersByIds(memberUserIds);

    room.members = (members || []).map((member) => {
      const user = userMap.get(member.user_id);
      return {
        ...normalizeMember(member),
        user: user
          ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            }
          : null,
      };
    });
    normalizeRoom(room);

    const activeCycle = (roomBillingCycles || []).find(
      (c) => c.status === "active",
    );
    if (activeCycle) {
      room.currentCycleId = activeCycle.id;
      room.cycleStatus = "active";
      room.billing = {
        start: activeCycle.start_date,
        end: activeCycle.end_date,
        rent: activeCycle.rent || 0,
        electricity: activeCycle.electricity || 0,
        water: computeDynamicWater(
          members,
          activeCycle.start_date,
          activeCycle.end_date,
          activeCycle.water_bill_amount || 0,
        ),
        internet: activeCycle.internet || 0,
        previousReading: activeCycle.previous_meter_reading ?? null,
        currentReading: activeCycle.current_meter_reading ?? null,
      };

      // Fetch payments for active cycle
      const payments =
        (await SupabaseService.getPaymentsForCycle(
          room.id,
          activeCycle.start_date,
          activeCycle.end_date,
        )) || [];
      const completedPayments = payments.filter(
        (p) => p.status === "completed" || p.status === "verified",
      );
      const payerMembers = (members || []).filter((m) => m.is_payer);

      room.memberPayments = payerMembers.map((member) => {
        const mp = completedPayments.filter(
          (p) => p.paid_by === member.user_id,
        );
        const isTotalPaid = mp.some((p) => p.bill_type === "total");
        const rentPaid = isTotalPaid || mp.some((p) => p.bill_type === "rent");
        const elecPaid =
          isTotalPaid || mp.some((p) => p.bill_type === "electricity");
        const waterPaid =
          isTotalPaid || mp.some((p) => p.bill_type === "water");
        const internetPaid =
          isTotalPaid || mp.some((p) => p.bill_type === "internet");
        return {
          member: member.user_id,
          memberName: member.name,
          isPayer: member.is_payer,
          rentStatus: rentPaid ? "paid" : "unpaid",
          electricityStatus: elecPaid ? "paid" : "unpaid",
          waterStatus: waterPaid ? "paid" : "unpaid",
          internetStatus: internetPaid ? "paid" : "unpaid",
          allPaid: rentPaid && elecPaid && waterPaid && internetPaid,
        };
      });

      // Auto-close if all payors paid
      if (
        room.memberPayments.length > 0 &&
        room.memberPayments.every((mp) => mp.allPaid)
      ) {
        try {
          await SupabaseService.update("billing_cycles", activeCycle.id, {
            status: "completed",
            closed_at: new Date(),
          });
          room.cycleStatus = "completed";
        } catch (_) {
          /* ignore auto-close errors */
        }
      }
    } else {
      // Most recently completed cycle
      const closedCycle = (roomBillingCycles || [])
        .filter((c) => c.status === "completed" || c.status === "closed")
        .sort(
          (a, b) =>
            new Date(b.closed_at || b.end_date) -
            new Date(a.closed_at || a.end_date),
        )[0];
      if (closedCycle) {
        room.cycleStatus = "completed";
        room.closedCycleId = closedCycle.id;
        room.billing = {
          start: closedCycle.start_date,
          end: closedCycle.end_date,
          rent: closedCycle.rent || 0,
          electricity: closedCycle.electricity || 0,
          water: closedCycle.water_bill_amount || 0,
          internet: closedCycle.internet || 0,
          previousReading: closedCycle.previous_meter_reading ?? null,
          currentReading: closedCycle.current_meter_reading ?? null,
        };
        const payerMembers = (members || []).filter((m) => m.is_payer);
        room.memberPayments = payerMembers.map((member) => ({
          member: member.user_id,
          memberName: member.name,
          isPayer: member.is_payer,
          rentStatus: "paid",
          electricityStatus: "paid",
          waterStatus: "paid",
          internetStatus: "paid",
          allPaid: true,
        }));
      }
    }

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

    // Check if already a member or has pending request (filtered query, not full table scan)
    const roomMemberships = await SupabaseService.selectAll(
      "room_members",
      "room_id",
      req.params.id,
      "*",
      "joined_at",
    );
    const existingMember = (roomMemberships || []).find(
      (m) => m.user_id === req.user.id,
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
      room.members = await enrichRoomMembers(room.id);
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
    const {
      name,
      description,
      maxOccupancy,
      latitude,
      longitude,
      address,
      amenities,
      house_rules,
      photos,
    } = req.body;
    if (!name) return next(new ErrorHandler("Name is required", 400));

    const room = await SupabaseService.findRoomById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    const updateData = {
      name: name.trim(),
      description: description ? description.trim() : room.description,
      max_occupancy: maxOccupancy ? Number(maxOccupancy) : room.max_occupancy,
    };
    if (latitude != null && longitude != null) {
      updateData.latitude = parseFloat(latitude);
      updateData.longitude = parseFloat(longitude);
    }
    if (address !== undefined) updateData.address = address || null;
    if (amenities !== undefined)
      updateData.amenities = JSON.stringify(
        Array.isArray(amenities) ? amenities : [],
      );
    if (house_rules !== undefined)
      updateData.house_rules = JSON.stringify(
        Array.isArray(house_rules) ? house_rules : [],
      );
    if (photos !== undefined)
      updateData.photos = JSON.stringify(Array.isArray(photos) ? photos : []);

    // Update room
    const updatedRoom = await SupabaseService.update(
      "rooms",
      req.params.id,
      updateData,
    );

    // Enhance with member data
    updatedRoom.members = await enrichRoomMembers(updatedRoom.id);
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

      let member = await SupabaseService.selectByColumn(
        "room_members",
        "id",
        req.params.memberId,
      );

      // Defensive: normalize result shapes (Supabase may occasionally return arrays)
      if (Array.isArray(member)) member = member[0];

      if (!member) {
        return next(new ErrorHandler("Member not found in room", 404));
      }

      const oldPayorStatus = member.is_payer;
      const adminName = req.user?.name || "Administrator";

      // Update member – accept both camelCase (mobile) and snake_case keys
      const allowedUpdates = { is_payer: "is_payer", isPayer: "is_payer" };
      const updateData = {};
      Object.keys(req.body).forEach((field) => {
        if (allowedUpdates[field]) {
          updateData[allowedUpdates[field]] = req.body[field];
        }
      });

      if (Object.keys(updateData).length === 0) {
        return next(new ErrorHandler("No valid fields to update", 400));
      }

      let updatedMember;
      try {
        updatedMember = await SupabaseService.update(
          "room_members",
          req.params.memberId,
          updateData,
        );
      } catch (err) {
        console.error("Error updating room member:", err.message || err);
        return next(
          new ErrorHandler(err.message || "Failed to update member", 500),
        );
      }

      // Normalize update result
      if (Array.isArray(updatedMember)) updatedMember = updatedMember[0];
      if (!updatedMember) {
        return next(new ErrorHandler("Failed to update member", 500));
      }

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

      const memberName =
        (memberUser && memberUser.name) || member.name || "there";

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
    room.members = await enrichRoomMembers(room.id);
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

    // Check if user is a member (filtered query, not full table scan)
    const members = await SupabaseService.getRoomMembers(req.params.id);
    const isMember = (members || []).some((m) => m.user_id === req.user.id);

    if (!isMember && room.created_by !== req.user.id) {
      return next(new ErrorHandler("Forbidden", 403));
    }

    // Get billing cycles for this room and enrich with water/total
    const billingCycles = await SupabaseService.getRoomBillingCycles(
      req.params.id,
    );

    // Enrich each cycle so water_bill_amount and total_billed_amount are accurate
    const roomMembers = await SupabaseService.getRoomMembers(req.params.id);
    for (const cycle of billingCycles || []) {
      await enrichBillingCycle(cycle, roomMembers);
    }

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

    // Update presence for the member (filtered query per room, not full table scan)
    const roomMembers = await SupabaseService.selectAll(
      "room_members",
      "room_id",
      req.params.id,
      "*",
      "joined_at",
    );
    const memberRecord = (roomMembers || []).find(
      (m) => m.user_id === req.user.id,
    );
    if (!memberRecord) {
      return next(new ErrorHandler("Not a member of this room", 400));
    }

    await SupabaseService.update("room_members", memberRecord.id, {
      presence: presenceDates, // Store as JSON array
    });

    // Enhance room with members
    room.members = await enrichRoomMembers(room.id);
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

    // Get room members and clear their presence
    const members = await SupabaseService.getRoomMembers(req.params.id);
    await Promise.all(
      (members || []).map((member) =>
        SupabaseService.update("room_members", member.id, { presence: [] }),
      ),
    );

    // Enhance room with members (re-fetch after update)
    room.members = await enrichRoomMembers(room.id);
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

    room.members = await enrichRoomMembers(room.id);
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
