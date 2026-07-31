// public/js/admin.js
const API = '/api/admin';
let TOKEN = localStorage.getItem('aarogya_admin_token') || null;

const loginScreen = document.getElementById('loginScreen');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('loginForm');
const loginMsg = document.getElementById('loginMsg');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const apptTbody = document.getElementById('apptTbody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const refreshBtn = document.getElementById('refreshBtn');
const toast = document.getElementById('toast');

// ---------------- Auth flow ----------------
function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboard.classList.remove('hidden');
  loadStats();
  loadAppointments();
  loadDoctorPhoto();
  loadAdminReviews();
  connectSocket();
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showLogin() {
  dashboard.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

if (TOKEN) {
  showDashboard();
} else {
  showLogin();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';

  const payload = Object.fromEntries(new FormData(loginForm).entries());

  try {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    TOKEN = data.token;
    localStorage.setItem('aarogya_admin_token', TOKEN);
    loginForm.reset();
    showDashboard();
  } catch (err) {
    loginMsg.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log In';
  }
});

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('aarogya_admin_token');
  TOKEN = null;
  showLogin();
});

// ---------------- API helpers ----------------
async function authFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${TOKEN}`,
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem('aarogya_admin_token');
    TOKEN = null;
    showLogin();
    throw new Error('Session expired.');
  }
  return res;
}

// ---------------- Stats ----------------
async function loadStats() {
  try {
    const res = await authFetch(`${API}/stats`);
    const { stats } = await res.json();
    document.getElementById('statTotal').textContent = stats.total;
    document.getElementById('statPending').textContent = stats.pending;
    document.getElementById('statConfirmed').textContent = stats.confirmed;
    document.getElementById('statToday').textContent = stats.todayCount;
  } catch (err) {
    console.error(err);
  }
}

// ---------------- Appointments table ----------------
async function loadAppointments() {
  apptTbody.innerHTML = `<tr><td colspan="9" class="empty-row">Loading appointments…</td></tr>`;

  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('search', searchInput.value.trim());
  if (statusFilter.value) params.set('status', statusFilter.value);

  try {
    const res = await authFetch(`${API}/appointments?${params.toString()}`);
    const { appointments } = await res.json();
    renderTable(appointments);
  } catch (err) {
    apptTbody.innerHTML = `<tr><td colspan="9" class="empty-row">Could not load appointments.</td></tr>`;
  }
}

function renderTable(rows) {
  if (!rows.length) {
    apptTbody.innerHTML = `<tr><td colspan="9" class="empty-row">No appointments found.</td></tr>`;
    return;
  }

  apptTbody.innerHTML = rows
    .map(
      (a) => `
    <tr data-id="${a.id}">
      <td>${a.appointment_code}</td>
      <td>${escapeHtml(a.patient_name)}${a.age ? `, ${a.age}` : ''}${a.gender ? ` (${a.gender[0]})` : ''}</td>
      <td>${escapeHtml(a.phone)}</td>
      <td>${a.preferred_date}</td>
      <td>${a.preferred_time}</td>
      <td>${a.concern ? escapeHtml(a.concern).slice(0, 40) : '-'}</td>
      <td><span class="status-badge status-${a.status}">${a.status}</span></td>
      <td><a class="receipt-link" href="/api/admin/appointments/${a.id}/receipt?token=${TOKEN}" target="_blank">Download</a></td>
      <td>
        <select class="status-select" data-id="${a.id}">
          <option value="pending" ${a.status === 'pending' ? 'selected' : ''}>Pending</option>
          <option value="confirmed" ${a.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="completed" ${a.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${a.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
    </tr>`
    )
    .join('');

  document.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      const id = e.target.dataset.id;
      const status = e.target.value;
      try {
        await authFetch(`${API}/appointments/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        loadStats();
        loadAppointments();
      } catch (err) {
        alert('Could not update status.');
      }
    });
  });
}

searchInput.addEventListener('input', debounce(loadAppointments, 350));
statusFilter.addEventListener('change', loadAppointments);
refreshBtn.addEventListener('click', () => {
  loadStats();
  loadAppointments();
});

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------------- Doctor Photo Upload ----------------
const currentDoctorPhoto = document.getElementById('currentDoctorPhoto');
const photoInput = document.getElementById('photoInput');
const choosePhotoBtn = document.getElementById('choosePhotoBtn');
const uploadPhotoBtn = document.getElementById('uploadPhotoBtn');
const photoFileName = document.getElementById('photoFileName');
const photoMsg = document.getElementById('photoMsg');

function loadDoctorPhoto() {
  fetch('/api/doctor-photo-meta')
    .then((r) => r.json())
    .then(({ updatedAt }) => {
      if (updatedAt) currentDoctorPhoto.src = `assets/doctor.jpg?v=${updatedAt}`;
    })
    .catch(() => {});
}

choosePhotoBtn.addEventListener('click', () => photoInput.click());

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  photoFileName.textContent = file ? file.name : '';
  uploadPhotoBtn.disabled = !file;
});

