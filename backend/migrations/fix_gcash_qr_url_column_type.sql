-- Fix gcash_qr_url column type: change from varchar to text
-- to prevent truncation of base64-encoded QR code images.
-- Base64 data URIs for images can be 50K-200K+ characters.

ALTER TABLE app_settings
ALTER COLUMN gcash_qr_url TYPE text;
