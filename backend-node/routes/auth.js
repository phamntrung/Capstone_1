const express = require('express');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const { authRequired, createToken, nextUserId, usersByEmail } = require('../middleware/auth');
const { verifyPassword } = require('../utils/password');

// Import database module (optional - fallback to in-memory if not available)
let db = null;
let dbAvailable = false;
try {
  db = require('../database');
  // Test database connection (async, but don't block - will check on first use)
  db.testConnection().then(connected => {
    dbAvailable = connected;
    if (connected) {
      console.log('✅ Using MySQL database for authentication');
    } else {
      console.log('⚠️ Database not available, using in-memory storage');
    }
  }).catch((err) => {
    console.log('⚠️ Database connection test failed:', err.message);
    console.log('   Will retry on first database operation');
    dbAvailable = false;
  });
} catch (error) {
  console.log('⚠️ Database module not available, using in-memory storage');
  db = null;
}

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({ message: 'Thiếu dữ liệu hoặc mật khẩu quá ngắn' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if user exists (database or in-memory)
    let existingUser = null;
    if (db) {
      try {
        existingUser = await db.getUserByEmail(normalizedEmail);
        if (existingUser) {
          return res.status(409).json({ message: 'Email đã tồn tại' });
        }
      } catch (error) {
        console.error('❌ Database error checking existing user:', error.message);
        // Fallback to in-memory check
        if (usersByEmail.has(normalizedEmail)) {
          return res.status(409).json({ message: 'Email đã tồn tại' });
        }
      }
    } else {
      if (usersByEmail.has(normalizedEmail)) {
        return res.status(409).json({ message: 'Email đã tồn tại' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    let user;
    if (db) {
      try {
        // Save to database
        user = await db.createUser({
          name: name.trim(),
          email: normalizedEmail,
          password_hash: hashedPassword,
          role: 'user'
        });
        console.log(`✅ User registered in database: ${user.id} - ${user.email}`);
      } catch (error) {
        console.error('❌ Database error creating user:', error.message);
        // Fallback to in-memory
        user = {
          id: nextUserId(),
          name: name.trim(),
          email: normalizedEmail,
          password_hash: hashedPassword,
          role: 'user'
        };
        usersByEmail.set(normalizedEmail, user);
        console.log(`⚠️ User saved to in-memory storage: ${user.id}`);
      }
    } else {
      // Save to in-memory
      user = {
        id: nextUserId(),
        name: name.trim(),
        email: normalizedEmail,
        password_hash: hashedPassword,
        role: 'user'
      };
      usersByEmail.set(normalizedEmail, user);
    }

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Lỗi đăng ký' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    console.log('📥 Login request received');
    console.log('   Raw body:', JSON.stringify(req.body));
    console.log('   Headers:', JSON.stringify(req.headers));
    
    const { email, password } = req.body;
    
    console.log(`   Email: "${email}" (type: ${typeof email})`);
    console.log(`   Password: "${password ? password.substring(0, 3) + '...' : 'undefined'}" (type: ${typeof password})`);

    if (!email || !password) {
      console.log('❌ Missing email or password');
      return res.status(400).json({ message: 'Thiếu email/password' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    console.log(`🔐 Login attempt for: ${normalizedEmail}`);
    console.log(`📊 Using database: ${db ? 'YES' : 'NO (in-memory)'}`);
    
    // Get user from database or in-memory
    let user;
    if (db) {
      try {
        user = await db.getUserByEmail(normalizedEmail);
      } catch (error) {
        console.error('❌ Database query error:', error.message);
        // Fallback to in-memory
        console.log('⚠️ Falling back to in-memory storage');
        user = usersByEmail.get(normalizedEmail);
      }
    } else {
      user = usersByEmail.get(normalizedEmail);
    }

    if (!user) {
      console.log(`❌ Login failed: User not found - ${normalizedEmail}`);
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    console.log(`✅ User found, checking password...`);
    console.log(`   User ID: ${user.id}, Email: ${user.email}, Has password_hash: ${!!user.password_hash}`);

    // Check if user has password_hash (for Google login users, they might not have password)
    if (!user.password_hash) {
      console.log(`❌ Login failed: User has no password (possibly Google-only user) - ${normalizedEmail}`);
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }

    // Check password (supports both bcrypt and scrypt formats)
    console.log(`🔐 Verifying password...`);
    console.log(`   Password provided: "${password}"`);
    console.log(`   Hash (first 30 chars): ${user.password_hash.substring(0, 30)}...`);
    const passwordMatch = await verifyPassword(password, user.password_hash);
    console.log(`   Verification result: ${passwordMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
    if (!passwordMatch) {
      console.log(`❌ Login failed: Password mismatch for ${normalizedEmail}`);
      return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
    }
    
    console.log(`✅ Password verified for ${normalizedEmail}`);

    // Update last_login_at if using database
    if (db && user.id) {
      try {
        await db.updateUser(user.id, { last_login_at: new Date() });
      } catch (err) {
        console.warn('Failed to update last_login_at:', err.message);
      }
    }

    const token = createToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user'
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Lỗi đăng nhập' });
  }
});

// Google Login
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Thiếu idToken' });
    }

    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const email = payload.email.toLowerCase();
    const name = payload.name || email.split('@')[0];
    const googleId = payload.sub;
    const avatarUrl = payload.picture;

    console.log(`🔐 Google login attempt for: ${email}`);
    console.log(`📊 Using database: ${db ? 'YES' : 'NO (in-memory)'}`);

    // Get user from database or in-memory
    let user;
    if (db) {
      try {
        user = await db.getUserByEmail(email);
        
        if (!user) {
          console.log(`📝 Creating new Google user: ${email}`);
          // Create new user in database
          const hashedPassword = await bcrypt.hash(Math.random().toString(36), 10); // Random password
          user = await db.createUser({
            name,
            email,
            password_hash: hashedPassword,
            role: 'user',
            google_id: googleId,
            login_method: 'google',
            avatar_url: avatarUrl,
            email_verified: payload.email_verified || false
          });
          console.log(`✅ Created new user: ${user.id}`);
        } else {
          console.log(`🔄 Updating existing user: ${email}`);
          // Update user info
          await db.updateUser(user.id, {
            last_login_at: new Date(),
            google_id: googleId,
            login_method: 'google',
            avatar_url: avatarUrl,
            email_verified: payload.email_verified || false
          });
          user = await db.getUserByEmail(email);
        }
      } catch (error) {
        console.error('❌ Google login database error:', error);
        return res.status(500).json({ message: 'Đăng nhập Google thất bại: ' + error.message });
      }
    } else {
      user = usersByEmail.get(email);
      
      if (!user) {
        user = {
          id: nextUserId(),
          name,
          email,
          role: 'user',
          google_id: googleId,
          login_method: 'google'
        };
        usersByEmail.set(email, user);
      }
    }

    const token = createToken(user);

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'user'
      },
      token
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ message: 'Đăng nhập Google thất bại' });
  }
});

// Get current user
router.get('/me', authRequired, (req, res) => {
  res.json({
    userId: req.user.id,
    email: req.user.email,
    name: req.user.name,
    role: req.user.role
  });
});

module.exports = router;
