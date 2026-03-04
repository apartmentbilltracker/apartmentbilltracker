/**
 * One-time migration: move base64 avatars from the `users.avatar` DB column
 * into Supabase Storage and replace column values with public CDN URLs.
 *
 * Run once:
 *   node migrate-avatars.js
 *
 * Safe to re-run — users who already have a Storage URL (or no avatar) are
 * skipped automatically.
 *
 * After this script finishes successfully:
 *   1. Every avatar URL in the DB starts with "https://".
 *   2. Change `/me` and `/getuser` in user-supabase.js from
 *        withAvatar: false  →  withAvatar: true
 *      to include the tiny URL string in every profile response.
 *   3. Optionally update profile screen getAvatarSource() to use
 *      user.avatar?.url directly (already handled by fallback logic).
 */

require("dotenv").config({ path: "./config/.env" });

const supabase = require("./db/SupabaseClient");
const SupabaseService = require("./db/SupabaseService");
const { uploadAvatarToStorage } = require("./utils/supabaseStorage");

// ─── colours for terminal output ────────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

async function migrateAvatars() {
  console.log(`\n${c.cyan}🔄 Avatar Migration — Supabase Storage${c.reset}`);
  console.log("─".repeat(50));

  // Fetch all users that have a non-null avatar column.
  const { data: users, error } = await supabase
    .from("users")
    .select("id, email, name, avatar")
    .not("avatar", "is", null);

  if (error) {
    console.error(`${c.red}❌ Failed to fetch users:${c.reset}`, error.message);
    process.exit(1);
  }

  console.log(`Found ${users.length} users with avatar data.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const label = `${user.email || user.id}`;

    // Parse the stored avatar JSON.
    let avatarData;
    try {
      avatarData =
        typeof user.avatar === "string" ? JSON.parse(user.avatar) : user.avatar;
    } catch {
      console.warn(
        `  ${c.yellow}⚠  ${label}: could not parse avatar JSON — skipped${c.reset}`,
      );
      skipped++;
      continue;
    }

    if (!avatarData?.url) {
      console.log(
        `  ${c.dim}–  ${label}: no URL in avatar object — skipped${c.reset}`,
      );
      skipped++;
      continue;
    }

    // Already a public Storage / external URL — nothing to do.
    if (avatarData.url.startsWith("http")) {
      console.log(`  ${c.green}✓  ${label}: already a URL — skipped${c.reset}`);
      skipped++;
      continue;
    }

    // It's a base64 data URL — upload to Storage.
    try {
      process.stdout.write(`  📤 ${label}: uploading...`);

      const publicUrl = await uploadAvatarToStorage(user.id, avatarData.url);

      await SupabaseService.updateUser(user.id, {
        avatar: JSON.stringify({ public_id: "user_avatar", url: publicUrl }),
      });

      const shortUrl =
        publicUrl.length > 70 ? publicUrl.slice(0, 67) + "..." : publicUrl;
      console.log(` ${c.green}✅ ${shortUrl}${c.reset}`);
      migrated++;
    } catch (err) {
      console.log(` ${c.red}❌ FAILED: ${err.message}${c.reset}`);
      failed++;
    }
  }

  console.log("\n" + "─".repeat(50));
  console.log(
    `${c.green}✅ Migrated: ${migrated}${c.reset}  ` +
      `${c.dim}Skipped: ${skipped}${c.reset}  ` +
      `${failed > 0 ? c.red : c.dim}Failed: ${failed}${failed > 0 ? c.reset : c.reset}`,
  );

  if (migrated > 0) {
    console.log(`
${c.cyan}Next steps:${c.reset}
  1. In backend/controller/user-supabase.js, update both the /me and /getuser
     endpoints — change  ${c.yellow}withAvatar: false${c.reset}  to  ${c.green}withAvatar: true${c.reset}
     (avatar column now only contains a tiny URL string, not a base64 blob).
  2. Restart the backend.
  3. Profile screens will now receive the avatar URL directly in every
     /getuser response, skipping the /avatar-image/:email hop entirely.
`);
  }

  if (failed > 0) {
    console.log(
      `${c.yellow}⚠  Some avatars failed to migrate. Safe to re-run — already-migrated` +
        ` users are skipped.${c.reset}`,
    );
  }
}

migrateAvatars().catch((err) => {
  console.error(`${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