uploadPhotoBtn.addEventListener('click', async () => {
  const file = photoInput.files[0];
  if (!file) return;

  photoMsg.textContent = '';
  photoMsg.className = 'form-msg';
  uploadPhotoBtn.disabled = true;
  uploadPhotoBtn.textContent = 'Uploading…';

  const formData = new FormData();
  formData.append('photo', file);

  try {
    const res = await fetch('/api/admin/doctor-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed.');

    currentDoctorPhoto.src = `assets/doctor.jpg?v=${data.updatedAt}`;
    photoMsg.textContent = 'Photo updated! It is now live on the website.';
    photoMsg.className = 'form-msg success';
    photoInput.value = '';
    photoFileName.textContent = '';
  } catch (err) {
    photoMsg.textContent = err.message;
    photoMsg.className = 'form-msg error';
  } finally {
    uploadPhotoBtn.disabled = true;
    uploadPhotoBtn.textContent = 'Upload Photo';
  }
});

// ---------------- Reviews Management ----------------
const addReviewToggleBtn = document.getElementById('addReviewToggleBtn');
const adminReviewForm = document.getElementById('adminReviewForm');
const reviewsAdminList = document.getElementById('reviewsAdminList');

addReviewToggleBtn.addEventListener('click', () => {
  adminReviewForm.classList.toggle('hidden');
});

adminReviewForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(adminReviewForm).entries());
  try {
    const res = await authFetch(`${API}/reviews`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not add review.');
    adminReviewForm.reset();
    adminReviewForm.classList.add('hidden');
    loadAdminReviews();
  } catch (err) {
    alert(err.message);
  }
});

async function loadAdminReviews() {
  reviewsAdminList.innerHTML = `<p class="empty-row">Loading reviews…</p>`;
  try {
    const res = await authFetch(`${API}/reviews`);
    const { reviews } = await res.json();
    renderAdminReviews(reviews);
  } catch (err) {
    reviewsAdminList.innerHTML = `<p class="empty-row">Could not load reviews.</p>`;
  }
}

function renderAdminReviews(reviews) {
  if (!reviews.length) {
    reviewsAdminList.innerHTML = `<p class="empty-row">No reviews yet.</p>`;
    return;
  }
  reviewsAdminList.innerHTML = reviews
    .map(
      (r) => `
    <div class="review-item ${r.status === 'hidden' ? 'hidden-review' : ''}" data-id="${r.id}">
      <div class="review-item-body">
        <div class="stars-sm">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
        <span class="r-name">${escapeHtml(r.patient_name)}</span><span class="r-city">${escapeHtml(r.city || '')}</span>
        <div class="r-text">${escapeHtml(r.review_text)}</div>
        <div class="r-meta">${r.source === 'admin_added' ? 'Added by staff' : 'Submitted by patient'} · ${r.status} · ${r.created_at}</div>
      </div>
      <div class="review-item-actions">
        <button class="toggle-visibility-btn" data-id="${r.id}" data-status="${r.status}">${r.status === 'visible' ? 'Hide' : 'Show'}</button>
        <button class="danger delete-review-btn" data-id="${r.id}">Delete</button>
      </div>
    </div>`
    )
    .join('');

  document.querySelectorAll('.toggle-visibility-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const newStatus = btn.dataset.status === 'visible' ? 'hidden' : 'visible';
      await authFetch(`${API}/reviews/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      loadAdminReviews();
    });
  });

  document.querySelectorAll('.delete-review-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this review permanently?')) return;
      await authFetch(`${API}/reviews/${btn.dataset.id}`, { method: 'DELETE' });
      loadAdminReviews();
    });
  });
}

// ---------------- Live updates via Socket.io ----------------
function connectSocket() {
  const socket = io();

  socket.on('new_appointment', (appt) => {
    playBeep();
    showToast(`New booking: ${appt.patient_name}`, `${appt.preferred_date} at ${appt.preferred_time} · ${appt.appointment_code}`);
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Appointment — Aarogya Clinic', {
        body: `${appt.patient_name} · ${appt.preferred_date} at ${appt.preferred_time}`,
      });
    }
    loadStats();
    loadAppointments();
  });

  socket.on('appointment_updated', () => {
    loadStats();
    loadAppointments();
  });

  socket.on('new_review', (review) => {
    playBeep();
    showToast(`New review from ${review.patient_name}`, `${'★'.repeat(review.rating)} — "${review.review_text.slice(0, 60)}${review.review_text.length > 60 ? '…' : ''}"`);
    loadAdminReviews();
  });
}

function showToast(title, body) {
  toast.innerHTML = `<b>${escapeHtml(title)}</b>${escapeHtml(body)}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 5000);
}

// simple beep using Web Audio API — no external sound file needed
function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.15;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, 220);
  } catch (e) {
    // ignore if audio isn't available
  }
}
