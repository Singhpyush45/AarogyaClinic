// routes/staff.js — role-based login + own profile management
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');

const { requireStaffRole } = require('../middleware/staffAuth');
const {
  getStaffByUsername,
  getStaffById,
  updateStaffProfile,
  updateStaffPhoto,
  getStaffPhoto,
} = require('../db/clinic');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
  },
});

const ALL_ROLES = ['doctor', 'reception', 'billing'];

// POST /api/staff/login — { role, username, password }
router.post('/login', async (req, res) => {
  try {
    const { role, username, password } = req.body;
    if (!role || !ALL_ROLES.includes(role) || !username || !password) {
      return res.status(400).json({ error: 'Role, username, and password are required.' });
    }

    const staff = await getStaffByUsername(username.trim(), role);
    if (!staff) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const validPass = await bcrypt.compare(password, staff.password_hash);
    if (!validPass) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { type: 'staff', staffId: staff.id, username: staff.username, role: staff.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      success: true,
      token,
      staff: {
        id: staff.id, username: staff.username, role: staff.role,
        full_name: staff.full_name, age: staff.age, mobile: staff.mobile,
        address: staff.address, registration_number: staff.registration_number,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/staff/me — current logged-in staff's own profile
router.get('/me', requireStaffRole(ALL_ROLES), async (req, res) => {
  try {
    const staff = await getStaffById(req.staff.staffId);
    if (!staff) return res.status(404).json({ error: 'Profile not found.' });
    res.json({
      staff: {
        id: staff.id, username: staff.username, role: staff.role,
        full_name: staff.full_name, age: staff.age, mobile: staff.mobile,
        address: staff.address, registration_number: staff.registration_number,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load profile.' });
  }
});

// PUT /api/staff/me — edit own profile
router.put('/me', requireStaffRole(ALL_ROLES), async (req, res) => {
  try {
    const staff = await updateStaffProfile(req.staff.staffId, req.body);
    res.json({ success: true, staff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

// POST /api/staff/me/photo — upload own profile photo
router.post('/me/photo', requireStaffRole(ALL_ROLES), (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No photo uploaded.' });
    const buffer = await sharp(req.file.buffer).rotate().resize(400, 400, { fit: 'cover' }).jpeg({ quality: 85 }).toBuffer();
    await updateStaffPhoto(req.staff.staffId, buffer, 'image/jpeg');
    res.json({ success: true, updatedAt: Date.now() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process photo.' });
  }
});

// GET /api/staff/:id/photo — serve a staff member's photo (staff-only, any logged-in staff can view)
router.get('/:id/photo', requireStaffRole(ALL_ROLES), async (req, res) => {
  try {
    const photo = await getStaffPhoto(req.params.id);
    if (!photo) return res.status(404).send('No photo');
    res.set('Content-Type', photo.photo_mime);
    res.set('Cache-Control', 'private, max-age=60');
    res.send(photo.photo_data);
  } catch (err) {
    res.status(500).send('Error loading photo');
  }
});

module.exports = router;
