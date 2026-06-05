const {
  emailTheme,
  escapeHtml,
  nl2br,
  renderEmailLayout,
} = require("./emailTheme");

/**
 * Plain-text notification content for in-app display.
 *
 * @param {Object} opts
 * @param {string} opts.recipientName   - Member name
 * @param {string} opts.roomName        - Room name
 * @param {string[]} opts.unpaidBills   - e.g. ["Rent", "Electricity"]
 * @param {string} opts.billingPeriod   - e.g. "January 1, 2026 - January 31, 2026"
 * @param {number} opts.daysOverdue     - Negative or zero means "due now"
 * @param {string} [opts.customMessage] - Optional extra note from admin
 */
const PaymentReminderTextContent = ({
  recipientName,
  roomName,
  unpaidBills = [],
  billingPeriod,
  daysOverdue,
  customMessage,
}) => {
  const isOverdue = daysOverdue > 0;
  const urgencyLabel = isOverdue
    ? `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`
    : "Due now";

  const billsList = unpaidBills.join(", ");

  let text = `Payment Reminder for ${roomName}\n\n`;
  text += `Dear ${recipientName},\n\n`;
  text += "You have outstanding payment(s) that need your attention:\n\n";
  text += `Unpaid Bills: ${billsList}\n`;
  text += `Billing Period: ${billingPeriod}\n`;
  text += `Status: ${urgencyLabel}\n\n`;

  if (customMessage) {
    text += `Note from admin:\n${customMessage}\n\n`;
  }

  text += "Please settle the above balance at your earliest convenience.\n";
  text += "If you have already made this payment, please disregard this notice.\n\n";
  text += `Regards,\n${roomName} Management`;

  return text;
};

/**
 * Forest-themed HTML email template for payment reminders.
 *
 * @param {Object} opts
 * @param {string} opts.recipientName   - Member name
 * @param {string} opts.roomName        - Room name
 * @param {string[]} opts.unpaidBills   - e.g. ["Rent", "Electricity"]
 * @param {string} opts.billingPeriod   - e.g. "January 1, 2026 - January 31, 2026"
 * @param {number} opts.daysOverdue     - Negative or zero means "due now"
 * @param {string} [opts.customMessage] - Optional extra note from admin
 */
const PaymentReminderContent = ({
  recipientName,
  roomName,
  unpaidBills = [],
  billingPeriod,
  daysOverdue,
  customMessage,
}) => {
  const isOverdue = daysOverdue > 0;
  const statusColor = isOverdue ? emailTheme.error : emailTheme.emerald;
  const statusBg = isOverdue ? emailTheme.errorBg : emailTheme.mintStrong;
  const urgencyLabel = isOverdue
    ? `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`
    : "Due now";

  const billRows = unpaidBills
    .map(
      (bill) => `
        <tr>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${emailTheme.borderLight};">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${statusColor}; margin-right: 10px; vertical-align: middle;"></span>
            <span style="font-size: 14px; color: ${emailTheme.text}; font-weight: 700;">${escapeHtml(bill)}</span>
          </td>
          <td style="padding: 12px 16px; border-bottom: 1px solid ${emailTheme.borderLight}; text-align: right;">
            <span style="font-size: 12px; color: ${statusColor}; font-weight: 800; text-transform: uppercase;">Unpaid</span>
          </td>
        </tr>`,
    )
    .join("");

  return renderEmailLayout({
    preheader: `Outstanding payment reminder for ${roomName || "your room"}.`,
    eyebrow: "Payment Reminder",
    title: "Outstanding Payment",
    footerNote:
      "You received this email because your room admin sent a payment reminder.",
    children: `
      <p style="margin: 0 0 16px; font-size: 15px; color: ${emailTheme.text}; line-height: 1.6;">Dear <strong>${escapeHtml(recipientName || "Resident")}</strong>,</p>
      <p style="margin: 0 0 22px; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
        This is a reminder regarding outstanding payment item(s) for <strong style="color: ${emailTheme.forest};">${escapeHtml(roomName || "your room")}</strong>.
      </p>

      <div style="border: 1px solid ${emailTheme.border}; border-radius: 10px; overflow: hidden; margin-bottom: 22px;">
        <div style="background-color: ${emailTheme.mint}; padding: 12px 16px; border-bottom: 1px solid ${emailTheme.border};">
          <span style="font-size: 12px; color: ${emailTheme.forest}; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Outstanding Items</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${
            billRows ||
            `<tr><td style="padding: 14px 16px; color: ${emailTheme.textSecondary}; font-size: 14px;">No bill details were provided.</td></tr>`
          }
        </table>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
        <tr>
          <td style="padding: 16px; background-color: ${emailTheme.mint}; border: 1px solid ${emailTheme.borderLight}; border-radius: 10px 0 0 10px; text-align: center; width: 60%;">
            <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px;">Billing Period</p>
            <p style="margin: 0; font-size: 13px; color: ${emailTheme.text}; font-weight: 700;">${escapeHtml(billingPeriod || "Current billing period")}</p>
          </td>
          <td style="padding: 16px; background-color: ${statusBg}; border: 1px solid ${emailTheme.borderLight}; border-left: 0; border-radius: 0 10px 10px 0; text-align: center;">
            <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px;">Status</p>
            <p style="margin: 0; font-size: 13px; color: ${statusColor}; font-weight: 800;">${escapeHtml(urgencyLabel)}</p>
          </td>
        </tr>
      </table>

      ${
        customMessage
          ? `
      <div style="background-color: ${emailTheme.background}; border-left: 4px solid ${emailTheme.emerald}; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 22px;">
        <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; font-weight: 800; text-transform: uppercase;">Note from your admin</p>
        <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.6;">${nl2br(customMessage)}</p>
      </div>`
          : ""
      }

      <p style="margin: 0 0 8px; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
        Please settle the above balance at your earliest convenience. Timely payments help keep shared bills transparent for everyone.
      </p>
      <p style="margin: 0 0 22px; font-size: 13px; color: ${emailTheme.textTertiary}; line-height: 1.6;">
        If you have already made this payment, please disregard this notice.
      </p>

      <div style="border-top: 1px solid ${emailTheme.borderLight}; padding-top: 18px;">
        <p style="margin: 0 0 4px; font-size: 14px; color: ${emailTheme.textSecondary};">Regards,</p>
        <p style="margin: 0; font-size: 14px; color: ${emailTheme.emerald}; font-weight: 800;">${escapeHtml(roomName || "Room")} Management</p>
      </div>
    `,
  });
};

module.exports = PaymentReminderContent;
module.exports.PaymentReminderTextContent = PaymentReminderTextContent;
