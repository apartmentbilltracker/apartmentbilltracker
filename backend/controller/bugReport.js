const BugReport = require("../model/bugReport");
const User = require("../model/user");

// Create bug report
exports.createBugReport = async (req, res) => {
  try {
    const { title, description, severity, module } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    const bugReport = new BugReport({
      user: userId,
      userName: user.name,
      userEmail: user.email,
      title,
      description,
      severity,
      module,
    });

    await bugReport.save();

    res.status(201).json({
      success: true,
      message: "Bug report submitted successfully",
      data: bugReport,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating bug report",
      error: error.message,
    });
  }
};

// Get user's bug reports
exports.getUserBugReports = async (req, res) => {
  try {
    const userId = req.user._id;
    const reports = await BugReport.find({ user: userId }).sort({
      createdAt: -1,
    });

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching bug reports",
      error: error.message,
    });
  }
};

// Get bug report details
exports.getBugReportDetails = async (req, res) => {
  try {
    const { reportId } = req.params;
    const report = await BugReport.findById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Bug report not found",
      });
    }

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching bug report",
      error: error.message,
    });
  }
};

// Add response to bug report
exports.addResponse = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const isAdmin = req.user.role && req.user.role.includes("admin");

    const report = await BugReport.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Bug report not found",
      });
    }

    // Check if user is the report creator or admin
    if (String(report.user) !== String(userId) && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!report.responses) {
      report.responses = [];
    }

    report.responses.push({
      from: isAdmin ? "admin" : "user",
      message,
      createdAt: new Date(),
    });
    report.updatedAt = new Date();

    await report.save();

    res.status(200).json({
      success: true,
      message: "Response added successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error in addResponse:", error);
    res.status(500).json({
      success: false,
      message: "Error adding response",
      error: error.message,
    });
  }
};

// Get all bug reports (admin only)
exports.getAllBugReports = async (req, res) => {
  try {
    const reports = await BugReport.find()
      .populate("user", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching bug reports",
      error: error.message,
    });
  }
};

// Update bug report status (admin only)
exports.updateBugReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, response } = req.body;

    const report = await BugReport.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Bug report not found",
      });
    }

    report.status = status;
    if (response) {
      report.responses.push({
        from: "admin",
        message: response,
      });
    }
    report.updatedAt = new Date();

    if (status === "fixed" && !report.fixedAt) {
      report.fixedAt = new Date();
    }

    await report.save();

    res.status(200).json({
      success: true,
      message: "Bug report updated successfully",
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating bug report",
      error: error.message,
    });
  }
};

// Get bug report statistics (admin only)
exports.getBugReportStats = async (req, res) => {
  try {
    const stats = {
      total: await BugReport.countDocuments(),
      new: await BugReport.countDocuments({ status: "new" }),
      inReview: await BugReport.countDocuments({ status: "in-review" }),
      acknowledged: await BugReport.countDocuments({
        status: "acknowledged",
      }),
      fixed: await BugReport.countDocuments({ status: "fixed" }),
      closed: await BugReport.countDocuments({ status: "closed" }),
      critical: await BugReport.countDocuments({ severity: "critical" }),
    };

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message,
    });
  }
};

// Mark bug report as read by user
exports.markBugReportAsRead = async (req, res) => {
  try {
    const { reportId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.role && req.user.role.includes("admin");

    const report = await BugReport.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Bug report not found",
      });
    }

    // Check if user is authorized to mark this report as read
    if (String(report.user) !== String(userId) && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    // Mark as read by appropriate party
    if (isAdmin) {
      report.isReadByAdmin = true;
    } else {
      report.isReadByUser = true;
    }

    await report.save();

    res.status(200).json({
      success: true,
      message: "Bug report marked as read",
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking bug report as read",
      error: error.message,
    });
  }
};
