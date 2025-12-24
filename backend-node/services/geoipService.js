const https = require('https');
const http = require('http');

/**
 * Service để lấy thông tin địa lý từ IP address
 * Sử dụng ip-api.com (free, không cần API key)
 */
async function getLocationFromIP(ipAddress) {
  // Bỏ qua localhost và private IPs
  if (!ipAddress ||
      ipAddress === 'Unknown' ||
      ipAddress === '127.0.0.1' ||
      ipAddress === '::1' ||
      ipAddress.startsWith('192.168.') ||
      ipAddress.startsWith('10.') ||
      ipAddress.startsWith('172.16.') ||
      ipAddress.startsWith('172.17.') ||
      ipAddress.startsWith('172.18.') ||
      ipAddress.startsWith('172.19.') ||
      ipAddress.startsWith('172.20.') ||
      ipAddress.startsWith('172.21.') ||
      ipAddress.startsWith('172.22.') ||
      ipAddress.startsWith('172.23.') ||
      ipAddress.startsWith('172.24.') ||
      ipAddress.startsWith('172.25.') ||
      ipAddress.startsWith('172.26.') ||
      ipAddress.startsWith('172.27.') ||
      ipAddress.startsWith('172.28.') ||
      ipAddress.startsWith('172.29.') ||
      ipAddress.startsWith('172.30.') ||
      ipAddress.startsWith('172.31.')) {
    return { city: null, country: null };
  }

  try {
    // Sử dụng ip-api.com (free, không cần API key)
    // Format: http://ip-api.com/json/{ip}
    const url = `http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,city,query`;

    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);

            if (json.status === 'success') {
              resolve({
                city: json.city || null,
                country: json.countryCode || json.country || null
              });
            } else {
              // API trả về lỗi
              resolve({ city: null, country: null });
            }
          } catch (error) {
            resolve({ city: null, country: null });
          }
        });
      }).on('error', (error) => {
        // Lỗi kết nối, không throw error
        resolve({ city: null, country: null });
      }).setTimeout(3000, () => {
        // Timeout sau 3 giây
        resolve({ city: null, country: null });
      });
    });
  } catch (error) {
    return { city: null, country: null };
  }
}

module.exports = {
  getLocationFromIP
};

