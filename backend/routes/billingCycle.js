const express = require("express");
const {
  createBillingCycle,
  getBillingCycles,
  getBillingCycleById,
  closeBillingCycle,
  updateBillingCycle,
  addBillsToCycle,
  getActiveCycle,
  deleteBillingCycle,
  repairBillingCycle,
  repairMissingCycles,
  getBillingTotalsByMonth,
} = require("../controller/billingCycle");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// Create new billing cycle (admin only)
router.post("/create", isAdmin, createBillingCycle);

// Get all cycles for a room
router.get("/room/:roomId", getBillingCycles);

// Get single cycle details
router.get("/:cycleId", getBillingCycleById);

// Get active cycle for a room
router.get("/active/:roomId", getActiveCycle);

// Update cycle details (admin only)
router.put("/:cycleId", isAdmin, updateBillingCycle);

// Add bills to cycle (admin only)
router.put("/:cycleId/bills", isAdmin, addBillsToCycle);

// Close/complete a cycle (admin only)
router.put("/:cycleId/close", isAdmin, closeBillingCycle);
// Repair cycle (admin only)
router.put("/:cycleId/repair", isAdmin, repairBillingCycle);
// Repair missing cycles batch (admin only)
router.put("/repair-missing", isAdmin, repairMissingCycles);

// Admin: get billing totals by month
router.get("/totals/month", isAdmin, getBillingTotalsByMonth);

// Delete cycle (admin only, only if no bills)
router.delete("/:cycleId", isAdmin, deleteBillingCycle);

module.exports = router;
