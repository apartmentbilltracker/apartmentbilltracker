const ActivationContent = ({ userName, activationCode }) => {
  return `
      <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; color: #333;">
        <div style="background-color: #ffffff; padding: 30px; border-radius: 8px;">
            <h2 style="color: #b38604; margin-top: 0;">Apartment Bill Tracker</h2>
            <p>Hi ${userName},</p>
            <p>Your verification code is:</p>
            
            <div style="font-size: 28px; font-weight: bold; background: #f3f3f3; padding: 15px 25px; display: inline-block; border-radius: 5px; margin: 15px 0; letter-spacing: 5px;">
                ${activationCode}
            </div>
            
            <p>This code expires in 15 minutes.</p>
            <p>If you did not create an account, please ignore this email.</p>
            <p>Best regards,<br>Apartment Bill Tracker</p>
        </div>
      </div>
    `;
};

module.exports = ActivationContent;
