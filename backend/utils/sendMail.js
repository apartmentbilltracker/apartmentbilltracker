const nodemailer = require("nodemailer");
let sendgrid = null;
if (process.env.SENDGRID_API_KEY) {
    try {
        sendgrid = require("@sendgrid/mail");
        sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
    } catch (e) {
        console.warn("@sendgrid/mail not installed or failed to load; SendGrid disabled");
        sendgrid = null;
    }
}

const sendMail = async (options) => {
    // Prefer SendGrid if configured
    if (process.env.SENDGRID_API_KEY && sendgrid) {
        try {
            const msg = {
                to: options.email,
                from: process.env.SENDGRID_FROM_EMAIL || process.env.SMPT_MAIL,
                subject: options.subject,
                html: options.message,
            };
            await sendgrid.send(msg);
            console.log("Email sent via SendGrid to", options.email);
            return;
        } catch (sgErr) {
            console.error("SendGrid send error:", sgErr);
            // fall through to SMTP fallback
        }
    }

    // SMTP fallback
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMPT_HOST,
            port: process.env.SMPT_PORT ? Number(process.env.SMPT_PORT) : undefined,
            secure: process.env.SMPT_PORT == 465, // true for 465, false for other ports
            auth: {
                user: process.env.SMPT_MAIL,
                pass: process.env.SMPT_PASSWORD,
            },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
        });

        const mailOptions = {
            from: process.env.SMPT_MAIL,
            to: options.email,
            subject: options.subject,
            html: options.message,
        };

        await transporter.sendMail(mailOptions);
        console.log("Email sent via SMTP to", options.email);
    } catch (error) {
        console.error("Email sending error:", error);
        throw error;
    }
};

module.exports = sendMail;