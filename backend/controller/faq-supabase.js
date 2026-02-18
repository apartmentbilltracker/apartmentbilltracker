// FAQ Controller - Supabase
const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// Get all active FAQs
router.get("/", async (req, res) => {
  try {
    const { category } = req.query;

    let faqs = await SupabaseService.selectAllRecords("faqs");
    faqs = faqs.filter((f) => f.is_active);

    if (category) {
      faqs = faqs.filter((f) => f.category === category);
    }

    faqs = faqs.sort((a, b) => {
      const orderA = a.order_index ?? a.order ?? 0;
      const orderB = b.order_index ?? b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    // Map order_index → order for mobile compatibility
    faqs = faqs.map((f) => ({
      ...f,
      order: f.order_index ?? f.order ?? 0,
    }));

    res.status(200).json({
      success: true,
      data: faqs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching FAQs",
      error: error.message,
    });
  }
});

// Get FAQ categories
router.get("/categories", async (req, res) => {
  try {
    const categories = ["billing", "payment", "technical", "general", "room"];

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching categories",
      error: error.message,
    });
  }
});

// Mark FAQ as helpful (user)
router.post("/:faqId/helpful", async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await SupabaseService.selectByColumn("faqs", "id", faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }
    // helpful/views columns may not exist — update silently, ignore errors
    let updated = faq;
    try {
      updated = await SupabaseService.update("faqs", faqId, {
        helpful: (faq.helpful || 0) + 1,
        views: (faq.views || 0) + 1,
      });
    } catch (_e) {
      // columns don't exist, just return the faq as-is
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FAQ",
      error: error.message,
    });
  }
});

// Mark FAQ as not helpful (user)
router.post("/:faqId/not-helpful", async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await SupabaseService.selectByColumn("faqs", "id", faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    // not_helpful/views columns may not exist — update silently, ignore errors
    let updated = faq;
    try {
      updated = await SupabaseService.update("faqs", faqId, {
        not_helpful: (faq.not_helpful || 0) + 1,
        views: (faq.views || 0) + 1,
      });
    } catch (_e) {
      // columns don't exist, just return the faq as-is
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FAQ",
      error: error.message,
    });
  }
});

// Create FAQ (admin only)
router.post("/", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { question, answer, category, order } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "Question and answer are required",
      });
    }

    // DB schema: question, answer, category, order_index, is_active
    // Note: column is 'order_index' not 'order'; no helpful/not_helpful/views columns
    const faq = await SupabaseService.insert("faqs", {
      question,
      answer,
      category: category || "general",
      order_index: order || 0,
      is_active: true,
    });

    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: faq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating FAQ",
      error: error.message,
    });
  }
});

// Update FAQ (admin only)
router.put("/:faqId", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { faqId } = req.params;
    const { question, answer, category, is_active, order } = req.body;

    const faq = await SupabaseService.selectByColumn("faqs", "id", faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    const updated = await SupabaseService.update("faqs", faqId, {
      question: question !== undefined ? question : faq.question,
      answer: answer !== undefined ? answer : faq.answer,
      category: category !== undefined ? category : faq.category,
      is_active: is_active !== undefined ? is_active : faq.is_active,
      order_index:
        order !== undefined ? order : faq.order_index || faq.order || 0,
      updated_at: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FAQ",
      error: error.message,
    });
  }
});

// Delete FAQ (admin only)
router.delete("/:faqId", isAuthenticated, isAdmin, async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await SupabaseService.selectByColumn("faqs", "id", faqId);
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    await SupabaseService.deleteRecord("faqs", "id", faqId);

    res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting FAQ",
      error: error.message,
    });
  }
});

module.exports = router;
