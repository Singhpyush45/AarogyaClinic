// routes/billing.js — billing queue, bill generation, PDF
const express = require('express');
const router = express.Router();
const { requireStaffRole } = require('../middleware/staffAuth');
const {
  getBillingQueue, getVisitWithPatient, getPrescriptionByVisit,
  createBill, getBillById, updateVisitStatus, createMedicine, getStaffById,
  getPrescriptionPhoto, getBillingStats, logAudit, getConsultingFee, getBillingHistory,
} = require('../db/clinic');
const { generateBillPDF } = require('../utils/billPdf');

router.use(requireStaffRole(['billing']));

// GET /api/billing/queue
router.get('/queue', async (req, res) => {
  try {
    const queue = await getBillingQueue();
    res.json({ queue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load billing queue.' });
  }
});

// GET /api/billing/history?range=... — completed bills, kept permanently
router.get('/history', async (req, res) => {
  try {
    const { range = 'today', from, to } = req.query;
    const history = await getBillingHistory(range, from, to);
    res.json({ history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// GET /api/billing/consulting-fee — read-only here (doctor sets it)
router.get('/consulting-fee', async (req, res) => {
  try {
    res.json({ fee: await getConsultingFee() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load consulting fee.' });
  }
});

// GET /api/billing/visits/:id — visit + patient + prescription + medicines
router.get('/visits/:id', async (req, res) => {
  try {
    const visit = await getVisitWithPatient(req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found.' });
    const prescription = await getPrescriptionByVisit(req.params.id);
    const hasPhotoRx = await getPrescriptionPhoto(req.params.id);
    res.json({ visit, prescription, hasPhotoRx: !!hasPhotoRx });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load visit.' });
  }
});

// GET /api/billing/visits/:id/photo-rx — view the Photo Rx image for this visit
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

// POST /api/billing/visits/:id/bill — generate the bill
// Items are homeopathic-style: medicine + price (no quantity — one unit
// per line item, matching how homeopathic remedies are actually dispensed).
// Consulting fee is added automatically from the clinic-wide setting.
router.post('/visits/:id/bill', async (req, res) => {
  try {
    const { items, discount, save_unsaved_medicines, include_consulting_fee } = req.body;
    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'At least one billable item is required.' });
    }

    const visit = await getVisitWithPatient(req.params.id);
    if (!visit) return res.status(404).json({ error: 'Visit not found.' });

    // optionally save any medicine billing staff typed a price for, so it's
    // in the master list next time (per the spec's billing workflow)
    if (save_unsaved_medicines) {
      for (const it of items) {
        if (it.save_to_master && !it.medicine_id) {
          const created = await createMedicine({ name: it.medicine_name, price: it.unit_price }).catch(() => null);
          if (created) it.medicine_id = created.id;
        }
      }
    }

    // Doctor's name is looked up automatically from who saw the patient —
    // no need for the frontend to supply it (and it can't be spoofed).
    let doctorName = null;
    if (visit.doctor_id) {
      const doctor = await getStaffById(visit.doctor_id);
      if (doctor) doctorName = doctor.full_name || doctor.username;
    }

    const consultingFee = include_consulting_fee === false ? 0 : await getConsultingFee();

    const patientName = `${visit.first_name} ${visit.last_name || ''}`.trim();
    const bill = await createBill(
      req.params.id, patientName, visit.phone, doctorName,
      items, Number(discount) || 0, req.staff.staffId, consultingFee
    );

    await updateVisitStatus(req.params.id, 'billed');

    await logAudit(req.staff.staffId, 'billing', 'bill_generated', `${bill.bill_number} — ₹${bill.grand_total}`);

    res.status(201).json({ success: true, bill });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate bill.' });
  }
});

// GET /api/billing/bills/:id/pdf — download bill as PDF (staff, no phone check needed)
router.get('/bills/:id/pdf', async (req, res) => {
  try {
    const bill = await getBillById(req.params.id);
    if (!bill) return res.status(404).json({ error: 'Bill not found.' });
    generateBillPDF(bill, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate bill PDF.' });
  }
});

// GET /api/billing/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await getBillingStats(req.staff.staffId);
    res.json({ stats });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load stats.' });
  }
});

module.exports = router;
