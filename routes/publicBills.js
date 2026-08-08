// routes/publicBills.js — PUBLIC bill lookup for patients (no staff login needed)
// Requires BOTH bill number and phone number to match, so bills can't be
// pulled just by guessing IDs.
const express = require('express');
const router = express.Router();
const { getBillByNumberAndPhone, listBillsByPhone } = require('../db/clinic');
const { generateBillPDF } = require('../utils/billPdf');

// POST /api/bills/lookup-by-phone — only phone number needed, returns all bills
router.post('/lookup-by-phone', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }
    const bills = await listBillsByPhone(phone.trim());
    if (!bills.length) {
      return res.status(404).json({ error: 'No bills found for that phone number.' });
    }
    res.json({ bills });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/bills/by-id/:id/pdf?phone=... — download using bill id (from the phone lookup list)
router.get('/by-id/:id/pdf', async (req, res) => {
  try {
    const phone = (req.query.phone || '').trim();
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });
    const { pool } = require('../db/clinic');
    const { rows } = await pool.query(`SELECT * FROM bills WHERE id = $1 AND patient_phone = $2`, [req.params.id, phone]);
    if (!rows[0]) return res.status(404).json({ error: 'Bill not found.' });
    const bill = rows[0];
    const { rows: items } = await pool.query(`SELECT * FROM bill_items WHERE bill_id = $1`, [bill.id]);
    bill.items = items;
    generateBillPDF(bill, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate bill PDF.' });
  }
});

// POST /api/bills/lookup — { bill_number, phone }
router.post('/lookup', async (req, res) => {
  try {
    const { bill_number, phone } = req.body;
    if (!bill_number || !phone) {
      return res.status(400).json({ error: 'Bill number and phone number are both required.' });
    }
    const bill = await getBillByNumberAndPhone(bill_number, phone);
    if (!bill) {
      return res.status(404).json({ error: 'No bill found with that bill number and phone number. Please double-check and try again.' });
    }
    res.json({ bill });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// GET /api/bills/:billNumber/pdf?phone=... — download the bill PDF
router.get('/:billNumber/pdf', async (req, res) => {
  try {
    const phone = req.query.phone || '';
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });
    const bill = await getBillByNumberAndPhone(req.params.billNumber, phone);
    if (!bill) return res.status(404).json({ error: 'Bill not found.' });
    generateBillPDF(bill, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate bill PDF.' });
  }
});

module.exports = router;
