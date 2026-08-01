// routes/appointments.js
const express = require('express');
const router = express.Router();

const {
  createAppointment,
  getAppointmentByCode,
} = require('../db/database');
const { generateReceiptPDF } = require('../utils/receipt');
const { notifyClinicOfNewAppointment } = require('../utils/mailer');

// simple phone/email sanity checks (not overly strict — India-friendly)
function validateBody(body) {
  const errors = [];
  if (!body.patient_name || body.patient_name.trim().length < 2) {
    errors.push('Full name is required.');
  }
  if (!body.phone || !/^\+?[0-9\s-]{7,15}$/.test(body.phone.trim())) {
    errors.push('A valid phone number is required.');
  }
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.push('Email address looks invalid.');
  }
  if (!body.preferred_date) {
    errors.push('Preferred date is required.');
  }
  if (!body.preferred_time) {
    errors.push('Preferred time is required.');
  }
  return errors;
}

// POST /api/appointments  — book a new appointment
router.post('/', async (req, res) => {
  const errors = validateBody(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const appointment = await createAppointment(req.body);

    // 1) Real-time push to any connected admin dashboard
    const io = req.app.get('io');
    if (io) io.emit('new_appointment', appointment);

    // 2) Optional email notification (never blocks the response)
    notifyClinicOfNewAppointment(appointment).catch(() => {});

    res.status(201).json({ success: true, appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not book appointment. Please try again.' });
  }
});

// POST /api/appointments/lookup — patient checks their own status using
// Appointment ID + phone number (both required, so people can't just guess
// sequential codes and see someone else's private details)
router.post('/lookup', async (req, res) => {
  try {
    const { appointment_code, phone } = req.body;
    if (!appointment_code || !phone) {
      return res.status(400).json({ error: 'Appointment ID and phone number are both required.' });
    }

    const appointment = await getAppointmentByCode(appointment_code.trim().toUpperCase());

    if (!appointment || appointment.phone.replace(/\s|-/g, '') !== phone.trim().replace(/\s|-/g, '')) {
      return res.status(404).json({ error: 'No appointment found with that ID and phone number. Please double-check and try again.' });
    }

    res.json({ appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/appointments/:code  — used right after booking (same session, code freshly known)
router.get('/:code', async (req, res) => {
  try {
    const appointment = await getAppointmentByCode(req.params.code.toUpperCase());
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    res.json({ appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/appointments/:code/receipt?phone=...  — download PDF receipt
// Requires the phone number too, so receipts (which contain personal
// details) can't be pulled just by guessing a sequential ID.
router.get('/:code/receipt', async (req, res) => {
  try {
    const appointment = await getAppointmentByCode(req.params.code.toUpperCase());
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }
    const phone = (req.query.phone || '').trim().replace(/\s|-/g, '');
    if (!phone || appointment.phone.replace(/\s|-/g, '') !== phone) {
      return res.status(403).json({ error: 'Phone number does not match this appointment.' });
    }
    generateReceiptPDF(appointment, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
