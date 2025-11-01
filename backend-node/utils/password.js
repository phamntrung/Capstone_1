const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const scrypt = require('scrypt-js');

/**
 * Verify password với nhiều format hash khác nhau
 * Hỗ trợ:
 * - bcrypt (bcryptjs format)
 * - scrypt (Flask/Python werkzeug format)
 */
async function verifyPassword(password, hash) {
  if (!hash || !password) {
    return false;
  }

  // Format bcryptjs (bắt đầu với $2a$, $2b$, $2y$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
    return await bcrypt.compare(password, hash);
  }

  // Format scrypt (Flask/Python werkzeug format: scrypt:32768:8:1$salt$hash)
  // Salt is base64 encoded, hash is hex string
  if (hash.startsWith('scrypt:')) {
    try {
      // Parse scrypt format: scrypt:32768:8:1$salt$hash
      const parts = hash.split('$');
      if (parts.length !== 3) {
        console.error('Invalid scrypt format: wrong number of parts');
        return false;
      }

      const [method, saltBase64, storedHashHex] = parts;
      const scryptParams = method.split(':');
      if (scryptParams.length !== 4 || scryptParams[0] !== 'scrypt') {
        console.error('Invalid scrypt format: wrong method format');
        return false;
      }

      const N = parseInt(scryptParams[1]); // 32768
      const r = parseInt(scryptParams[2]); // 8
      const p = parseInt(scryptParams[3]); // 1
      
      // Determine keylen from stored hash length
      // Hash is hex string, so keylen = hash_hex_length / 2
      const keylen = storedHashHex.length / 2; // Auto-detect from hash length (typically 32 or 64 bytes)

      // Decode salt from base64
      const salt = Buffer.from(saltBase64, 'base64');

      // Derive key using scrypt-js (supports custom N, r, p)
      const derivedKey = await scrypt.scrypt(
        Buffer.from(password, 'utf8'),
        salt,
        N,
        r,
        p,
        keylen
      );

      // Compare with stored hash (hex string)
      const derivedHashHex = Buffer.from(derivedKey).toString('hex');
      return derivedHashHex === storedHashHex;
    } catch (error) {
      console.error('Scrypt verification error:', error.message);
      return false;
    }
  }

  // Fallback: try bcrypt anyway
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error('Password verification error:', error.message);
    return false;
  }
}

module.exports = {
  verifyPassword
};

