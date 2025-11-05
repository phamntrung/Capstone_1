const express = require('express');
const { authRequired } = require('../middleware/auth');
const {
  getDevicesByUserId,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  deleteAllDevicesExceptCurrent
} = require('../database');

const router = express.Router();

// Helper function để format device response
function formatDevice(device) {
  return {
    id: device.id,
    userId: device.user_id,
    name: device.device_name || 'Unknown Device',
    platform: device.platform || 'Unknown',
    browser: device.browser || 'Unknown',
    city: device.city || 'Unknown',
    country: device.country || 'Unknown',
    ip: device.ip_address || 'Unknown',
    last: formatLastActivity(device.last_activity_at || device.created_at, device.is_current),
    sessions: 1, // TODO: Tính số sessions từ bảng sessions nếu có
    trusted: device.is_trusted !== 0 && device.is_trusted !== false,
    blocked: device.is_blocked !== 0 && device.is_blocked !== false,
    current: device.is_current !== 0 && device.is_current !== false,
    emoji: getDeviceEmoji(device.platform),
    fp: device.fingerprint || 'N/A'
  };
}

// Helper: Format last activity time
function formatLastActivity(dateTime, isCurrent = false) {
  if (!dateTime) return 'Chưa có';

  const date = new Date(dateTime);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (isCurrent) {
    if (diffMins < 1) return 'Đang hoạt động';
    if (diffMins < 5) return `Hoạt động ${diffMins} phút trước`;
    return `Hoạt động ${diffMins} phút trước`;
  }

  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  if (diffHours < 24) {
    if (diffHours === 1) return '1 giờ trước';
    return `${diffHours} giờ trước`;
  }
  if (diffDays === 1) return 'Hôm qua';
  if (diffDays < 7) return `${diffDays} ngày trước`;

  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Helper: Get emoji based on platform
function getDeviceEmoji(platform) {
  if (!platform) return '📱';
  const p = platform.toLowerCase();
  if (p.includes('ios') || p.includes('iphone')) return '📱';
  if (p.includes('macos') || p.includes('mac')) return '💻';
  if (p.includes('windows')) return '🖥️';
  if (p.includes('android')) return '📲';
  if (p.includes('linux')) return '🐧';
  return '💻';
}

// List devices
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const devices = await getDevicesByUserId(userId);

    const formattedDevices = devices.map(formatDevice);
    res.json({ items: formattedDevices });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({ message: 'Lỗi lấy danh sách thiết bị' });
  }
});

// Get single device
router.get('/:id', authRequired, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const device = await getDeviceById(deviceId, req.user.id);

    if (!device) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị' });
    }

    res.json(formatDevice(device));
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ message: 'Lỗi lấy thông tin thiết bị' });
  }
});

// Update device (rename, trust, block)
router.put('/:id', authRequired, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const existingDevice = await getDeviceById(deviceId, req.user.id);

    if (!existingDevice) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị' });
    }

    const { deviceName, isTrusted, isBlocked } = req.body;
    const updates = {};

    if (deviceName !== undefined) updates.deviceName = deviceName;
    if (isTrusted !== undefined) updates.isTrusted = isTrusted;
    if (isBlocked !== undefined) updates.isBlocked = isBlocked;

    const updatedDevice = await updateDevice(deviceId, req.user.id, updates);
    res.json(formatDevice(updatedDevice));
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ message: 'Lỗi cập nhật thiết bị' });
  }
});

// Delete device (logout)
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const deviceId = parseInt(req.params.id);
    const deleted = await deleteDevice(deviceId, req.user.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Không tìm thấy thiết bị' });
    }

    res.json({ deleted: deviceId });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ message: 'Lỗi xóa thiết bị' });
  }
});

// Logout all devices
router.post('/logout-all', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const currentDeviceId = req.body.currentDeviceId;

    if (currentDeviceId) {
      // Xóa tất cả thiết bị TRỪ thiết bị hiện tại
      const deletedCount = await deleteAllDevicesExceptCurrent(userId, currentDeviceId);
      res.json({ deleted: deletedCount, message: `Đã đăng xuất ${deletedCount} thiết bị khác` });
    } else {
      // Nếu không có currentDeviceId (hoặc null), xóa TẤT CẢ kể cả thiết bị hiện tại
      const devices = await getDevicesByUserId(userId);
      let deletedCount = 0;
      for (const device of devices) {
        const deleted = await deleteDevice(device.id, userId);
        if (deleted) deletedCount++;
      }
      res.json({ deleted: deletedCount, message: `Đã đăng xuất ${deletedCount} thiết bị (bao gồm thiết bị hiện tại)` });
    }
  } catch (error) {
    console.error('Logout all devices error:', error);
    res.status(500).json({ message: 'Lỗi đăng xuất thiết bị' });
  }
});

module.exports = router;

