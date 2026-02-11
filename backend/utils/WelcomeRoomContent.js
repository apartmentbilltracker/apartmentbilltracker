const WelcomeRoomContent = ({ userName, roomName, roomCode }) => {
  return `
      <div style="max-width: 600px; margin: auto; font-family: Arial, sans-serif; color: #333;">
        <!-- Preheader and Header -->
        <div style="text-align: center; padding: 20px 0; font-size: 12px; color: #888;">
            Welcome to ${roomName}!
        </div>
        <div style="background-color: #b38604; padding: 30px 0; text-align: center;">
            <h2 style="color: white; margin: 0;">Apartment Bill Tracker</h2>
        </div>
  
        <!-- Main Content -->
        <div style="background-color: #ffffff; padding: 30px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <h1 style="color: #b38604; margin-bottom: 5px;">Welcome, ${userName}!</h1>
            <p style="font-size: 16px; color: #555; margin-top: 0;">Your request has been approved</p>

            <div style="background: linear-gradient(135deg, #fdf6e3 0%, #fff8e7 100%); padding: 25px; border-radius: 10px; margin: 25px 0; border: 1px solid #e8d5a3;">
                <p style="margin: 0 0 8px 0; font-size: 14px; color: #888; text-transform: uppercase; letter-spacing: 1px;">You are now a member of</p>
                <h2 style="margin: 0; color: #1a1a2e; font-size: 24px;">${roomName}</h2>
                ${roomCode ? `<p style="margin: 10px 0 0 0; font-size: 13px; color: #999;">Room Code: <strong style="color: #b38604; letter-spacing: 2px;">${roomCode}</strong></p>` : ""}
            </div>

            <div style="text-align: left; margin: 25px 0;">
                <h3 style="color: #b38604; margin-bottom: 15px;">What you can do now:</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 10px 15px; background: #f9f9f9; border-radius: 6px; margin-bottom: 8px;">
                            <span style="font-size: 18px; margin-right: 10px;">📊</span>
                            <strong>View Bills</strong> — See all shared bills and your share of expenses
                        </td>
                    </tr>
                    <tr><td style="height: 8px;"></td></tr>
                    <tr>
                        <td style="padding: 10px 15px; background: #f9f9f9; border-radius: 6px;">
                            <span style="font-size: 18px; margin-right: 10px;">💳</span>
                            <strong>Make Payments</strong> — Track and submit your payments easily
                        </td>
                    </tr>
                    <tr><td style="height: 8px;"></td></tr>
                    <tr>
                        <td style="padding: 10px 15px; background: #f9f9f9; border-radius: 6px;">
                            <span style="font-size: 18px; margin-right: 10px;">📢</span>
                            <strong>Stay Updated</strong> — Receive announcements and notifications from your room admin
                        </td>
                    </tr>
                    <tr><td style="height: 8px;"></td></tr>
                    <tr>
                        <td style="padding: 10px 15px; background: #f9f9f9; border-radius: 6px;">
                            <span style="font-size: 18px; margin-right: 10px;">👥</span>
                            <strong>Connect</strong> — Collaborate with your fellow room members
                        </td>
                    </tr>
                </table>
            </div>

            <p style="text-align: left; color: #333;">Open the Apartment Bill Tracker app to get started and explore your new room.</p>
            <p style="text-align: left; color: #333; font-weight: bold;">Best regards,<br>Apartment Bill Tracker Team</p>
        </div>
  
        <!-- Help Section -->
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333;">Need help?</h3>
            <p>If you have any questions about your room or billing, contact your room admin or <a href="mailto:support@apartmentbilltracker.com" style="color: #b38604; text-decoration: underline;">reach out to our support team</a>.</p>
        </div>
  
        <!-- Footer -->
        <div style="font-size: 12px; text-align: left; color: #888; padding: 20px;">
            <p style="color: #888;">Apartment Bill Tracker - Making shared billing simple and transparent</p>
            <p style="color: #888;">You received this email because your room join request was approved. If this wasn't you, please contact support.</p>
            <p style="color: #888;">© 2026 Apartment Bill Tracker. All rights reserved.</p>
        </div>
      </div>
    `;
};

module.exports = WelcomeRoomContent;
