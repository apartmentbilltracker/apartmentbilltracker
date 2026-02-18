/**
 * Professional HTML email template for payment reminders.
 *
 * @param {Object} opts
 * @param {string} opts.recipientName   - Member name
 * @param {string} opts.roomName        - Room name
 * @param {string[]} opts.unpaidBills   - e.g. ["Rent", "Electricity"]
 * @param {string} opts.billingPeriod   - e.g. "January 1, 2026 – January 31, 2026"
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
  const urgencyColor = isOverdue ? "#dc2626" : "#b38604";
  const urgencyLabel = isOverdue
    ? `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`
    : "Due now";

  const billRows = unpaidBills
    .map(
      (bill) => `
        <tr>
          <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${urgencyColor}; margin-right: 10px; vertical-align: middle;"></span>
            <span style="font-size: 14px; color: #1a1a2e; font-weight: 600;">${bill}</span>
          </td>
          <td style="padding: 10px 16px; border-bottom: 1px solid #f0f0f0; text-align: right;">
            <span style="font-size: 12px; color: ${urgencyColor}; font-weight: 700; text-transform: uppercase;">Unpaid</span>
          </td>
        </tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f6fa; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #b38604 0%, #d4a017 100%); border-radius: 12px 12px 0 0; padding: 32px 30px; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">Apartment Bill Tracker</h1>
      <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">Payment Reminder</p>
    </div>

    <!-- Body Card -->
    <div style="background-color: #ffffff; padding: 32px 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">

      <!-- Greeting -->
      <p style="margin: 0 0 20px; font-size: 15px; color: #333; line-height: 1.6;">
        Dear <strong>${recipientName}</strong>,
      </p>
      <p style="margin: 0 0 24px; font-size: 14px; color: #555; line-height: 1.7;">
        This is a formal reminder regarding your outstanding payment for <strong style="color: #1a1a2e;">${roomName}</strong>. Our records indicate that the following bill(s) remain unpaid:
      </p>

      <!-- Unpaid Bills Table -->
      <div style="border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 24px;">
        <div style="background-color: #fafafa; padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
          <span style="font-size: 12px; color: #6b7280; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Outstanding Items</span>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          ${billRows}
        </table>
      </div>

      <!-- Billing Details Strip -->
      <div style="display: flex; border-radius: 10px; overflow: hidden; margin-bottom: 24px; border: 1px solid #e5e7eb;">
        <div style="flex: 1; padding: 16px; background-color: #fdf6e3; text-align: center; border-right: 1px solid #e5e7eb;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Billing Period</p>
          <p style="margin: 0; font-size: 13px; color: #1a1a2e; font-weight: 700;">${billingPeriod}</p>
        </div>
        <div style="flex: 0 0 140px; padding: 16px; background-color: ${isOverdue ? "#fef2f2" : "#fdf6e3"}; text-align: center;">
          <p style="margin: 0 0 4px; font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Status</p>
          <p style="margin: 0; font-size: 13px; color: ${urgencyColor}; font-weight: 700;">${urgencyLabel}</p>
        </div>
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

      <!-- Action Message -->
      <p style="margin: 0 0 8px; font-size: 14px; color: #555; line-height: 1.7;">
        Please settle the above balance at your earliest convenience. Timely payments help maintain quality services for all residents.
      </p>
      <p style="margin: 0 0 24px; font-size: 13px; color: #6b7280; line-height: 1.6;">
        If you have already made this payment, please disregard this notice. For any questions, contact your room administrator.
      </p>

      <!-- Sign-off -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 8px;">
        <p style="margin: 0 0 4px; font-size: 14px; color: #333;">Warm regards,</p>
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

module.exports = PaymentReminderContent;
