// routes/admin.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const sharp = require('sharp');

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
const { setClinicAsset, listStaff, createStaff, setStaffActive, deleteStaff, getRecentAuditLog } = require('../db/clinic');
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
router.get('/appointments', requireAdmin, async (req, res) => {
  try {
    const { status, date, search } = req.query;
    const appointments = await listAppointments({ status, date, search });
    res.json({ appointments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load appointments.' });
  }
});

// GET /api/admin/stats — dashboard summary numbers
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    res.json({ stats: await getStats() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load stats.' });
  }
});

// PATCH /api/admin/appointments/:id/status  — confirm / cancel / complete
router.patch('/appointments/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    const existing = await getAppointmentById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    const updated = await updateAppointmentStatus(req.params.id, status);

    const io = req.app.get('io');
    if (io) io.emit('appointment_updated', updated);

    res.json({ success: true, appointment: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update status.' });
  }
});

// POST /api/admin/doctor-photo — upload a new doctor photo
// Stored in PostgreSQL (not the local filesystem) so it survives
// Render/Railway redeploys, which wipe local files on free tiers.
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
    const buffer = await sharp(req.file.buffer)
      .rotate() // auto-orient using the image's EXIF data, then strip it
      .resize(800, 1000, { fit: 'cover', position: 'top' })
      .jpeg({ quality: 85 })
      .toBuffer();

    await setClinicAsset('doctor_photo', buffer, 'image/jpeg');

    res.json({ success: true, updatedAt: Date.now() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process that image. Try a different file.' });
  }
});

// ---- Reviews moderation ----

// GET /api/admin/reviews — list ALL reviews (visible + hidden)
router.get('/reviews', requireAdmin, async (req, res) => {
  try {
    res.json({ reviews: await listAllReviews() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load reviews.' });
  }
});

// POST /api/admin/reviews — admin manually adds a review (e.g. one collected
// over phone/WhatsApp from a real patient)
router.post('/reviews', requireAdmin, async (req, res) => {
  try {
    const { patient_name, city, rating, review_text } = req.body;
    if (!patient_name || !review_text || !rating) {
      return res.status(400).json({ error: 'Name, rating, and review text are required.' });
    }
    const review = await createReview({
      patient_name,
      city,
      rating: Number(rating),
      review_text,
      source: 'admin_added',
    });
    res.status(201).json({ success: true, review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add review.' });
  }
});

// PATCH /api/admin/reviews/:id/status — hide or re-show a review
router.patch('/reviews/:id/status', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['visible', 'hidden'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }
    const updated = await updateReviewStatus(req.params.id, status);
    res.json({ success: true, review: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update review.' });
  }
});

// DELETE /api/admin/reviews/:id — permanently delete a review
router.delete('/reviews/:id', requireAdmin, async (req, res) => {
  try {
    await deleteReview(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete review.' });
  }
});

// GET /api/admin/appointments/:id/receipt — staff can always download, no phone check needed
router.get('/appointments/:id/receipt', requireAdmin, async (req, res) => {
  try {
    const appointment = await getAppointmentById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    generateReceiptPDF(appointment, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate receipt.' });
  }
});

// ---- Clinic Staff Management (site admin creates Doctor/Reception/Billing accounts) ----

// GET /api/admin/staff — list all staff accounts
router.get('/staff', requireAdmin, async (req, res) => {
  try {
    res.json({ staff: await listStaff() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load staff list.' });
  }
});

// POST /api/admin/staff — create a new Doctor/Reception/Billing account
router.post('/staff', requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const allowedRoles = ['doctor', 'reception', 'billing'];
    if (!username || !password || !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'Username, password, and a valid role (doctor/reception/billing) are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const staff = await createStaff({ username: username.trim(), password, role });
    res.status(201).json({ success: true, staff });
  } catch (err) {
    if (err.code === '23505') { // unique violation
      return res.status(400).json({ error: 'That username is already taken.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not create staff account.' });
  }
});

// PATCH /api/admin/staff/:id/active — enable/disable a staff account
router.patch('/staff/:id/active', requireAdmin, async (req, res) => {
  try {
    await setStaffActive(req.params.id, req.body.active !== false);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update staff account.' });
  }
});

// DELETE /api/admin/staff/:id — permanently delete a staff account
router.delete('/staff/:id', requireAdmin, async (req, res) => {
  try {
    await deleteStaff(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete staff account.' });
  }
});

// GET /api/admin/audit-log — recent clinic staff activity (for oversight)
router.get('/audit-log', requireAdmin, async (req, res) => {
  try {
    res.json({ log: await getRecentAuditLog(100) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load activity log.' });
  }
});

module.exports = router;
