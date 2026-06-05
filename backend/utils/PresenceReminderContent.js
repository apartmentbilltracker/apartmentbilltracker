const {
  emailTheme,
  escapeHtml,
  nl2br,
  renderEmailLayout,
} = require("./emailTheme");

/**
 * Forest-themed HTML email template for presence/attendance reminders.
 *
 * @param {Object} opts
 * @param {string} opts.recipientName  - Member name
 * @param {string} opts.roomName       - Room name
 * @param {string} opts.todayFormatted - e.g. "Monday, February 18, 2026"
 * @param {string} [opts.customMessage] - Optional extra note from admin
 */
const PresenceReminderContent = ({
  recipientName,
  roomName,
  todayFormatted,
  customMessage,
}) => {
  return renderEmailLayout({
    preheader: "Remember to record today's attendance in PropFlow.",
    eyebrow: "Attendance Reminder",
    title: "Mark Today's Presence",
    footerNote:
      "You received this email because your room admin sent an attendance reminder.",
    children: `
      <p style="margin: 0 0 16px; font-size: 15px; color: ${emailTheme.text}; line-height: 1.6;">Dear <strong>${escapeHtml(recipientName || "Resident")}</strong>,</p>
      <p style="margin: 0 0 22px; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
        This is a friendly reminder to mark your daily attendance in the PropFlow app.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
        <tr>
          <td style="padding: 16px; background-color: ${emailTheme.mint}; border: 1px solid ${emailTheme.borderLight}; border-radius: 10px 0 0 10px; text-align: center; width: 50%;">
            <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px;">Date</p>
            <p style="margin: 0; font-size: 13px; color: ${emailTheme.text}; font-weight: 700;">${escapeHtml(todayFormatted || "Today")}</p>
          </td>
          <td style="padding: 16px; background-color: ${emailTheme.mint}; border: 1px solid ${emailTheme.borderLight}; border-left: 0; border-radius: 0 10px 10px 0; text-align: center; width: 50%;">
            <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px;">Room</p>
            <p style="margin: 0; font-size: 13px; color: ${emailTheme.text}; font-weight: 700;">${escapeHtml(roomName || "Your room")}</p>
          </td>
        </tr>
      </table>

      <div style="background-color: ${emailTheme.background}; border: 1px solid ${emailTheme.borderLight}; border-radius: 10px; padding: 18px 20px; margin-bottom: 22px;">
        <p style="margin: 0 0 6px; font-size: 12px; color: ${emailTheme.emerald}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Why this matters</p>
        <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
          Accurate attendance records help distribute shared utility costs fairly and transparently among room occupants.
        </p>
      </div>

      ${
        customMessage
          ? `
      <div style="background-color: ${emailTheme.background}; border-left: 4px solid ${emailTheme.emerald}; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 22px;">
        <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; font-weight: 800; text-transform: uppercase;">Note from your admin</p>
        <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.6;">${nl2br(customMessage)}</p>
      </div>`
          : ""
      }

      <p style="margin: 0 0 22px; font-size: 13px; color: ${emailTheme.textTertiary}; line-height: 1.6;">
        If you have already recorded your attendance for today, please disregard this notice.
      </p>

      <div style="border-top: 1px solid ${emailTheme.borderLight}; padding-top: 18px;">
        <p style="margin: 0 0 4px; font-size: 14px; color: ${emailTheme.textSecondary};">Best regards,</p>
        <p style="margin: 0; font-size: 14px; color: ${emailTheme.emerald}; font-weight: 800;">${escapeHtml(roomName || "Room")} Management</p>
      </div>
    `,
  });
};

module.exports = PresenceReminderContent;
