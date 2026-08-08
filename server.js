// server.js — main entry point
require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const appointmentsRouter = require('./routes/appointments');
const adminRouter = require('./routes/admin');
const reviewsRouter = require('./routes/reviews');
const staffRouter = require('./routes/staff');
const receptionRouter = require('./routes/reception');
const doctorRouter = require('./routes/doctor');
const billingRouter = require('./routes/billing');
const medicinesRouter = require('./routes/medicines');
const publicBillsRouter = require('./routes/publicBills');
const attachmentsRouter = require('./routes/attachments');

const { initDb } = require('./db/database');
const { initClinicDb, getClinicAsset } = require('./db/clinic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // tighten this to your real domain once deployed
});

app.set('io', io);

// ---- Middleware ----
app.use(cors());

// Never let browsers/proxies/CDNs cache API responses — without this,
// some networks or browser disk caches can serve a stale GET response
// (e.g. doctor queue not showing a brand-new patient until re-login,
// which happens to get a fresh request context).
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- API routes ----
app.use('/api/appointments', appointmentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/reception', receptionRouter);
app.use('/api/doctor', doctorRouter);
app.use('/api/billing', billingRouter);
app.use('/api/medicines', medicinesRouter);
app.use('/api/bills', publicBillsRouter);
app.use('/api/attachments', attachmentsRouter);

// expose safe, non-secret clinic info to the frontend
app.get('/api/clinic-info', (req, res) => {
  res.json({
    name: process.env.CLINIC_NAME,
    doctor: process.env.CLINIC_DOCTOR,
    phone: process.env.CLINIC_PHONE,
    email: process.env.CLINIC_EMAIL,
    address: process.env.CLINIC_ADDRESS,
  });
});

// ---- Doctor photo: served from PostgreSQL, not a local file ----
// This is what makes the photo survive Render/Railway redeploys.
app.get('/api/doctor-photo', async (req, res) => {
  try {
    const asset = await getClinicAsset('doctor_photo');
    if (!asset) {
      // fall back to the bundled default image shipped with the repo
      return res.sendFile(path.join(__dirname, 'public', 'assets', 'doctor.jpg'));
    }
    res.set('Content-Type', asset.mime_type);
    res.set('Cache-Control', 'public, max-age=60');
    res.send(asset.data);
  } catch (err) {
    console.error(err);
    res.sendFile(path.join(__dirname, 'public', 'assets', 'doctor.jpg'));
  }
});

// lets the frontend know when the doctor photo last changed, so it can
// cache-bust the <img> src and show the new photo immediately after upload
app.get('/api/doctor-photo-meta', async (req, res) => {
  try {
    const asset = await getClinicAsset('doctor_photo');
    res.json({ updatedAt: asset ? new Date(asset.updated_at).getTime() : 0 });
  } catch {
    res.json({ updatedAt: 0 });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- Socket.io ----
io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

// ---- Fallback: serve index.html for the root ----
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Global error handler (keeps error responses clean JSON, no stack traces) ----
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

const PORT = process.env.PORT || 3000;

// Create tables (if they don't exist yet) before accepting traffic
Promise.resolve()
  .then(() => initDb())
  .then(() => initClinicDb())
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n  🌿 Aarogya Homeopathic Clinic server running`);
      console.log(`  ➜ Website:        http://localhost:${PORT}`);
      console.log(`  ➜ Site Admin:     http://localhost:${PORT}/admin.html`);
      console.log(`  ➜ Staff Login:    http://localhost:${PORT}/staff.html`);
    });
  })
  .catch((err) => {
    console.error('\n❌ Could not connect to the database. Check your DATABASE_URL in .env.');
    console.error(err.message, '\n');
    process.exit(1);
  });
