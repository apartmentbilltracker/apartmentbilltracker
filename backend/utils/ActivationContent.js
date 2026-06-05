const {
  emailTheme,
  escapeHtml,
  renderCodeBlock,
  renderEmailLayout,
} = require("./emailTheme");

const ActivationContent = ({ userName, activationCode }) => {
  const safeName = escapeHtml(userName || "there");

  return renderEmailLayout({
    preheader: "Use this 6-digit code to finish creating your PropFlow account.",
    eyebrow: "Account Verification",
    title: "Verify Your Email",
    footerNote:
      "You received this email because a PropFlow account was created with this address.",
    children: `
      <p style="margin: 0 0 16px; font-size: 15px; color: ${emailTheme.text}; line-height: 1.6;">Hi <strong>${safeName}</strong>,</p>
      <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.7;">
        Welcome to PropFlow. Enter the verification code below to finish setting up your account.
      </p>
      ${renderCodeBlock(activationCode)}
      <div style="background-color: ${emailTheme.mint}; border: 1px solid #d6ede3; border-radius: 10px; padding: 14px 16px; margin: 0 0 22px;">
        <p style="margin: 0; font-size: 13px; color: ${emailTheme.forest}; line-height: 1.6;">
          This code expires in 15 minutes. If you did not create an account, you can safely ignore this email.
        </p>
      </div>
      <p style="margin: 0; font-size: 14px; color: ${emailTheme.textSecondary}; line-height: 1.6;">
        Best regards,<br /><strong style="color: ${emailTheme.emerald};">PropFlow Team</strong>
      </p>
    `,
  });
};

module.exports = ActivationContent;
