// public/js/clinic-common.js — shared across doctor.html, reception.html, billing.html
const STAFF_TOKEN_KEY = 'aarogya_staff_token';
const STAFF_ROLE_KEY = 'aarogya_staff_role';
const STAFF_NAME_KEY = 'aarogya_staff_name';

function getStaffToken() { return localStorage.getItem(STAFF_TOKEN_KEY); }

// Call at the top of every dashboard page. Redirects to login if not
// authenticated, or if logged in under the wrong role.
function requireRole(expectedRole) {
  const token = getStaffToken();
  const role = localStorage.getItem(STAFF_ROLE_KEY);
  if (!token || role !== expectedRole) {
    window.location.href = '/staff.html';
    throw new Error('redirecting');
  }
  return token;
}

async function staffFetch(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    cache: 'no-store',
    headers: {
      ...(opts.headers || {}),
      Authorization: `Bearer ${getStaffToken()}`,
      ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(STAFF_TOKEN_KEY);
    localStorage.removeItem(STAFF_ROLE_KEY);
    window.location.href = '/staff.html';
    throw new Error('Session expired');
  }
  return res;
}

function staffLogout() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem(STAFF_ROLE_KEY);
  localStorage.removeItem(STAFF_NAME_KEY);
  window.location.href = '/staff.html';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function showToast(message) {
  let toast = document.getElementById('sharedToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sharedToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

// ---- Shared profile modal (name/photo/age/mobile/address/reg-number) ----
function initProfileModal(role) {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'profileModal';
  modal.innerHTML = `
    <div class="modal-box">
      <button class="modal-close-x" id="profileModalClose">&times;</button>
      <h3>My Profile</h3>
      <div class="field" style="text-align:center;margin-bottom:16px;">
        <div id="profilePhotoPreview" style="width:80px;height:80px;border-radius:50%;background:var(--sage-soft);margin:0 auto 10px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:28px;color:var(--sage-deep);">👤</div>
        <input type="file" id="profilePhotoInput" accept="image/jpeg,image/png,image/webp" class="hidden">
        <button type="button" class="btn-outline btn-sm" id="profilePhotoBtn">Change Photo</button>
      </div>
      <form id="profileForm">
        <div class="field"><label>Full Name</label><input type="text" name="full_name"></div>
        <div class="form-grid">
          <div class="field"><label>Age</label><input type="number" name="age"></div>
          <div class="field"><label>Mobile</label><input type="tel" name="mobile"></div>
        </div>
        <div class="field"><label>Address</label><textarea name="address" rows="2"></textarea></div>
        ${role === 'doctor' ? '<div class="field"><label>Registration / UDI Number</label><input type="text" name="registration_number"></div>' : ''}
        <button type="submit" class="btn" style="width:100%;">Save Profile</button>
        <p class="login-msg" id="profileMsg"></p>
      </form>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('profileModalClose').addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  document.getElementById('profilePhotoBtn').addEventListener('click', () => document.getElementById('profilePhotoInput').click());
  document.getElementById('profilePhotoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      await staffFetch('/api/staff/me/photo', { method: 'POST', body: formData });
      loadProfilePhoto();
      showToast('Photo updated');
    } catch (err) { alert('Could not upload photo'); }
  });

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    try {
      const res = await staffFetch('/api/staff/me', { method: 'PUT', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      document.getElementById('profileMsg').textContent = 'Saved!';
      document.getElementById('profileMsg').style.color = 'var(--sage-deep)';
      localStorage.setItem(STAFF_NAME_KEY, payload.full_name || localStorage.getItem(STAFF_NAME_KEY));
      updateHeaderName();
    } catch (err) {
      document.getElementById('profileMsg').textContent = err.message || 'Could not save.';
    }
  });

  async function loadProfilePhoto() {
    const staffId = JSON.parse(atob(getStaffToken().split('.')[1])).staffId;
    const img = document.createElement('img');
    img.src = `/api/staff/${staffId}/photo?t=${Date.now()}&token=${getStaffToken()}`;
    img.onerror = () => {};
    const preview = document.getElementById('profilePhotoPreview');
    preview.innerHTML = '';
    const testImg = new Image();
    testImg.onload = () => { preview.innerHTML = ''; preview.appendChild(img); img.style.width = '100%'; img.style.height = '100%'; img.style.objectFit = 'cover'; };
    testImg.onerror = () => { preview.innerHTML = '👤'; };
    testImg.src = img.src;
  }

  window.openProfileModal = async () => {
    try {
      const res = await staffFetch('/api/staff/me');
      const { staff } = await res.json();
      const form = document.getElementById('profileForm');
      form.full_name.value = staff.full_name || '';
      form.age.value = staff.age || '';
      form.mobile.value = staff.mobile || '';
      form.address.value = staff.address || '';
      if (form.registration_number) form.registration_number.value = staff.registration_number || '';
      loadProfilePhoto();
      modal.classList.add('open');
    } catch (err) {}
  };
}

function updateHeaderName() {
  const name = localStorage.getItem(STAFF_NAME_KEY) || 'Staff';
  const el = document.getElementById('staffNameDisplay');
  if (el) el.textContent = name;
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.textContent = `Welcome back, ${name}`;
}

// ---- Shared live-notification socket (used by doctor.js, billing.js) ----
function connectClinicSocket(eventHandlers) {
  const socket = io();
  Object.entries(eventHandlers).forEach(([event, handler]) => {
    socket.on(event, handler);
  });
  return socket;
}

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
    setTimeout(() => { o.stop(); ctx.close(); }, 220);
  } catch (e) {}
}

// ---- Shared patient history timeline modal ----
function showPatientHistoryModal(patientName, history) {
  let modal = document.getElementById('historyModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'historyModal';
    modal.innerHTML = `<div class="modal-box"><button class="modal-close-x" id="historyModalClose">&times;</button><div id="historyModalBody"></div></div>`;
    document.body.appendChild(modal);
    document.getElementById('historyModalClose').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
  }

  const body = document.getElementById('historyModalBody');
  if (!history.length) {
    body.innerHTML = `<h3>Visit History — ${escapeHtml(patientName)}</h3><p class="empty-state">No previous visits on record.</p>`;
  } else {
    body.innerHTML = `
      <h3>Visit History — ${escapeHtml(patientName)}</h3>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
        ${history.map((v) => `
          <div style="border-left:3px solid var(--sage);padding:10px 14px;background:var(--cream);border-radius:0 8px 8px 0;">
            <div style="font-size:12px;color:var(--ink-soft);font-weight:700;">${new Date(v.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · ${escapeHtml(v.status)}</div>
            ${v.chief_complaint ? `<div style="font-size:13px;margin-top:4px;"><b>Complaint:</b> ${escapeHtml(v.chief_complaint)}</div>` : ''}
            ${v.bp || v.temperature || v.pulse ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">BP: ${escapeHtml(v.bp || '-')} · Temp: ${escapeHtml(v.temperature || '-')} · Pulse: ${escapeHtml(v.pulse || '-')}</div>` : ''}
            ${v.prescription ? `
              <div style="font-size:13px;margin-top:6px;padding-top:6px;border-top:1px dashed var(--line);">
                ${v.prescription.mode === 'photo' ? '📷 Photo Rx on file' : ''}
                ${v.prescription.diagnosis ? `<b>Diagnosis:</b> ${escapeHtml(v.prescription.diagnosis)}` : ''}
                ${v.prescription.advice ? `<br><b>Advice:</b> ${escapeHtml(v.prescription.advice)}` : ''}
              </div>
            ` : v.has_photo_rx ? '<div style="font-size:12px;margin-top:6px;">📷 Photo Rx on file</div>' : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
  modal.classList.add('open');
}
