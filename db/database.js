// db/database.js
// -----------------------------------------------------------------------
// Uses Node's BUILT-IN SQLite module (node:sqlite) — no native compilation,
// no extra native dependency to break on deployment. Requires Node >= 22.5.
// -----------------------------------------------------------------------
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'clinic.db');
const db = new DatabaseSync(DB_PATH);

// ---- Schema ----
db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_code TEXT UNIQUE NOT NULL,
    patient_name    TEXT NOT NULL,
    phone           TEXT NOT NULL,
    email           TEXT,
    age             INTEGER,
    gender          TEXT,
    concern         TEXT,
    preferred_date  TEXT NOT NULL,
    preferred_time  TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled | completed
    created_at      TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(preferred_date);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name  TEXT NOT NULL,
    city          TEXT,
    rating        INTEGER NOT NULL DEFAULT 5,
    review_text   TEXT NOT NULL,
    source        TEXT NOT NULL DEFAULT 'patient_submitted', -- patient_submitted | admin_added
    status        TEXT NOT NULL DEFAULT 'visible',           -- visible | hidden
    created_at    TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// ---- Helpers to generate a short, simple appointment code ----
// 6 characters, easy to type/say aloud — no dashes, and we skip visually
// confusing characters (0/O, 1/I/L) so patients don't mistype it.
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0,O,1,I,L

function generateCode(length = 6) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function nextAppointmentCode() {
  // extremely unlikely to collide (32^6 ≈ 1 billion combos), but check anyway
  let code;
  let exists;
  do {
    code = generateCode();
    exists = db
      .prepare(`SELECT 1 FROM appointments WHERE appointment_code = ?`)
      .get(code);
  } while (exists);
  return code;
}

// ---- CRUD ----
function createAppointment(data) {
  const code = nextAppointmentCode();
  const stmt = db.prepare(`
    INSERT INTO appointments
      (appointment_code, patient_name, phone, email, age, gender, concern, preferred_date, preferred_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);
  const info = stmt.run(
    code,
    data.patient_name,
    data.phone,
    data.email || null,
    data.age || null,
    data.gender || null,
    data.concern || null,
    data.preferred_date,
    data.preferred_time
  );
  return getAppointmentById(info.lastInsertRowid);
}

function getAppointmentById(id) {
  return db.prepare(`SELECT * FROM appointments WHERE id = ?`).get(id);
}

function getAppointmentByCode(code) {
  return db
    .prepare(`SELECT * FROM appointments WHERE appointment_code = ?`)
    .get(code);
}

function listAppointments({ status, date, search } = {}) {
  let query = `SELECT * FROM appointments WHERE 1=1`;
  const params = [];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (date) {
    query += ` AND preferred_date = ?`;
    params.push(date);
  }
  if (search) {
    query += ` AND (patient_name LIKE ? OR phone LIKE ? OR appointment_code LIKE ?)`;
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  query += ` ORDER BY created_at DESC`;

  return db.prepare(query).all(...params);
}

function updateAppointmentStatus(id, status) {
  db.prepare(`UPDATE appointments SET status = ? WHERE id = ?`).run(
    status,
    id
  );
  return getAppointmentById(id);
}

function getStats() {
  const total = db.prepare(`SELECT COUNT(*) AS c FROM appointments`).get().c;
  const pending = db
    .prepare(`SELECT COUNT(*) AS c FROM appointments WHERE status = 'pending'`)
    .get().c;
  const confirmed = db
    .prepare(
      `SELECT COUNT(*) AS c FROM appointments WHERE status = 'confirmed'`
    )
    .get().c;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = db
    .prepare(
      `SELECT COUNT(*) AS c FROM appointments WHERE preferred_date = ?`
    )
    .get(today).c;

  return { total, pending, confirmed, todayCount };
}

// ---- Reviews ----
function createReview(data) {
  const stmt = db.prepare(`
    INSERT INTO reviews (patient_name, city, rating, review_text, source, status)
    VALUES (?, ?, ?, ?, ?, 'visible')
  `);
  const info = stmt.run(
    data.patient_name,
    data.city || null,
    data.rating,
    data.review_text,
    data.source || 'patient_submitted'
  );
  return getReviewById(info.lastInsertRowid);
}

function getReviewById(id) {
  return db.prepare(`SELECT * FROM reviews WHERE id = ?`).get(id);
}

function listVisibleReviews(limit = 20) {
  return db
    .prepare(
      `SELECT * FROM reviews WHERE status = 'visible' ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit);
}

function listAllReviews() {
  return db.prepare(`SELECT * FROM reviews ORDER BY created_at DESC`).all();
}

function updateReviewStatus(id, status) {
  db.prepare(`UPDATE reviews SET status = ? WHERE id = ?`).run(status, id);
  return getReviewById(id);
}

function deleteReview(id) {
  db.prepare(`DELETE FROM reviews WHERE id = ?`).run(id);
  return { deleted: true };
}

module.exports = {
  db,
  createAppointment,
  getAppointmentById,
  getAppointmentByCode,
  listAppointments,
  updateAppointmentStatus,
  getStats,
  createReview,
  getReviewById,
  listVisibleReviews,
  listAllReviews,
  updateReviewStatus,
  deleteReview,
};
