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
  getLatestBillingCycleStats,
} = require("../controller/billingCycle");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// Create new billing cycle (admin only)
router.post("/create", isAdmin, createBillingCycle);

// Get all cycles for a room
router.get("/room/:roomId", getBillingCycles);

// Get active cycle for a room (must be before /:cycleId to avoid being matched as cycleId)
router.get("/active/:roomId", getActiveCycle);

// Admin: get latest billing cycle stats (must be before single/:id routes)
router.get("/totals/latest", isAdmin, getLatestBillingCycleStats);

// Admin: get billing totals by month
router.get("/totals/month", isAdmin, getBillingTotalsByMonth);

// Get single cycle details
router.get("/:cycleId", getBillingCycleById);

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

// Delete cycle (admin only, only if no bills)
router.delete("/:cycleId", isAdmin, deleteBillingCycle);

module.exports = router;
