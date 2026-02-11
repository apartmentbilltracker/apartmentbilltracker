const nodemailer = require("nodemailer");

const sendMail = async (options) => {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            host: process.env.SMPT_HOST,
            port: process.env.SMPT_PORT ? Number(process.env.SMPT_PORT) : 465,
            secure: true,
            auth: {
                user: process.env.SMPT_MAIL,
                pass: process.env.SMPT_PASSWORD,
            },
        });

        const mailOptions = {
            from: `"Apartment Bill Tracker" <${process.env.SMPT_MAIL}>`,
            to: options.email,
            subject: options.subject,
            html: options.message,
        };

        await transporter.sendMail(mailOptions);
        console.log("Email sent via Gmail SMTP to", options.email);
    } catch (error) {
        console.error("Email sending error:", error);
        throw error;
    }
};

module.exports = sendMail;