// Bug Report Controller (Supabase Version)
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");

// Helper to normalize bug report responses for mobile compatibility
const normalizeResponse = (response) => ({
  ...response,
  createdAt: response.created_at,
  reportId: response.report_id,
  userId: response.user_id,
});

// Helper to normalize a bug report object for mobile compatibility
const normalizeBugReport = (report) => ({
  ...report,
  createdAt: report.created_at,
  userId: report.user_id,
  assignedTo: report.assigned_to,
  responses: (report.responses || []).map(normalizeResponse),
});

// ============================================================
// CREATE BUG REPORT
// ============================================================
router.post("/create-bug-report", isAuthenticated, async (req, res, next) => {
  try {
    const { title, description, severity, category, device } = req.body;

    if (!title || !description) {
      return next(new ErrorHandler("Title and description are required", 400));
    }

    const bugReport = await SupabaseService.insert("bug_reports", {
      user_id: req.user.id,
      title,
      description,
      severity: severity || "low",
      category: category || "general",
      device: device || "unknown",
      status: "open",
      created_at: new Date(),
    });

    res.status(201).json({
      success: true,
      message: "Bug report submitted successfully",
      bugReport: normalizeBugReport(bugReport),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET USER'S BUG REPORTS
// ============================================================
router.get("/my-bug-reports", isAuthenticated, async (req, res, next) => {
  try {
    const { status } = req.query;

    const reports =
      (await SupabaseService.selectAll(
        "bug_reports",
        "user_id",
        req.user.id,
      )) || [];

    let filtered = reports;
    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    // Enrich with assignee details if applicable
    for (let report of filtered) {
      if (report.assigned_to) {
        const assignee = await SupabaseService.findUserById(report.assigned_to);
        report.assignee = assignee;
      }
    }

    const sorted = filtered.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    res.status(200).json({
      success: true,
      reports: sorted.map(normalizeBugReport),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// GET SINGLE BUG REPORT
// ============================================================
router.get("/bug-report/:reportId", isAuthenticated, async (req, res, next) => {
  try {
    const { reportId } = req.params;

    const report = await SupabaseService.selectByColumn(
      "bug_reports",
      "id",
      reportId,
    );

    if (!report) {
      return next(new ErrorHandler("Bug report not found", 404));
    }

    // Enrich with user and assignee details
    const user = await SupabaseService.findUserById(report.user_id);
    report.user = user;

    if (report.assigned_to) {
      const assignee = await SupabaseService.findUserById(report.assigned_to);
      report.assignee = assignee;
    }

    res.status(200).json({
      success: true,
      report: normalizeBugReport(report),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// ADD RESPONSE TO BUG REPORT
// ============================================================
router.post(
  "/bug-report/:reportId/response",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { reportId } = req.params;
      const { message } = req.body;

      if (!message) {
        return next(new ErrorHandler("Message is required", 400));
      }

      // Verify report exists
      const report = await SupabaseService.selectByColumn(
        "bug_reports",
        "id",
        reportId,
      );

      if (!report) {
        return next(new ErrorHandler("Bug report not found", 404));
      }

      const response = await SupabaseService.insert("bug_report_responses", {
        report_id: reportId,
        user_id: req.user.id,
        message,
        created_at: new Date(),
      });

      res.status(201).json({
        success: true,
        message: "Response added successfully",
        response: normalizeResponse(response),
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// MARK BUG REPORT AS READ
// ============================================================
router.post(
  "/bug-report/:reportId/read",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { reportId } = req.params;

      const report = await SupabaseService.selectByColumn(
        "bug_reports",
        "id",
        reportId,
      );

      if (!report) {
        return next(new ErrorHandler("Bug report not found", 404));
      }

      const updated = await SupabaseService.update("bug_reports", reportId, {
        is_read: true,
      });

      res.status(200).json({
        success: true,
        message: "Bug report marked as read",
        report: normalizeBugReport(updated),
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// GET ALL BUG REPORTS (ADMIN)
// ============================================================
router.get("/all-bug-reports", isAuthenticated, async (req, res, next) => {
  try {
    const { status, severity } = req.query;

    const allReports = await SupabaseService.selectAllRecords("bug_reports");

    let reports = allReports;
    if (status) {
      reports = reports.filter((r) => r.status === status);
    }
    if (severity) {
      reports = reports.filter((r) => r.severity === severity);
    }

    // Enrich with user details
    for (let report of reports) {
      const user = await SupabaseService.findUserById(report.user_id);
      report.user = user;
      if (report.assigned_to) {
        const assignee = await SupabaseService.findUserById(report.assigned_to);
        report.assignee = assignee;
      }
    }

    const sorted = reports.sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    res.status(200).json({
      success: true,
      reports: sorted.map(normalizeBugReport),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

// ============================================================
// UPDATE BUG REPORT STATUS (ADMIN)
// ============================================================
router.put(
  "/bug-report/:reportId/status",
  isAuthenticated,
  async (req, res, next) => {
    try {
      const { reportId } = req.params;
      const { status, severity, assignedTo, notes } = req.body;

      const updateData = {};
      if (status) updateData.status = status;
      if (severity) updateData.severity = severity;
      if (assignedTo) updateData.assigned_to = assignedTo;
      if (notes) updateData.notes = notes;
      updateData.updated_at = new Date();

      const updatedReport = await SupabaseService.update(
        "bug_reports",
        reportId,
        updateData,
      );

      // Enrich response
      const user = await SupabaseService.findUserById(updatedReport.user_id);
      updatedReport.user = user;

      if (updatedReport.assigned_to) {
        const assignee = await SupabaseService.findUserById(
          updatedReport.assigned_to,
        );
        updatedReport.assignee = assignee;
      }

      res.status(200).json({
        success: true,
        message: "Bug report updated successfully",
        report: normalizeBugReport(updatedReport),
      });
    } catch (error) {
      next(new ErrorHandler(error.message, 500));
    }
  },
);

// ============================================================
// GET BUG REPORT STATS (ADMIN)
// ============================================================
router.get("/bug-report-stats", isAuthenticated, async (req, res, next) => {
  try {
    const allReports = await SupabaseService.selectAllRecords("bug_reports");

    const stats = {
      total: allReports.length,
      open: allReports.filter((r) => r.status === "open").length,
      closed: allReports.filter((r) => r.status === "closed").length,
      assigned: allReports.filter((r) => r.assigned_to).length,
      bySeverity: {
        critical: allReports.filter((r) => r.severity === "critical").length,
        high: allReports.filter((r) => r.severity === "high").length,
        medium: allReports.filter((r) => r.severity === "medium").length,
        low: allReports.filter((r) => r.severity === "low").length,
      },
    };

    res.status(200).json({
      success: true,
      stats,
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

module.exports = router;
