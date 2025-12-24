const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT || 587),
  secure: false, // BẮT BUỘC false với port 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // APP PASSWORD
  },
});

// Verify SMTP ngay khi khởi động
transporter.verify((err) => {
  if (err) {
    console.error("❌ SMTP VERIFY FAILED:", err.message);
  } else {
    console.log("✅ Gmail SMTP ready");
  }
});

async function sendSupportMail({ from, subject, message }) {
  return transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // gửi cho admin
    replyTo: from,
    subject: `[Support] ${subject || "No subject"}`,
    text: `
Email người gửi: ${from}

Nội dung:
${message}
    `,
  });
}

module.exports = {
  sendSupportMail,
};
