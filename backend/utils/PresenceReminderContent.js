/**
 * Professional HTML email template for presence/attendance reminders.
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
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Presence Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f6fa; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #b38604 0%, #d4a017 100%); border-radius: 12px 12px 0 0; padding: 32px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Apartment Bill Tracker</h1>
      <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Attendance Reminder</p>
    </div>

    <!-- Body Card -->
    <div style="background-color: #ffffff; padding: 32px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

      <!-- Greeting -->
      <p style="margin: 0 0 20px; font-size: 15px; color: #333; line-height: 1.6;">
        Dear <strong>${recipientName}</strong>,
      </p>
      <p style="margin: 0 0 24px; font-size: 14px; color: #555; line-height: 1.7;">
        This is a friendly reminder to mark your daily attendance for today in the Apartment Bill Tracker app.
      </p>

      <!-- Date & Room Info -->
      <div style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 16px; background-color: #fdf6e3; text-align: center; border-right: 1px solid #e5e7eb; width: 50%;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Date</p>
              <p style="margin: 0; font-size: 13px; color: #1a1a2e; font-weight: 700;">${todayFormatted}</p>
            </td>
            <td style="padding: 16px; background-color: #fdf6e3; text-align: center; width: 50%;">
              <p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Room</p>
              <p style="margin: 0; font-size: 13px; color: #1a1a2e; font-weight: 700;">${roomName}</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Why It Matters -->
      <div style="background-color: #f9fafb; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px;">
        <p style="margin: 0 0 6px; font-size: 12px; color: #b38604; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Why this matters</p>
        <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.7;">
          Accurate attendance records ensure utility costs are distributed fairly and transparently among all room occupants based on actual occupancy.
        </p>
      </div>

      ${
        customMessage
          ? `
      <!-- Custom Note from Admin -->
      <div style="background-color: #f9fafb; border-left: 3px solid #b38604; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 24px;">
        <p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; font-weight: 700; text-transform: uppercase;">Note from your admin</p>
        <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.6;">${customMessage}</p>
      </div>`
          : ""
      }

      <!-- Disclaimer -->
      <p style="margin: 0 0 24px; font-size: 13px; color: #6b7280; line-height: 1.6;">
        If you have already recorded your attendance for today, please disregard this notice. Should you encounter any issues, contact your room administrator.
      </p>

      <!-- Sign-off -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 8px;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #333;">Best regards,</p>
        <p style="margin: 0; font-size: 14px; color: #b38604; font-weight: 700;">${roomName} Management</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 24px 8px; text-align: center;">
      <p style="margin: 0 0 6px; font-size: 12px; color: #9ca3af;">Apartment Bill Tracker &mdash; Making shared billing simple and transparent</p>
      <p style="margin: 0; font-size: 11px; color: #9ca3af;">&copy; ${new Date().getFullYear()} Apartment Bill Tracker. All rights reserved.</p>
    </div>

  </div>
</body>
</html>`;
};

module.exports = PresenceReminderContent;
