/**
 * Supabase Storage helpers for avatar management.
 *
 * Why: Storing avatars as base64 in the `users` DB column costs 2–5 MB of
 * Supabase egress PER REQUEST that reads the column.  Moving them to Storage
 * means the DB row only stores a tiny public URL, and the image itself is
 * served by Supabase's CDN — completely separate from DB egress.
 */

const supabase = require("../db/SupabaseClient");

const BUCKET = "avatars";

// One-time bucket-ready check (idempotent — safe to call many times).
let _bucketReady = false;

async function ensureBucket() {
  if (_bucketReady) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true, // Images are served without authentication
    fileSizeLimit: 5 * 1024 * 1024, // 5 MB max per avatar
  });
  // "already exists" is not an error — bucket was created earlier.
  if (error && !error.message.toLowerCase().includes("already exists")) {
    throw new Error(`Storage bucket setup failed: ${error.message}`);
  }
  _bucketReady = true;
}

/**
 * Upload an avatar image to Supabase Storage.
 *
 * @param {string} userId      - User ID used as the folder name.
 * @param {string} base64Input - Full data URL ("data:image/jpeg;base64,...")
 *                               OR raw base64 string (assumed jpeg).
 * @returns {Promise<string>}  Public CDN URL of the uploaded image.
 */
async function uploadAvatarToStorage(userId, base64Input) {
  await ensureBucket();

  // Normalise to a full data URL.
  const dataUrl = base64Input.startsWith("data:image")
    ? base64Input
    : `data:image/jpeg;base64,${base64Input}`;

  const match = dataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/s);
  if (!match) throw new Error("Invalid image data URL format");

  const contentType = match[1]; // e.g. "image/jpeg"
  const rawBase64 = match[2];
  const buffer = Buffer.from(rawBase64, "base64");

  // Use a stable path so repeated uploads overwrite the previous avatar.
  const ext = contentType.split("/")[1]?.replace("+xml", "") || "jpg";
  const filePath = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, { contentType, upsert: true });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Delete a user's avatar from Storage (called when account is deleted).
 *
 * @param {string} userId - User ID.
 * @param {string} ext    - File extension of the stored avatar (default "jpg").
 */
async function deleteAvatarFromStorage(userId, ext = "jpg") {
  await supabase.storage
    .from(BUCKET)
    .remove([`${userId}/avatar.${ext}`, `${userId}/avatar.jpeg`]);
}

module.exports = { uploadAvatarToStorage, deleteAvatarFromStorage };
