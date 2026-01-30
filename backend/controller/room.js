const express = require("express");
const router = express.Router();
const Room = require("../model/room");
const { isAuthenticated } = require("../middleware/auth");
const ErrorHandler = require("../utils/ErrorHandler");
const PDFDocument = require("pdfkit");

// create room
router.post("/", isAuthenticated, async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return next(new ErrorHandler("Name is required", 400));

    const code = `${name.replace(/\s+/g, "-").toLowerCase()}-${Date.now().toString().slice(-5)}`;

    const room = await Room.create({
      name,
      code,
      description: description || "",
      createdBy: req.user?._id || null,
    });

    res.status(201).json({ success: true, room });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// list rooms
router.get("/", async (req, res, next) => {
  try {
    // include billing and members so clients can determine membership and billing info
    const rooms = await Room.find().populate("members.user", "name email");
    res.status(200).json({ success: true, rooms });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// get single room
router.get("/:id", async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id).populate(
      "members.user",
      "name email",
    );
    if (!room) return next(new ErrorHandler("Room not found", 404));
    res.status(200).json({ success: true, room });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// join room
router.post("/:id/join", isAuthenticated, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    const exists = room.members.find(
      (m) => String(m.user) === String(req.user._id),
    );
    if (exists) {
      // Populate and return with billing
      const populatedRoom = await Room.findById(req.params.id)
        .select(
          "name description code createdAt billing billingHistory members",
        )
        .populate("members.user", "name email");
      return res.status(200).json({
        success: true,
        message: "Already joined",
        room: populatedRoom,
      });
    }

    const { isPayer = true } = req.body;
    room.members.push({
      user: req.user._id,
      name: req.user.name || req.user.email,
      isPayer,
    });
    await room.save();

    // Populate before returning with billing
    const populatedRoom = await Room.findById(req.params.id)
      .select("name description code createdAt billing billingHistory members")
      .populate("members.user", "name email");

    res.status(200).json({ success: true, room: populatedRoom });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// leave room
router.post("/:id/leave", isAuthenticated, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    const memberIndex = room.members.findIndex(
      (m) => String(m.user) === String(req.user._id),
    );
    if (memberIndex === -1)
      return next(new ErrorHandler("Not a member of this room", 400));

    room.members.splice(memberIndex, 1);
    await room.save();

    res.status(200).json({ success: true, message: "Left room", room });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// update room details (name, description, maxOccupancy)
router.put("/:id", isAuthenticated, async (req, res, next) => {
  try {
    const { name, description, maxOccupancy } = req.body;
    if (!name) return next(new ErrorHandler("Name is required", 400));

    const room = await Room.findById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Update room fields
    room.name = name.trim();
    if (description !== undefined) room.description = description.trim();
    if (maxOccupancy !== undefined) room.maxOccupancy = Number(maxOccupancy);

    await room.save();

    const populatedRoom = await Room.findById(room._id)
      .select(
        "name description code createdAt billing billingHistory members maxOccupancy",
      )
      .populate("members.user", "name email");

    res.status(200).json({ success: true, room: populatedRoom });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// delete room
router.delete("/:id", isAuthenticated, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    await Room.deleteOne({ _id: req.params.id });

    res
      .status(200)
      .json({ success: true, message: "Room deleted successfully" });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// Admin: remove a member from room
router.delete(
  "/:id/members/:memberId",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const room = await Room.findById(req.params.id);
      if (!room) return next(new ErrorHandler("Room not found", 404));

      const memberIndex = room.members.findIndex(
        (m) => String(m._id) === String(req.params.memberId),
      );
      if (memberIndex === -1)
        return next(new ErrorHandler("Member not found in room", 404));

      room.members.splice(memberIndex, 1);
      await room.save();

      res.status(200).json({ success: true, message: "Member removed", room });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// update billing for a room
router.put("/:id/billing", isAuthenticated, async (req, res, next) => {
  try {
    const { start, end, rent, electricity, previousReading, currentReading } =
      req.body;
    const room = await Room.findById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // only creator or admin can update (simple check)
    if (
      room.createdBy &&
      String(room.createdBy) !== String(req.user._id) &&
      !req.user.role?.includes("admin")
    ) {
      return next(new ErrorHandler("Forbidden", 403));
    }

    // If there's existing billing data, save it to history
    if (room.billing && room.billing.start && room.billing.end) {
      room.billingHistory = room.billingHistory || [];
      room.billingHistory.push({
        start: room.billing.start,
        end: room.billing.end,
        rent: room.billing.rent,
        electricity: room.billing.electricity,
        previousReading: room.billing.previousReading,
        currentReading: room.billing.currentReading,
        createdAt: room.billing.updatedAt || new Date(),
      });
    }

    // compute electricity from readings if provided
    let computedElectricity = electricity ?? room.billing?.electricity;
    if (
      typeof previousReading === "number" &&
      typeof currentReading === "number" &&
      currentReading >= previousReading
    ) {
      const consumed = currentReading - previousReading;
      computedElectricity = consumed * 16; // rate 16 per kwt
    }

    // Update billing dates - handle both truthy values and explicit null/undefined to clear
    if (start !== undefined) {
      room.billing.start = start ? new Date(start) : null;
    }
    if (end !== undefined) {
      room.billing.end = end ? new Date(end) : null;
    }
    if (typeof rent === "number") room.billing.rent = rent;
    room.billing.electricity = computedElectricity ?? 0;
    if (typeof previousReading === "number")
      room.billing.previousReading = previousReading;
    if (typeof currentReading === "number")
      room.billing.currentReading = currentReading;
    room.billing.updatedAt = new Date();

    await room.save();

    // Return room with populated data
    const populatedRoom = await Room.findById(req.params.id)
      .select("name description code createdAt billing billingHistory members")
      .populate("members.user", "name email");

    res.status(200).json({ success: true, room: populatedRoom });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// get billing history for a room
router.get("/:id/billing-history", isAuthenticated, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .select("name description code billing billingHistory members")
      .populate("members.user", "name email");

    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Check if user is a member of the room
    const isMember = room.members?.some(
      (m) => String(m.user?._id || m.user) === String(req.user._id),
    );

    if (!isMember && String(room.createdBy) !== String(req.user._id)) {
      return next(new ErrorHandler("Forbidden", 403));
    }

    // Return current billing + history
    const allBilling = [
      {
        ...(room.billing?.toObject?.() || room.billing),
        isCurrent: true,
        createdAt: room.billing?.updatedAt,
      },
      ...(room.billingHistory || []),
    ].filter((b) => b.start && b.end); // Only include complete billing periods

    res.status(200).json({ success: true, billing: allBilling });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// save user presence dates for a room
router.post("/:id/presence", isAuthenticated, async (req, res, next) => {
  try {
    const { presenceDates } = req.body; // Array of ISO date strings
    if (!Array.isArray(presenceDates)) {
      return next(new ErrorHandler("Presence dates must be an array", 400));
    }

    const room = await Room.findById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Find the member and update their presence
    const memberIndex = room.members.findIndex(
      (m) => String(m.user) === String(req.user._id),
    );
    if (memberIndex === -1) {
      return next(new ErrorHandler("Not a member of this room", 400));
    }

    room.members[memberIndex].presence = presenceDates;
    await room.save();

    // Return populated room
    const populatedRoom = await Room.findById(req.params.id)
      .select("name description code createdAt billing billingHistory members")
      .populate("members.user", "name email");

    res.status(200).json({
      success: true,
      message: "Presence saved successfully",
      room: populatedRoom,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// Clear all presence for all members in a room (admin only)
router.put("/:id/clear-presence", isAuthenticated, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return next(new ErrorHandler("Room not found", 404));

    // Only room creator or admin can clear presence
    if (
      room.createdBy &&
      String(room.createdBy) !== String(req.user._id) &&
      !req.user.role?.includes("admin")
    ) {
      return next(new ErrorHandler("Forbidden", 403));
    }

    // Clear presence for all members
    room.members.forEach((member) => {
      member.presence = [];
    });

    await room.save();

    // Return populated room
    const populatedRoom = await Room.findById(req.params.id)
      .select("name description code createdAt billing billingHistory members")
      .populate("members.user", "name email");

    res.status(200).json({
      success: true,
      message: "Presence cleared for all members",
      room: populatedRoom,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// Helper function to draw a table row
const drawTableRow = (doc, y, col1, col2, col3, isBold = false) => {
  const font = isBold ? "Helvetica-Bold" : "Helvetica";
  doc.font(font).fontSize(9);
  doc.text(col1, 50, y, { width: 180 });
  doc.text(col2, 240, y, { width: 120, align: "center" });
  doc.text(col3, 370, y, { width: 120, align: "right" });
};

// export room billing as PDF
router.get("/:id/export", isAuthenticated, async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .select("name billing members code")
      .populate("members.user", "name email");

    if (!room) return next(new ErrorHandler("Room not found", 404));

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

    if (room.billing?.start && room.billing?.end) {
      const startDate = new Date(room.billing.start).toLocaleDateString(
        "en-US",
        {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        },
      );
      const endDate = new Date(room.billing.end).toLocaleDateString("en-US", {
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

    if (room.members && room.members.length > 0) {
      room.members.forEach((member, idx) => {
        const memberName = member.name || member.user?.name || "Unknown";
        const isCurrentUser =
          String(member.user?._id || member.user) === String(req.user._id);
        const displayName = isCurrentUser ? `${memberName} (You)` : memberName;
        const daysPresent = member.presence ? member.presence.length : 0;
        const rate = 5;
        const amount = daysPresent * rate;
        waterTotal += amount;

        // Highlight current user row
        if (isCurrentUser) {
          doc.rect(40, doc.y, 475, 14).fill("#fff9e6");
        } else if (idx % 2 === 0) {
          doc.rect(40, doc.y, 475, 14).fill("#fafafa");
        }

        const rowY = doc.y + 1;
        doc
          .fillColor(isCurrentUser ? "#d4860d" : "#000000")
          .font("Helvetica")
          .fontSize(8);
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
    }

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
    if (room.billing) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text("⚡ ELECTRICITY CHARGES");
      doc.fontSize(8).fillColor("#999999").text("─".repeat(80));
      doc.moveDown(0.3);

      const prevReading = room.billing.previousReading || 0;
      const currReading = room.billing.currentReading || 0;
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

      // Payer breakdown
      const payers = room.members ? room.members.filter((m) => m.isPayer) : [];
      if (payers.length > 0) {
        const perPayerElec = Math.round(totalElecBill / payers.length);
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("#333333")
          .text(`Per Payer Share (÷${payers.length}):`);
        doc.fontSize(8).font("Helvetica").fillColor("#555555");
        payers.forEach((payer) => {
          const payerName = payer.name || payer.user?.name || "Unknown";
          const isCurrentUser =
            String(payer.user?._id || payer.user) === String(req.user._id);
          const displayName = isCurrentUser ? `${payerName} (You)` : payerName;
          const amountStr = `₱${perPayerElec}`;
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
    if (room.billing?.rent) {
      doc
        .fontSize(11)
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text("🏠 RENT CHARGES");
      doc.fontSize(8).fillColor("#999999").text("─".repeat(80));
      doc.moveDown(0.3);

      doc.fontSize(8).font("Helvetica").fillColor("#333333");
      doc.text(`Total Apartment Rate: ₱${room.billing.rent}`);
      doc.moveDown(0.3);

      // Rent total
      doc.moveTo(40, doc.y).lineTo(515, doc.y).stroke("#cccccc");
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#000000");
      const rentTotalY = doc.y + 3;
      doc.text("SUBTOTAL (Rent)", 45, rentTotalY, { width: 200 });
      doc.text(`₱${room.billing.rent}`, 395, rentTotalY, {
        width: 110,
        align: "right",
      });
      doc.moveDown(0.8);

      // Payer breakdown
      const payers = room.members ? room.members.filter((m) => m.isPayer) : [];
      if (payers.length > 0) {
        const perPayerRent = Math.round(room.billing.rent / payers.length);
        doc
          .fontSize(8)
          .font("Helvetica-Bold")
          .fillColor("#333333")
          .text(`Per Payer Share (÷${payers.length}):`);
        doc.fontSize(8).font("Helvetica").fillColor("#555555");
        payers.forEach((payer) => {
          const payerName = payer.name || payer.user?.name || "Unknown";
          const isCurrentUser =
            String(payer.user?._id || payer.user) === String(req.user._id);
          const displayName = isCurrentUser ? `${payerName} (You)` : payerName;
          const amountStr = `₱${perPayerRent}`;
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
      ((room.billing?.currentReading || 0) -
        (room.billing?.previousReading || 0)) *
        16 +
      (room.billing?.rent || 0);

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
      `Report ID: ${room._id.toString().substring(0, 8).toUpperCase()} | Generated: ${new Date().toISOString()}`,
      { align: "center" },
    );

    doc.end();
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

module.exports = router;
