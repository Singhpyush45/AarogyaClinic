// routes/reception.js — patient intake
const express = require('express');
const router = express.Router();
const { requireStaffRole } = require('../middleware/staffAuth');
const {
  findPatientsByPhone, searchPatients, createPatient, getPatientHistory, createVisit, logAudit,
} = require('../db/clinic');

router.use(requireStaffRole(['reception']));

// GET /api/reception/patients/search?phone=... or ?q=...
router.get('/patients/search', async (req, res) => {
  try {
    const { phone, q } = req.query;
    let patients = [];
    if (phone) patients = await findPatientsByPhone(phone);
    else if (q) patients = await searchPatients(q);
    res.json({ patients });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed.' });
  }
});

// GET /api/reception/patients/:id/history
router.get('/patients/:id/history', async (req, res) => {
  try {
    const history = await getPatientHistory(req.params.id);
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// POST /api/reception/intake — create (or reuse) patient + new visit
router.post('/intake', async (req, res) => {
  try {
    const { patient_id, first_name, last_name, phone, gender, dob, age, address, ...vitals } = req.body;

    if (!phone || !first_name) {
      return res.status(400).json({ error: 'First name and phone number are required.' });
    }

    let patient;
    if (patient_id) {
      patient = { id: patient_id };
    } else {
      patient = await createPatient({ first_name, last_name, phone, gender, dob, age, address });
    }

    const visit = await createVisit(patient.id, vitals, req.staff.staffId);

    const io = req.app.get('io');
    if (io) io.emit('new_visit', { ...visit, first_name: first_name, last_name: last_name || '' });

    await logAudit(req.staff.staffId, 'reception', 'patient_intake', `${first_name} ${last_name || ''} (visit #${visit.id})`);

    res.status(201).json({ success: true, visit, patient });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not register patient. Please try again.' });
  }
});

module.exports = router;
