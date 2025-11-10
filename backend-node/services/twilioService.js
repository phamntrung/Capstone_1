const twilio = require('twilio');

// Lấy credentials từ .env
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let client = null;

// Khởi tạo Twilio client
if (accountSid && authToken) {
  try {
    client = twilio(accountSid, authToken);
    console.log('✅ Twilio service initialized');
  } catch (error) {
    console.error('❌ Twilio initialization error:', error.message);
  }
} else {
  console.warn('⚠️ Twilio credentials not found in .env');
}

/**
 * Gửi OTP qua SMS sử dụng Twilio Verify
 * @param {string} phoneNumber - Số điện thoại (format: +84xxxxxxxxx)
 * @returns {Promise<{success: boolean, message: string, sid?: string}>}
 */
async function sendSMSOTP(phoneNumber) {
  if (!client || !verifyServiceSid) {
    return {
      success: false,
      message: 'Twilio chưa được cấu hình. Vui lòng kiểm tra .env file.'
    };
  }

  // Định nghĩa formattedPhone ngay từ đầu để dùng trong catch block
  let formattedPhone = null;

  try {
    // Format phone number (đảm bảo có +84)
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      throw new Error('Số điện thoại không hợp lệ');
    }

    formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('84')) {
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('0')) {
        formattedPhone = '+84' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+84' + formattedPhone;
      }
    }

    // Gửi OTP qua Twilio Verify
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications
      .create({
        to: formattedPhone,
        channel: 'sms'
      });

    console.log('✅ SMS OTP sent:', {
      phone: formattedPhone,
      sid: verification.sid,
      status: verification.status
    });

    return {
      success: true,
      message: 'Đã gửi mã OTP qua SMS',
      sid: verification.sid,
      phone: formattedPhone
    };
  } catch (error) {
    const phoneDisplay = formattedPhone || phoneNumber || 'số điện thoại';

    console.error('❌ Twilio SMS error:', {
      message: error.message,
      code: error.code,
      status: error.status,
      phone: phoneDisplay,
      originalPhone: phoneNumber
    });

    // Nếu là lỗi unverified number, trả về message rõ ràng hơn
    if (error.message && error.message.includes('unverified')) {
      return {
        success: false,
        message: `Số điện thoại ${phoneDisplay} chưa được verify trong Twilio Verify Service.\n\nVới tài khoản trial, bạn cần:\n1. Vào Twilio Console → Verify → Services\n2. Chọn Service của bạn (SID: ${verifyServiceSid})\n3. Click "Try it out"\n4. Nhập số ${phoneDisplay} và gửi test verification\n5. Nhập mã OTP để verify số\n\nSau khi verify thành công, số sẽ có thể dùng cho SMS 2FA.`
      };
    }

    return {
      success: false,
      message: error.message || 'Không thể gửi SMS. Vui lòng thử lại.'
    };
  }
}

/**
 * Verify OTP từ SMS
 * @param {string} phoneNumber - Số điện thoại
 * @param {string} code - Mã OTP 6 số
 * @returns {Promise<{success: boolean, message: string, verified: boolean}>}
 */
async function verifySMSOTP(phoneNumber, code) {
  if (!client || !verifyServiceSid) {
    return {
      success: false,
      verified: false,
      message: 'Twilio chưa được cấu hình.'
    };
  }

  try {
    // Format phone number
    let formattedPhone = phoneNumber.trim();
    if (!formattedPhone.startsWith('+')) {
      if (formattedPhone.startsWith('84')) {
        formattedPhone = '+' + formattedPhone;
      } else if (formattedPhone.startsWith('0')) {
        formattedPhone = '+84' + formattedPhone.substring(1);
      } else {
        formattedPhone = '+84' + formattedPhone;
      }
    }

    // Verify OTP
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks
      .create({
        to: formattedPhone,
        code: code
      });

    const verified = verificationCheck.status === 'approved';

    console.log('🔐 SMS OTP Verify:', {
      phone: formattedPhone,
      code: code,
      status: verificationCheck.status,
      verified: verified
    });

    return {
      success: true,
      verified: verified,
      message: verified ? 'Mã OTP đúng' : 'Mã OTP không đúng hoặc đã hết hạn'
    };
  } catch (error) {
    console.error('❌ Twilio Verify error:', error.message);
    return {
      success: false,
      verified: false,
      message: error.message || 'Lỗi xác thực OTP'
    };
  }
}

module.exports = {
  sendSMSOTP,
  verifySMSOTP,
  isConfigured: !!client && !!verifyServiceSid
};

