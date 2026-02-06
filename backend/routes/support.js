const express = require("express");
const router = express.Router();
const supportTicketController = require("../controller/supportTicket");
const faqController = require("../controller/faq");
const bugReportController = require("../controller/bugReport");
const { isAuthenticated } = require("../middleware/auth");

// Support Tickets Routes
router.post("/create-ticket", isAuthenticated, supportTicketController.createSupportTicket);
router.get("/my-tickets", isAuthenticated, supportTicketController.getUserTickets);
router.get("/ticket/:ticketId", isAuthenticated, supportTicketController.getTicketDetails);
router.post("/ticket/:ticketId/reply", isAuthenticated, supportTicketController.addReply);
router.post("/ticket/:ticketId/read", isAuthenticated, supportTicketController.markTicketAsRead);
router.get("/all-tickets", isAuthenticated, supportTicketController.getAllTickets); // Admin
router.put("/ticket/:ticketId/status", isAuthenticated, supportTicketController.updateTicketStatus); // Admin

// FAQ Routes
router.get("/faqs", faqController.getAllFAQs);
router.get("/faq-categories", faqController.getFAQCategories);
router.post("/faq/:faqId/helpful", faqController.markHelpful);
router.post("/faq/:faqId/not-helpful", faqController.markNotHelpful);
router.post("/create-faq", isAuthenticated, faqController.createFAQ); // Admin
router.put("/faq/:faqId", isAuthenticated, faqController.updateFAQ); // Admin
router.delete("/faq/:faqId", isAuthenticated, faqController.deleteFAQ); // Admin
router.get("/admin-faqs", isAuthenticated, faqController.adminGetAllFAQs); // Admin

// Bug Report Routes
router.post("/create-bug-report", isAuthenticated, bugReportController.createBugReport);
router.get("/my-bug-reports", isAuthenticated, bugReportController.getUserBugReports);
router.get("/bug-report/:reportId", isAuthenticated, bugReportController.getBugReportDetails);
router.post("/bug-report/:reportId/response", isAuthenticated, bugReportController.addResponse);
router.post("/bug-report/:reportId/read", isAuthenticated, bugReportController.markBugReportAsRead);
router.get("/all-bug-reports", isAuthenticated, bugReportController.getAllBugReports); // Admin
router.put("/bug-report/:reportId/status", isAuthenticated, bugReportController.updateBugReportStatus); // Admin
router.get("/bug-report-stats", isAuthenticated, bugReportController.getBugReportStats); // Admin

module.exports = router;
