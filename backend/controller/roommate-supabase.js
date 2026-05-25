const express = require("express");
const router = express.Router();
const SupabaseService = require("../db/SupabaseService");
const ErrorHandler = require("../utils/ErrorHandler");
const { isAuthenticated } = require("../middleware/auth");

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const asLocations = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const approvedMemberships = (rows = []) =>
  rows.filter((row) => String(row.status || "").toLowerCase() === "approved");

const buildRoomSets = (rows = []) => {
  const map = new Map();
  approvedMemberships(rows).forEach((row) => {
    const key = String(row.user_id);
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(String(row.room_id));
  });
  return map;
};

const firstSharedRoom = (roomSets, currentUserId, targetUserId) => {
  const currentRooms = roomSets.get(String(currentUserId));
  const targetRooms = roomSets.get(String(targetUserId));
  if (!currentRooms || !targetRooms) return null;
  for (const roomId of targetRooms) {
    if (currentRooms.has(roomId)) return roomId;
  }
  return null;
};

const normalizeProfile = (profile, user, roomSets, currentUserId) => {
  if (!profile || !user || user.is_active === false) return null;

  const profileUserId = String(profile.user_id);
  const locations = Array.isArray(profile.preferred_locations)
    ? profile.preferred_locations
    : asLocations(profile.preferred_locations);

  return {
    id: profile.id,
    userId: profile.user_id,
    name: profile.display_name || user.name || "Roommate seeker",
    age: profile.age,
    gender: profile.gender,
    work: profile.work,
    preferredLocations: locations,
    budget: profile.budget,
    moveInDate: profile.move_in_date,
    facebookAccount: profile.facebook_account || "",
    bio: profile.bio,
    avatar: user.avatar || null,
    isVerified: true,
    hasRoom: (roomSets.get(profileUserId)?.size || 0) > 0,
    sharedRoomId: firstSharedRoom(roomSets, currentUserId, profile.user_id),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
};

const getMembershipContext = async () => {
  const memberships = await SupabaseService.selectAllRecords(
    "room_members",
    "user_id, room_id, status",
  );
  return buildRoomSets(memberships);
};

router.get("/", isAuthenticated, async (req, res, next) => {
  try {
    const profiles = await SupabaseService.selectAllRecords(
      "roommate_profiles",
      "*",
    );
    const activeProfiles = (profiles || []).filter(
      (profile) => profile.is_active !== false,
    );
    const userIds = activeProfiles.map((profile) => profile.user_id);
    const [usersById, roomSets] = await Promise.all([
      SupabaseService.findUsersByIds(userIds, { withAvatar: true }),
      getMembershipContext(),
    ]);

    const roommateProfiles = activeProfiles
      .filter((profile) => String(profile.user_id) !== String(req.user.id))
      .map((profile) =>
        normalizeProfile(
          profile,
          usersById.get(profile.user_id),
          roomSets,
          req.user.id,
        ),
      )
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    res.status(200).json({ success: true, profiles: roommateProfiles });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

router.get("/me", isAuthenticated, async (req, res, next) => {
  try {
    const profile = await SupabaseService.selectByColumn(
      "roommate_profiles",
      "user_id",
      req.user.id,
    );

    if (!profile || profile.is_active === false) {
      return res.status(200).json({ success: true, profile: null });
    }

    const roomSets = await getMembershipContext();
    res.status(200).json({
      success: true,
      profile: normalizeProfile(profile, req.user, roomSets, req.user.id),
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

router.post("/me", isAuthenticated, async (req, res, next) => {
  try {
    const age = req.body.age === "" ? null : Number(req.body.age);
    const budget = req.body.budget === "" ? null : Number(req.body.budget);

    if (age != null && (!Number.isFinite(age) || age < 16 || age > 100)) {
      return next(new ErrorHandler("Please enter a valid age", 400));
    }

    if (budget != null && (!Number.isFinite(budget) || budget < 0)) {
      return next(new ErrorHandler("Please enter a valid budget", 400));
    }

    const payload = {
      user_id: req.user.id,
      display_name: String(req.body.displayName || req.user.name || "").trim(),
      age,
      gender: String(req.body.gender || "").trim(),
      work: String(req.body.work || "").trim(),
      preferred_locations: asLocations(req.body.preferredLocations),
      budget,
      move_in_date: toIsoDate(req.body.moveInDate),
      facebook_account: String(req.body.facebookAccount || "").trim(),
      bio: String(req.body.bio || "").trim(),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const existing = await SupabaseService.selectByColumn(
      "roommate_profiles",
      "user_id",
      req.user.id,
    );

    const saved = existing
      ? await SupabaseService.update("roommate_profiles", existing.id, payload)
      : await SupabaseService.insert("roommate_profiles", payload);

    const roomSets = await getMembershipContext();
    res.status(200).json({
      success: true,
      profile: normalizeProfile(saved, req.user, roomSets, req.user.id),
      message: "Roommate profile saved",
    });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

router.get("/:id", isAuthenticated, async (req, res, next) => {
  try {
    let profile = await SupabaseService.selectByColumn(
      "roommate_profiles",
      "id",
      req.params.id,
    );

    if (!profile) {
      profile = await SupabaseService.selectByColumn(
        "roommate_profiles",
        "user_id",
        req.params.id,
      );
    }

    if (!profile || profile.is_active === false) {
      return next(new ErrorHandler("Roommate profile not found", 404));
    }

    const [user, roomSets] = await Promise.all([
      SupabaseService.findUserById(profile.user_id, { withAvatar: true }),
      getMembershipContext(),
    ]);
    const normalized = normalizeProfile(profile, user, roomSets, req.user.id);
    if (!normalized) {
      return next(new ErrorHandler("Roommate profile not found", 404));
    }

    res.status(200).json({ success: true, profile: normalized });
  } catch (error) {
    next(new ErrorHandler(error.message, 500));
  }
});

module.exports = router;
