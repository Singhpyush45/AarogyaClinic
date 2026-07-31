// routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const { requireAdmin } = require('../middleware/auth');
const {
  listAppointments,
  updateAppointmentStatus,
  getAppointmentById,
  getStats,
  createReview,
  listAllReviews,
  updateReviewStatus,
  deleteReview,
} = require('../db/database');
const { generateReceiptPDF } = require('../utils/receipt');

// ---- Photo upload setup ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max — phone photos are often 4-8MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
  },
});

const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
const PHOTO_PATH = path.join(ASSETS_DIR, 'doctor.jpg');

// POST /api/admin/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass =
    validUser &&
    (await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH || ''));

  if (!validUser || !validPass) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const token = jwt.sign({ username }, process.env.JWT_SECRET, {
    expiresIn: '12h',
  });

  res.json({ success: true, token });
});

// GET /api/admin/appointments  — list all (with optional filters)
router.get('/appointments', requireAdmin, (req, res) => {
  const { status, date, search } = req.query;
  const appointments = listAppointments({ status, date, search });
  res.json({ appointments });
});

// GET /api/admin/stats — dashboard summary numbers
router.get('/stats', requireAdmin, (req, res) => {
  res.json({ stats: getStats() });
});

// PATCH /api/admin/appointments/:id/status  — confirm / cancel / complete
router.patch('/appointments/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status value.' });
  }

  const existing = getAppointmentById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }

  const updated = updateAppointmentStatus(req.params.id, status);

  const io = req.app.get('io');
  if (io) io.emit('appointment_updated', updated);

  res.json({ success: true, appointment: updated });
});

// POST /api/admin/doctor-photo — upload a new doctor photo
// Uses sharp to auto-correct orientation (fixes the "sideways photo" issue
// that happens with phone photos) and resize for fast page loads.
router.post('/doctor-photo', requireAdmin, (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Photo is too large. Please use a file under 10MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No photo was uploaded.' });
  }

  try {
    if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

    await sharp(req.file.buffer)
      .rotate() // auto-orient using the image's EXIF data, then strip it
      .resize(800, 1000, { fit: 'cover', position: 'top' })
      .jpeg({ quality: 85 })
      .toFile(PHOTO_PATH);

    res.json({ success: true, updatedAt: Date.now() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process that image. Try a different file.' });
  }
});

// ---- Reviews moderation ----

// GET /api/admin/reviews — list ALL reviews (visible + hidden)
router.get('/reviews', requireAdmin, (req, res) => {
  res.json({ reviews: listAllReviews() });
});

// POST /api/admin/reviews — admin manually adds a review (e.g. one collected
// over phone/WhatsApp from a real patient)
router.post('/reviews', requireAdmin, (req, res) => {
  const { patient_name, city, rating, review_text } = req.body;
  if (!patient_name || !review_text || !rating) {
    return res.status(400).json({ error: 'Name, rating, and review text are required.' });
  }
  const review = createReview({
    patient_name,
    city,
    rating: Number(rating),
    review_text,
    source: 'admin_added',
  });
  res.status(201).json({ success: true, review });
});

// PATCH /api/admin/reviews/:id/status — hide or re-show a review
router.patch('/reviews/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  if (!['visible', 'hidden'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }
  const updated = updateReviewStatus(req.params.id, status);
  res.json({ success: true, review: updated });
});

// DELETE /api/admin/reviews/:id — permanently delete a review
router.delete('/reviews/:id', requireAdmin, (req, res) => {
  deleteReview(req.params.id);
  res.json({ success: true });
});

// GET /api/admin/appointments/:id/receipt — staff can always download, no phone check needed
router.get('/appointments/:id/receipt', requireAdmin, (req, res) => {
  const appointment = getAppointmentById(req.params.id);
  if (!appointment) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }
  generateReceiptPDF(appointment, res);
});

module.exports = router;
