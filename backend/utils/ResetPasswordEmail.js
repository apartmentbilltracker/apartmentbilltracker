const ResetPasswordEmail = ({ userName, activationCode }) => {
  return `
      <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; color: #333;">
        <!-- Preheader and Header -->
        <div style="text-align: center; padding: 20px 0; font-size: 12px; color: #888;">
            Reset your Shopee account password!
        </div>
        <div style="background-color: #ee4d2d; padding: 30px 0; text-align: center;">
            <img src="https://drive.google.com/uc?export=view&id=1l62BBi4CS8sfOZUAAcbTjhQs3tmalfHE" alt="Logo" style="height: 50px;">
        </div>
  
        <!-- Main Content -->
        <div style="background-color: #ffffff; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #ee4d2d;">Hello ${userName}!</h1>
            <p style="text-align: left; color: #333;">Thank you for using Shopee Philippines. To reset your password, please enter the following 6-digit verification code:</p>
            
            <div style="font-size: 24px; font-weight: bold; background: #f3f3f3; padding: 10px 20px; display: inline-block; border-radius: 5px; margin: 15px 0;">
                ${activationCode}
            </div>
            
            <p style="text-align: left; color: #333;">If you did not initiate change password, please report this as an Incident.</p>
            <p style="text-align: left; color: #333;">If you have any questions, just reply to this email, we’re always happy to help out.</p>
            <p style="text-align: left; color: #333; font-weight: semi-bold;">Cheers,<br>Shopee Philippines</p>
        </div>
  
        <!-- Help Section -->
        <div style="background-color: #e0907f; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #ce0000;">Need help?</h3>
            <p><a href="HELP_LINK" style="color: #ce0000; text-decoration: underline;">We’re here, ready to assist you</a></p>
        </div>
  
        <!-- Footer -->
        <div style="font-size: 12px; text-align: left; color: #888; padding: 20px;">
            <p><a href="DASHBOARD_LINK" style="color: #888; text-decoration: none;">Shopee Ph</a> &bull; <a href="HELP_LINK" style="color: #888; text-decoration: none;">Help</a></p>
            <p style="color: #888;">You received this email because you initiate reset password for this account. If this wasn't you, you can ignore this message.</p>
            <p style="color: #888;">If these emails become unnecessary, you can <a href="UNSUBSCRIBE_LINK" style="color: #000; text-decoration: underline;">unsubscribe</a>.</p>
            <p>Shopee Philippines - 1234 Main Street - Anywhere, MA - 56789</p>
        </div>
      </div>
    `;
};

module.exports = ResetPasswordEmail;
