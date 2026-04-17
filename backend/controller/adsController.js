const express = require("express");
const router = express.Router();
const { isAuthenticated, isAdmin } = require("../middleware/auth");
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const SupabaseService = require("../db/SupabaseService");
const cloudinary = require("cloudinary").v2;

/**
 * Get active ads for client display
 * Filters by:
 * - is_active = true
 * - current date is between start_date and end_date
 * - user role is in display_on
 * - screen type matches
 * - excludes ads dismissed by this user
 */
router.get(
  "/client/ads",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { screen = "home" } = req.query;
      const userId = req.user.id;
      const userRole = req.user.role || "client"; // 'client', 'host', 'admin'

      // Get dismissed ads for this user
      const { data: dismissedAdIds } = await SupabaseService.getClient()
        .from("dismissed_ads")
        .select("ad_id")
        .eq("user_id", userId);

      const dismissedIds = dismissedAdIds?.map((d) => d.ad_id) || [];

      // Get active ads
      const { data: ads, error } = await SupabaseService.getClient()
        .from("ads")
        .select("*")
        .eq("is_active", true)
        .eq("display_screen", screen)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filter by:
      // 1. Date range
      // 2. User role visibility
      // 3. Not dismissed by user
      const now = new Date();
      const filteredAds = (ads || []).filter((ad) => {
        // Check date range
        const startDate = new Date(ad.start_date);
        const endDate = ad.end_date ? new Date(ad.end_date) : null;

        if (now < startDate) return false; // Not started yet
        if (endDate && now > endDate) return false; // Expired

        // Check user role visibility
        if (!ad.display_on.includes(userRole)) return false;

        // Check if dismissed
        if (dismissedIds.includes(ad.id)) return false;

        return true;
      });

      // Record impression for each viewed ad
      filteredAds.forEach((ad) => {
        // Non-blocking impression recording
        SupabaseService.getClient()
          .from("ad_impressions")
          .insert({
            ad_id: ad.id,
            user_id: userId,
            is_click: false,
          })
          .then()
          .catch(() => {}); // Non-critical, don't fail the request
      });

      // Increment impression count (non-blocking)
      filteredAds.forEach((ad) => {
        SupabaseService.getClient()
          .from("ads")
          .update({ total_impressions: ad.total_impressions + 1 })
          .eq("id", ad.id)
          .then()
          .catch(() => {}); // Non-critical
      });

      res.status(200).json({
        success: true,
        ads: filteredAds.map((ad) => ({
          id: ad.id,
          title: ad.title,
          description: ad.description,
          imageUrl: ad.image_url,
          buttonText: ad.button_text,
          buttonLink: ad.button_link,
          dismissible: ad.dismissible,
        })),
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Track ad click
 */
router.post(
  "/client/ads/:adId/click",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { adId } = req.params;
      const userId = req.user.id;

      // Record click (non-blocking)
      SupabaseService.getClient()
        .from("ad_impressions")
        .insert({
          ad_id: adId,
          user_id: userId,
          is_click: true,
        })
        .then()
        .catch(() => {}); // Non-critical

      // Increment click count (non-blocking)
      const { data: ad } = await SupabaseService.getClient()
        .from("ads")
        .select("total_clicks")
        .eq("id", adId)
        .single();

      if (ad) {
        SupabaseService.getClient()
          .from("ads")
          .update({ total_clicks: ad.total_clicks + 1 })
          .eq("id", adId)
          .then()
          .catch(() => {}); // Non-critical
      }

      res.status(200).json({ success: true });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Dismiss ad for user
 */
router.post(
  "/client/ads/:adId/dismiss",
  isAuthenticated,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { adId } = req.params;
      const userId = req.user.id;

      // Record dismissal (non-blocking)
      SupabaseService.getClient()
        .from("dismissed_ads")
        .insert({ ad_id: adId, user_id: userId })
        .then()
        .catch(() => {}); // Ignore if already dismissed

      res.status(200).json({ success: true });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

// ============ ADMIN ENDPOINTS ============

/**
 * Create new ad (Admin only)
 * Supports both imageUrl (short URL string) and imageData (base64 for small images)
 */
router.post(
  "/admin/ads",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const {
        title,
        description,
        imageUrl,
        imageData, // Optional: base64 data for small uploaded images
        buttonText = "Learn More",
        buttonLink,
        displayOn = ["client"],
        displayScreen = "home",
        startDate,
        endDate,
        isActive = true,
        priority = 0,
        dismissible = true,
      } = req.body;

      if (!imageUrl && !imageData) {
        return next(
          new ErrorHandler("Image (URL or uploaded) is required", 400),
        );
      }

      // Use imageUrl if provided (shorter, safer), otherwise imageData (base64)
      const finalImageUrl = imageUrl || imageData;

      if (!finalImageUrl || finalImageUrl.length > 500) {
        return next(
          new ErrorHandler(
            `Image field too large (${finalImageUrl?.length || 0}/500 chars). Please try a simpler image or use an image URL.`,
            400,
          ),
        );
      }

      const { data: ad, error } = await SupabaseService.getClient()
        .from("ads")
        .insert({
          title,
          description,
          image_url: finalImageUrl,
          button_text: buttonText,
          button_link: buttonLink,
          display_on: displayOn,
          display_screen: displayScreen,
          start_date: startDate || new Date().toISOString(),
          end_date: endDate,
          is_active: isActive,
          priority,
          dismissible,
          created_by: req.user.id,
        })
        .select()
        .single();

      if (error) throw error;

      res.status(201).json({
        success: true,
        ad,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get all ads (Admin)
 */
router.get(
  "/admin/ads",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { screen, isActive } = req.query;

      let query = SupabaseService.getClient().from("ads").select("*");

      if (screen) query = query.eq("display_screen", screen);
      if (isActive !== undefined)
        query = query.eq("is_active", isActive === "true");

      const { data: ads, error } = await query.order("priority", {
        ascending: false,
      });

      if (error) throw error;

      res.status(200).json({
        success: true,
        ads,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get single ad (Admin)
 */
router.get(
  "/admin/ads/:adId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { adId } = req.params;

      const { data: ad, error } = await SupabaseService.getClient()
        .from("ads")
        .select("*")
        .eq("id", adId)
        .single();

      if (error) throw error;

      // Get analytics
      const { data: impressions } = await SupabaseService.getClient()
        .from("ad_impressions")
        .select("id, is_click")
        .eq("ad_id", adId);

      const clicks = impressions?.filter((i) => i.is_click).length || 0;

      res.status(200).json({
        success: true,
        ad: {
          ...ad,
          impressions: impressions?.length || 0,
          clicks,
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Update ad (Admin)
 * Supports updating imageUrl or imageData
 * Converts camelCase field names to snake_case for database
 */
router.put(
  "/admin/ads/:adId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { adId } = req.params;
      const updates = req.body;

      // Convert camelCase keys to snake_case for database
      const normalizedUpdates = {};
      const fieldMapping = {
        imageUrl: "image_url",
        imageData: "image_url",
        buttonText: "button_text",
        buttonLink: "button_link",
        displayOn: "display_on",
        displayScreen: "display_screen",
        startDate: "start_date",
        endDate: "end_date",
        isActive: "is_active",
      };

      for (const [key, value] of Object.entries(updates)) {
        const dbKey = fieldMapping[key] || key;
        normalizedUpdates[dbKey] = value;
      }

      // Validate image field if being updated
      if (normalizedUpdates.image_url) {
        if (
          normalizedUpdates.image_url &&
          normalizedUpdates.image_url.length > 500
        ) {
          return next(
            new ErrorHandler(
              `Image field too large (${normalizedUpdates.image_url.length}/500 chars). Please try a simpler image or use an image URL.`,
              400,
            ),
          );
        }
      }

      // Clean up any duplicate fields
      delete normalizedUpdates.imageUrl;
      delete normalizedUpdates.imageData;
      delete normalizedUpdates.buttonText;
      delete normalizedUpdates.buttonLink;
      delete normalizedUpdates.displayOn;
      delete normalizedUpdates.displayScreen;
      delete normalizedUpdates.startDate;
      delete normalizedUpdates.endDate;
      delete normalizedUpdates.isActive;

      const { data: ad, error } = await SupabaseService.getClient()
        .from("ads")
        .update({
          ...normalizedUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", adId)
        .select()
        .single();

      if (error) throw error;

      res.status(200).json({
        success: true,
        ad,
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Delete ad (Admin)
 */
router.delete(
  "/admin/ads/:adId",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { adId } = req.params;

      const { error } = await SupabaseService.getClient()
        .from("ads")
        .delete()
        .eq("id", adId);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: "Ad deleted successfully",
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Get ad analytics (Admin)
 */
router.get(
  "/admin/ads/:adId/analytics",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      const { adId } = req.params;

      const { data: impressions, error } = await SupabaseService.getClient()
        .from("ad_impressions")
        .select("id, is_click, viewed_at")
        .eq("ad_id", adId)
        .order("viewed_at", { ascending: false });

      if (error) throw error;

      const totalImpressions = impressions?.length || 0;
      const totalClicks = impressions?.filter((i) => i.is_click).length || 0;
      const ctr =
        totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

      res.status(200).json({
        success: true,
        analytics: {
          totalImpressions,
          totalClicks,
          ctr: ctr.toFixed(2),
          dailyData: impressions, // Could be aggregated by day
        },
      });
    } catch (error) {
      return next(new ErrorHandler(error.message, 500));
    }
  }),
);

/**
 * Upload ad image to Cloudinary (Admin only)
 * Expects multipart/form-data with 'image' file field
 */
router.post(
  "/admin/upload-image",
  isAuthenticated,
  isAdmin,
  catchAsyncErrors(async (req, res, next) => {
    try {
      if (!req.files || !req.files.image) {
        return next(new ErrorHandler("No image file provided", 400));
      }

      const imageFile = req.files.image;

      // Upload to Cloudinary
      const result = await cloudinary.uploader.upload(imageFile.tempFilePath, {
        folder: "apartment-bill-tracker/ads",
        resource_type: "auto",
        quality: 70, // Optimize for web
      });

      res.status(200).json({
        success: true,
        imageUrl: result.secure_url, // Use secure HTTPS URL
      });
    } catch (error) {
      console.error("Cloudinary upload error:", error);
      return next(
        new ErrorHandler(
          error.message || "Failed to upload image to Cloudinary",
          500,
        ),
      );
    }
  }),
);

module.exports = router;
