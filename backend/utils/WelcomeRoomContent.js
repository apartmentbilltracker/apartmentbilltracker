const {
  emailTheme,
  escapeHtml,
  renderEmailLayout,
} = require("./emailTheme");

const WelcomeRoomContent = ({ userName, roomName, roomCode }) => {
  const safeName = escapeHtml(userName || "there");
  const safeRoomName = escapeHtml(roomName || "your room");
  const safeRoomCode = roomCode ? escapeHtml(roomCode) : null;

  return renderEmailLayout({
    preheader: `Your request to join ${roomName || "your room"} was approved.`,
    eyebrow: "Room Approved",
    title: "Welcome to Your Room",
    footerNote:
      "You received this email because your room join request was approved.",
    children: `
      <p style="margin: 0 0 16px; font-size: 15px; color: ${emailTheme.text}; line-height: 1.6;">Hi <strong>${safeName}</strong>,</p>
      <p style="margin: 0 0 22px; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
        Great news. Your request has been approved, and you are now a member of this room.
      </p>

      <div style="background-color: ${emailTheme.mint}; border: 1px solid #d6ede3; border-radius: 12px; padding: 22px; margin: 0 0 24px; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; color: ${emailTheme.emerald}; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase;">You are now a member of</p>
        <h2 style="margin: 0; color: ${emailTheme.forest}; font-size: 24px; line-height: 1.3;">${safeRoomName}</h2>
        ${
          safeRoomCode
            ? `<p style="margin: 12px 0 0; font-size: 13px; color: ${emailTheme.textSecondary};">Room Code: <strong style="color: ${emailTheme.emerald}; letter-spacing: 2px;">${safeRoomCode}</strong></p>`
            : ""
        }
      </div>

      <p style="margin: 0 0 12px; font-size: 13px; color: ${emailTheme.forest}; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">What you can do now</p>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
        <tr>
          <td style="padding: 12px 14px; background-color: ${emailTheme.background}; border: 1px solid ${emailTheme.borderLight}; border-radius: 8px;">
            <strong style="color: ${emailTheme.text};">View bills</strong><br />
            <span style="font-size: 13px; color: ${emailTheme.textSecondary};">See shared bills and your share of expenses.</span>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px 14px; background-color: ${emailTheme.background}; border: 1px solid ${emailTheme.borderLight}; border-radius: 8px;">
            <strong style="color: ${emailTheme.text};">Make payments</strong><br />
            <span style="font-size: 13px; color: ${emailTheme.textSecondary};">Track and submit payments from the app.</span>
          </td>
        </tr>
        <tr><td style="height: 8px;"></td></tr>
        <tr>
          <td style="padding: 12px 14px; background-color: ${emailTheme.background}; border: 1px solid ${emailTheme.borderLight}; border-radius: 8px;">
            <strong style="color: ${emailTheme.text};">Stay updated</strong><br />
            <span style="font-size: 13px; color: ${emailTheme.textSecondary};">Receive announcements and room notifications.</span>
          </td>
        </tr>
      </table>

      <p style="margin: 0 0 20px; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
        Open the PropFlow app to explore your room and get started.
      </p>
      <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.6;">
        Best regards,<br /><strong style="color: ${emailTheme.emerald};">PropFlow Team</strong>
      </p>
    `,
  });
};

module.exports = WelcomeRoomContent;
