// routes/reviews.js
const express = require('express');
const router = express.Router();

const { createReview, listVisibleReviews } = require('../db/database');

function validateReview(body) {
  const errors = [];
  if (!body.patient_name || body.patient_name.trim().length < 2) {
    errors.push('Name is required.');
  }
  if (!body.review_text || body.review_text.trim().length < 10) {
    errors.push('Please write at least a short sentence about your experience.');
  }
  if (body.review_text && body.review_text.length > 600) {
    errors.push('Review is too long (max 600 characters).');
  }
  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) {
    errors.push('Please select a rating between 1 and 5.');
  }
  return errors;
}

// GET /api/reviews — public, only visible reviews, newest first
router.get('/', (req, res) => {
  const reviews = listVisibleReviews(20);
  res.json({ reviews });
});

// POST /api/reviews — a patient submits their own review.
// Goes live immediately (no admin approval needed), matching how the
// clinic wants it — but the admin dashboard can hide/delete any review
// afterwards if it's spam or inappropriate.
router.post('/', (req, res) => {
  const errors = validateReview(req.body);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  try {
    const review = createReview({
      patient_name: req.body.patient_name.trim(),
      city: (req.body.city || '').trim(),
      rating: Number(req.body.rating),
      review_text: req.body.review_text.trim(),
      source: 'patient_submitted',
    });

    const io = req.app.get('io');
    if (io) io.emit('new_review', review);

    res.status(201).json({ success: true, review });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not submit review. Please try again.' });
  }
});

module.exports = router;
