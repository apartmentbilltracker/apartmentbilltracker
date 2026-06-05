const emailTheme = {
  background: "#f8f9ff",
  surface: "#ffffff",
  forest: "#002b29",
  forestMid: "#0a4240",
  emerald: "#036d41",
  emeraldDark: "#025535",
  mint: "#e8f5ef",
  mintStrong: "#d6ede3",
  tealMist: "#b9ece9",
  text: "#0b1c30",
  textSecondary: "#404848",
  textTertiary: "#707978",
  border: "#c0c8c7",
  borderLight: "#eef3f2",
  error: "#ba1a1a",
  errorBg: "#ffdad6",
  warning: "#7a5900",
  warningBg: "#fff3e0",
};

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const nl2br = (value = "") => escapeHtml(value).replace(/\r?\n/g, "<br />");

const formatPhp = (amount) => `PHP ${Number(amount || 0).toFixed(2)}`;

const renderEmailLayout = ({
  preheader,
  title,
  eyebrow,
  children,
  footerNote,
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title || "PropFlow")}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${emailTheme.background}; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; color: transparent;">
    ${escapeHtml(preheader || title || "PropFlow notification")}
  </div>
  <div style="max-width: 600px; margin: 0 auto; padding: 24px 16px;">
    <div style="background: linear-gradient(135deg, ${emailTheme.forest} 0%, ${emailTheme.forestMid} 55%, ${emailTheme.emerald} 100%); border-radius: 12px 12px 0 0; padding: 28px 24px; text-align: center;">
      <p style="margin: 0 0 8px; color: #9ed0cd; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">${escapeHtml(eyebrow || "PropFlow")}</p>
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; line-height: 1.3;">${escapeHtml(title || "PropFlow")}</h1>
    </div>
    <div style="background-color: ${emailTheme.surface}; padding: 28px 24px; border: 1px solid ${emailTheme.borderLight}; border-top: 0; border-radius: 0 0 12px 12px; box-shadow: 0 10px 28px rgba(10, 66, 64, 0.10);">
      ${children}
    </div>
    <div style="padding: 24px 8px 0; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 12px; color: ${emailTheme.textTertiary};">PropFlow - Making shared billing simple and transparent</p>
      ${
        footerNote
          ? `<p style="margin: 0 0 6px; font-size: 11px; color: ${emailTheme.textTertiary}; line-height: 1.5;">${escapeHtml(footerNote)}</p>`
          : ""
      }
      <p style="margin: 0; font-size: 11px; color: ${emailTheme.textTertiary};">&copy; ${new Date().getFullYear()} PropFlow. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

const renderCodeBlock = (code) => `
  <div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; padding: 16px 24px; border-radius: 10px; background-color: ${emailTheme.mintStrong}; border: 1px solid #b3dece; color: ${emailTheme.forest}; font-size: 30px; font-weight: 800; letter-spacing: 6px;">
      ${escapeHtml(code)}
    </div>
  </div>`;

module.exports = {
  emailTheme,
  escapeHtml,
  formatPhp,
  nl2br,
  renderCodeBlock,
  renderEmailLayout,
};
