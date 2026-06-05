const {
  emailTheme,
  escapeHtml,
  formatPhp,
  nl2br,
  renderEmailLayout,
} = require("./emailTheme");

const PaymentStatusEmail = ({
  userName,
  status,
  billType,
  amount,
  note,
  reason,
}) => {
  const isVerified = status === "completed";
  const statusColor = isVerified ? emailTheme.emerald : emailTheme.error;
  const statusBg = isVerified ? emailTheme.mintStrong : emailTheme.errorBg;
  const headline = isVerified ? "Payment Verified" : "Payment Rejected";
  const detail = isVerified
    ? "Your payment has been verified and confirmed by your host."
    : "Your payment was rejected by your host. Please resubmit your payment with the correct details.";
  const adminNote = isVerified ? note : reason;

  return renderEmailLayout({
    preheader: `${headline} for your ${billType || "bill"} payment.`,
    eyebrow: "Payment Status",
    title: headline,
    footerNote:
      "You received this email because your room host updated a payment status.",
    children: `
      <p style="margin: 0 0 16px; font-size: 15px; color: ${emailTheme.text}; line-height: 1.6;">Hi <strong>${escapeHtml(userName || "Resident")}</strong>,</p>
      <p style="margin: 0 0 22px; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
        ${escapeHtml(detail)}
      </p>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 22px;">
        <tr>
          <td style="padding: 16px; background-color: ${emailTheme.mint}; border: 1px solid ${emailTheme.borderLight}; border-radius: 10px 0 0 10px; text-align: center; width: 50%;">
            <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px;">Bill Type</p>
            <p style="margin: 0; font-size: 13px; color: ${emailTheme.text}; font-weight: 800;">${escapeHtml((billType || "Bill").toUpperCase())}</p>
          </td>
          <td style="padding: 16px; background-color: ${statusBg}; border: 1px solid ${emailTheme.borderLight}; border-left: 0; border-radius: 0 10px 10px 0; text-align: center; width: 50%;">
            <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; text-transform: uppercase; letter-spacing: 0.5px;">Amount</p>
            <p style="margin: 0; font-size: 13px; color: ${statusColor}; font-weight: 800;">${formatPhp(amount)}</p>
          </td>
        </tr>
      </table>

      ${
        adminNote
          ? `
      <div style="background-color: ${emailTheme.background}; border-left: 4px solid ${statusColor}; border-radius: 0 8px 8px 0; padding: 14px 16px; margin-bottom: 22px;">
        <p style="margin: 0 0 4px; font-size: 11px; color: ${emailTheme.textTertiary}; font-weight: 800; text-transform: uppercase;">${isVerified ? "Note from your host" : "Reason from your host"}</p>
        <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.6;">${nl2br(adminNote)}</p>
      </div>`
          : ""
      }

      <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.6;">
        You can review the payment details in the PropFlow app.
      </p>
    `,
  });
};

module.exports = PaymentStatusEmail;
