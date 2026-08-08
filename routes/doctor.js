// routes/doctor.js — queue + digital prescriptions
const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const { requireStaffRole } = require('../middleware/staffAuth');
const {
  getDoctorQueue, getVisitWithPatient, updateVisitStatus, getPatientHistory,
  createPrescription, addPrescriptionMedicines, getPrescriptionByVisit,
  getQuickType, addQuickType, savePrescriptionPhoto, getPrescriptionPhoto,
  getDoctorStats, logAudit, getDoctorAnalytics, getDoctorHistory,
  getConsultingFee, setConsultingFee,
} = require('../db/clinic');

router.use(requireStaffRole(['doctor']));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB max for a prescription photo
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
  },
});

// GET /api/doctor/queue
router.get('/queue', async (req, res) => {
  try {
    const queue = await getDoctorQueue();
    res.json({ queue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load queue.' });
  }
});

// GET /api/doctor/visits/:id — visit + patient + past history
router.get('/visits/:id', async (req, res) => {
  try {
    const visit = await getVisitWithPatient(req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found.' });
    const history = await getPatientHistory(visit.patient_id);
    res.json({ visit, history: history.filter((h) => h.id !== visit.id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load visit.' });
  }
});

// POST /api/doctor/visits/:id/start — mark visit as "with_doctor"
router.post('/visits/:id/start', async (req, res) => {
  try {
    const visit = await updateVisitStatus(req.params.id, 'with_doctor', req.staff.staffId);
    res.json({ success: true, visit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not start consultation.' });
  }
});

// POST /api/doctor/visits/:id/prescription — save Rx + medicines, send to billing
router.post('/visits/:id/prescription', async (req, res) => {
  try {
    const { medicines, ...sections } = req.body;
    const prescription = await createPrescription(req.params.id, req.staff.staffId, sections);

    if (Array.isArray(medicines) && medicines.length) {
      await addPrescriptionMedicines(prescription.id, medicines);
    }

    const visit = await updateVisitStatus(req.params.id, 'ready_for_billing', req.staff.staffId);

    const io = req.app.get('io');
    if (io) io.emit('visit_ready_for_billing', visit);

    await logAudit(req.staff.staffId, 'doctor', 'prescription_saved', `Visit #${req.params.id}, mode: ${sections.mode || 'digital'}`);

    res.status(201).json({ success: true, prescription, visit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save prescription.' });
  }
});

// GET /api/doctor/quick-type/:section
router.get('/quick-type/:section', async (req, res) => {
  try {
    const suggestions = await getQuickType(req.params.section);
    res.json({ suggestions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load suggestions.' });
  }
});

// POST /api/doctor/quick-type — add a custom suggestion
router.post('/quick-type', async (req, res) => {
  try {
    const { section, text } = req.body;
    if (!section || !text || !text.trim()) {
      return res.status(400).json({ error: 'Section and text are required.' });
    }
    const suggestion = await addQuickType(section, text.trim(), req.staff.staffId);
    res.status(201).json({ success: true, suggestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add suggestion.' });
  }
});

// GET /api/doctor/visits/:id/prescription — view existing Rx for a past visit
router.get('/visits/:id/prescription', async (req, res) => {
  try {
    const prescription = await getPrescriptionByVisit(req.params.id);
    res.json({ prescription });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load prescription.' });
  }
});

// POST /api/doctor/visits/:id/photo-rx — upload a photo of a handwritten Rx
router.post('/visits/:id/photo-rx', (req, res, next) => {
  upload.single('photo')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Photo is too large. Please use a file under 8MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No photo was uploaded.' });
  try {
    // auto-orient + cap dimensions so large phone photos don't bloat the DB
    const buffer = await sharp(req.file.buffer)
      .rotate()
      .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    await savePrescriptionPhoto(req.params.id, buffer, 'image/jpeg', req.staff.staffId);
    res.status(201).json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process that image. Try a different file.' });
  }
});

// GET /api/doctor/visits/:id/photo-rx — view the Photo Rx image for this visit
router.get('/visits/:id/photo-rx', async (req, res) => {
  try {
    const photo = await getPrescriptionPhoto(req.params.id);
    if (!photo) return res.status(404).send('No photo Rx for this visit.');
    res.set('Content-Type', photo.mime_type);
    res.send(photo.data);
  } catch (err) {
    res.status(500).send('Error loading photo.');
  }
});

// GET /api/doctor/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getDoctorStats(req.staff.staffId);
    res.json({ stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load stats.' });
  }
});

// GET /api/doctor/analytics?range=today|yesterday|this_week|this_month|3_months|6_months|1_year|2_years|custom&from=&to=
router.get('/analytics', async (req, res) => {
  try {
    const { range = 'today', from, to } = req.query;
    const analytics = await getDoctorAnalytics(req.staff.staffId, range, from, to);
    res.json({ analytics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load analytics.' });
  }
});

// GET /api/doctor/history?range=... — completed consultations, kept permanently
router.get('/history', async (req, res) => {
  try {
    const { range = 'today', from, to } = req.query;
    const history = await getDoctorHistory(req.staff.staffId, range, from, to);
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// GET/PUT /api/doctor/consulting-fee — set once, applies to all bills until changed
router.get('/consulting-fee', async (req, res) => {
  try {
    res.json({ fee: await getConsultingFee() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load consulting fee.' });
  }
});

router.put('/consulting-fee', async (req, res) => {
  try {
    const amount = Number(req.body.fee);
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Please enter a valid fee amount.' });
    }
    const fee = await setConsultingFee(amount);
    await logAudit(req.staff.staffId, 'doctor', 'consulting_fee_updated', `New fee: ₹${amount}`);
    res.json({ success: true, fee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update consulting fee.' });
  }
});

module.exports = router;
