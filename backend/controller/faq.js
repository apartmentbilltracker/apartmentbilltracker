const FAQ = require("../model/faq");

// Get all active FAQs
exports.getAllFAQs = async (req, res) => {
  try {
    const { category } = req.query;

    let filter = { isActive: true };
    if (category) {
      filter.category = category;
    }

    const faqs = await FAQ.find(filter).sort({ order: 1, createdAt: -1 });

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
};

// Get FAQ categories
exports.getFAQCategories = async (req, res) => {
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
};

// Mark FAQ as helpful (user)
exports.markHelpful = async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await FAQ.findByIdAndUpdate(
      faqId,
      { $inc: { helpful: 1, views: 1 } },
      { new: true },
    );

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    res.status(200).json({
      success: true,
      data: faq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FAQ",
      error: error.message,
    });
  }
};

// Mark FAQ as not helpful (user)
exports.markNotHelpful = async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await FAQ.findByIdAndUpdate(
      faqId,
      { $inc: { notHelpful: 1, views: 1 } },
      { new: true },
    );

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    res.status(200).json({
      success: true,
      data: faq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FAQ",
      error: error.message,
    });
  }
};

// Create FAQ (admin only)
exports.createFAQ = async (req, res) => {
  try {
    const { question, answer, category, order } = req.body;

    const faq = new FAQ({
      question,
      answer,
      category,
      order,
    });

    await faq.save();

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
};

// Update FAQ (admin only)
exports.updateFAQ = async (req, res) => {
  try {
    const { faqId } = req.params;
    const { question, answer, category, isActive, order } = req.body;

    const faq = await FAQ.findByIdAndUpdate(
      faqId,
      {
        question,
        answer,
        category,
        isActive,
        order,
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: faq,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating FAQ",
      error: error.message,
    });
  }
};

// Delete FAQ (admin only)
exports.deleteFAQ = async (req, res) => {
  try {
    const { faqId } = req.params;

    const faq = await FAQ.findByIdAndDelete(faqId);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }

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
};

// Get all FAQs (admin only)
exports.adminGetAllFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find().sort({ order: 1, createdAt: -1 });

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
};
