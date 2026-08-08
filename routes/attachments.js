// routes/attachments.js — visit attachments (lab reports, documents) shared across roles
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { requireStaffRole } = require('../middleware/staffAuth');
const { addAttachment, listAttachments, getAttachment, deleteAttachment, logAudit } = require('../db/clinic');

const ALL_ROLES = ['doctor', 'reception', 'billing'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPG, PNG, WEBP, or PDF files are allowed.'));
  },
});

router.use(requireStaffRole(ALL_ROLES));

// GET /api/attachments/visit/:visitId — list attachments for a visit
router.get('/visit/:visitId', async (req, res) => {
  try {
    const attachments = await listAttachments(req.params.visitId);
    res.json({ attachments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load attachments.' });
  }
});

// POST /api/attachments/visit/:visitId — upload a file (lab report, document, etc.)
router.post('/visit/:visitId', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large. Max 10MB.' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file was uploaded.' });
  try {
    const attachment = await addAttachment(req.params.visitId, req.file.originalname, req.file.buffer, req.file.mimetype, req.staff.staffId);
    await logAudit(req.staff.staffId, req.staff.role, 'attachment_uploaded', `Visit #${req.params.visitId}: ${req.file.originalname}`);
    res.status(201).json({ success: true, attachment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save attachment.' });
  }
});

// GET /api/attachments/:id — download/view a specific attachment
router.get('/:id', async (req, res) => {
  try {
    const file = await getAttachment(req.params.id);
    if (!file) return res.status(404).send('File not found.');
    res.set('Content-Type', file.mime_type);
    res.set('Content-Disposition', `inline; filename="${file.filename}"`);
    res.send(file.data);
  } catch (err) {
    res.status(500).send('Error loading file.');
  }
});

// DELETE /api/attachments/:id
router.delete('/:id', async (req, res) => {
  try {
    await deleteAttachment(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete attachment.' });
  }
});

module.exports = router;
