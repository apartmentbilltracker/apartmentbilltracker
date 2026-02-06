const ActivationContent = ({ userName, activationCode }) => {
  return `
      <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; color: #333;">
        <!-- Preheader and Header -->
        <div style="text-align: center; padding: 20px 0; font-size: 12px; color: #888;">
            Verify your Apartment Bill Tracker account!
        </div>
        <div style="background-color: #b38604; padding: 30px 0; text-align: center;">
            <h2 style="color: white; margin: 0;">Apartment Bill Tracker</h2>
        </div>
  
        <!-- Main Content -->
        <div style="background-color: #ffffff; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h1 style="color: #b38604;">Hello ${userName}!</h1>
            <p style="text-align: left; color: #333;">Thank you for signing up for Apartment Bill Tracker. To complete your account registration, please enter the following 6-digit verification code:</p>
            
            <div style="font-size: 28px; font-weight: bold; background: #f3f3f3; padding: 15px 25px; display: inline-block; border-radius: 5px; margin: 20px 0; letter-spacing: 5px;">
                ${activationCode}
            </div>
            
            <p style="text-align: left; color: #333;"><strong>This code will expire in 15 minutes.</strong></p>
            <p style="text-align: left; color: #333;">If you did not create an account with us, please ignore this email or contact support.</p>
            <p style="text-align: left; color: #333;">If you have any questions, please reply to this email.</p>
            <p style="text-align: left; color: #333; font-weight: bold;">Best regards,<br>Apartment Bill Tracker Team</p>
        </div>
  
        <!-- Help Section -->
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333;">Need help?</h3>
            <p><a href="mailto:support@apartmentbilltracker.com" style="color: #b38604; text-decoration: underline;">Contact our support team</a></p>
        </div>
  
        <!-- Footer -->
        <div style="font-size: 12px; text-align: left; color: #888; padding: 20px;">
            <p style="color: #888;">Apartment Bill Tracker - Making shared billing simple and transparent</p>
            <p style="color: #888;">You received this email because an account was registered with this email address. If this wasn't you, please disregard this message.</p>
            <p style="color: #888;">© 2026 Apartment Bill Tracker. All rights reserved.</p>
        </div>
      </div>
    `;
};

module.exports = ActivationContent;
