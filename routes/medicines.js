// routes/medicines.js — shared medicine master list (doctor + billing can access)
const express = require('express');
const router = express.Router();
const { requireStaffRole } = require('../middleware/staffAuth');
const { searchMedicines, listMedicines, createMedicine, updateMedicine } = require('../db/clinic');

router.use(requireStaffRole(['doctor', 'billing']));

// GET /api/medicines?search=...
router.get('/', async (req, res) => {
  try {
    const medicines = req.query.search ? await searchMedicines(req.query.search) : await listMedicines();
    res.json({ medicines });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load medicines.' });
  }
});

// POST /api/medicines — add new medicine to master list
router.post('/', async (req, res) => {
  try {
    const { name, strength, price, category, stock_quantity, low_stock_threshold, expiry_date } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Medicine name is required.' });
    const medicine = await createMedicine({ name: name.trim(), strength, price, category, stock_quantity, low_stock_threshold, expiry_date });
    res.status(201).json({ success: true, medicine });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add medicine.' });
  }
});

// PUT /api/medicines/:id
router.put('/:id', async (req, res) => {
  try {
    const medicine = await updateMedicine(req.params.id, req.body);
    res.json({ success: true, medicine });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update medicine.' });
  }
});

module.exports = router;
