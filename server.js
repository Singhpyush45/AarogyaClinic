// server.js — main entry point
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const appointmentsRouter = require('./routes/appointments');
const adminRouter = require('./routes/admin');
const reviewsRouter = require('./routes/reviews');
const { initDb } = require('./db/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }, // tighten this to your real domain once deployed
});

app.set('io', io);

// ---- Middleware ----
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- API routes ----
app.use('/api/appointments', appointmentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/reviews', reviewsRouter);

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

// lets the frontend know when the doctor photo last changed, so it can
// cache-bust the <img> src and show the new photo immediately after upload
app.get('/api/doctor-photo-meta', (req, res) => {
  const photoPath = path.join(__dirname, 'public', 'assets', 'doctor.jpg');
  try {
    const stat = fs.statSync(photoPath);
    res.json({ updatedAt: stat.mtimeMs });
  } catch {
    res.json({ updatedAt: 0 });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- Socket.io: admin dashboard listens for 'new_appointment' / 'appointment_updated' ----
io.on('connection', (socket) => {
  // nothing special needed per-connection right now; events are broadcast
  // globally from the routes (see routes/appointments.js and routes/admin.js)
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
initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`\n  🌿 Aarogya Homeopathic Clinic server running`);
      console.log(`  ➜ Website:        http://localhost:${PORT}`);
      console.log(`  ➜ Admin Login:    http://localhost:${PORT}/admin.html`);
      console.log(`  ➜ Default admin:  ${process.env.ADMIN_USERNAME || 'admin'} / (see .env)\n`);
    });
  })
  .catch((err) => {
    console.error('\n❌ Could not connect to the database. Check your DATABASE_URL in .env.');
    console.error(err.message, '\n');
    process.exit(1);
  });
