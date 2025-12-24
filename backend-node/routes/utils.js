const express = require('express');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// Helper function to get current date in Vietnam timezone
function getCurrentDateVietnam() {
  const now = new Date();
  // Convert to Vietnam timezone (UTC+7)
  const vietnamOffset = 7 * 60; // 7 hours in minutes
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const vietnamTime = new Date(utc + (vietnamOffset * 60000));
  
  // Format as YYYY-MM-DD
  const year = vietnamTime.getFullYear();
  const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
  const day = String(vietnamTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Get current date from server
router.get('/current-date', authRequired, (req, res) => {
  try {
    const currentDate = getCurrentDateVietnam();
    res.json({
      date: currentDate,
      timezone: 'Asia/Ho_Chi_Minh',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get current date error:', error);
    res.status(500).json({ message: 'Lỗi lấy ngày hiện tại' });
  }
});

module.exports = router;

