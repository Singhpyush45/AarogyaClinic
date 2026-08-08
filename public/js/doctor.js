// public/js/doctor.js
requireRole('doctor');
updateHeaderName();
initProfileModal('doctor');

document.getElementById('profileBtn').addEventListener('click', () => window.openProfileModal());
document.getElementById('logoutBtn').addEventListener('click', staffLogout);

// ---- Live notification: new patient added by reception ----
connectClinicSocket({
  new_visit: (visit) => {
    playBeep();
    showToast(`New patient in queue: ${visit.first_name || 'A patient'} ${visit.last_name || ''}`.trim());
    if (!queueView.classList.contains('hidden')) loadQueue();
  },
});

const RX_SECTIONS = [
  { key: 'chief_complaint', label: 'Chief Complaint' },
  { key: 'examination', label: 'Examination' },
  { key: 'diagnosis', label: 'Diagnosis' },
  { key: 'procedure_notes', label: 'Procedure' },
  { key: 'advice', label: 'Advice' },
  { key: 'investigation', label: 'Investigation' },
  { key: 'prognosis', label: 'Prognosis' },
  { key: 'findings', label: 'Findings' },
  { key: 'doctor_notes', label: 'Doctor Notes' },
  { key: 'emergency_instructions', label: 'Emergency Instructions' },
  { key: 'follow_up', label: 'Follow Up' },
];

const queueView = document.getElementById('queueView');
const rxView = document.getElementById('rxView');
const queueList = document.getElementById('queueList');
let currentVisitId = null;
let selectedMedicines = [];
let selectedPhotoRxFile = null;

async function loadDoctorStats() {
  try {
    const res = await staffFetch('/api/doctor/stats');
    const { stats } = await res.json();
    document.getElementById('statQueue').textContent = stats.queueCount;
    document.getElementById('statSeenToday').textContent = stats.seenToday;
    document.getElementById('statTotalSeen').textContent = stats.totalSeen;
  } catch (err) {}
}

// ---------------- Rx mode toggle (Digital vs Photo) ----------------
const digitalRxWrap = document.getElementById('digitalRxWrap');
const photoRxWrap = document.getElementById('photoRxWrap');
document.getElementById('modeDigital').addEventListener('change', () => {
  digitalRxWrap.classList.remove('hidden');
  photoRxWrap.classList.add('hidden');
});
document.getElementById('modePhoto').addEventListener('change', () => {
  digitalRxWrap.classList.add('hidden');
  photoRxWrap.classList.remove('hidden');
});

const photoRxInput = document.getElementById('photoRxInput');
document.getElementById('choosePhotoRxBtn').addEventListener('click', () => photoRxInput.click());
photoRxInput.addEventListener('change', () => {
  const file = photoRxInput.files[0];
  if (!file) return;
  selectedPhotoRxFile = file;
  document.getElementById('photoRxFileName').textContent = file.name;
  const preview = document.getElementById('photoRxPreview');
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.innerHTML = `<img src="${e.target.result}" style="max-width:280px;max-height:280px;border-radius:10px;border:1px solid var(--line);">`;
  };
  reader.readAsDataURL(file);
});

// ---------------- Queue ----------------
async function loadQueue() {
  queueList.innerHTML = '<p class="empty-state">Loading queue…</p>';
  try {
    const res = await staffFetch('/api/doctor/queue');
    const { queue } = await res.json();
    if (!queue.length) {
      queueList.innerHTML = `
        <div class="empty-card">
          <div class="empty-icon-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg></div>
          <div>
            <h3>No patients waiting right now.</h3>
            <p>New patients added by reception will appear here instantly.</p>
          </div>
        </div>`;
      return;
    }
    queueList.innerHTML = queue.map((v) => `
      <div class="queue-card">
        <div class="qc-info">
          <div class="qc-name">${escapeHtml(v.first_name)} ${escapeHtml(v.last_name || '')}</div>
          <div class="qc-meta">${escapeHtml(v.phone)} · ${escapeHtml(v.gender || '-')}, Age ${escapeHtml(v.age || '-')} ${v.chief_complaint ? '· ' + escapeHtml(v.chief_complaint) : ''}</div>
          <div class="qc-time">Added ${new Date(v.created_at).toLocaleTimeString()}</div>
        </div>
        <button class="btn btn-sm start-consult-btn" data-id="${v.id}">Start Consultation</button>
      </div>
    `).join('');
    document.querySelectorAll('.start-consult-btn').forEach((btn) => {
      btn.addEventListener('click', () => startConsultation(btn.dataset.id));
    });
  } catch (err) {
    queueList.innerHTML = '<p class="empty-state">Could not load queue.</p>';
  }
}
document.getElementById('refreshQueueBtn').addEventListener('click', loadQueue);
document.getElementById('refreshQueueBtn').addEventListener('click', loadDoctorStats);
document.getElementById('backToQueueBtn').addEventListener('click', () => {
  rxView.classList.add('hidden');
  queueView.classList.remove('hidden');
  loadQueue();
  loadDoctorStats();
});
loadQueue();
loadDoctorStats();

// ---------------- Tabs: Queue / History / Analytics ----------------
const tabQueueBtn = document.getElementById('tabQueueBtn');
const tabHistoryBtn = document.getElementById('tabHistoryBtn');
const tabAnalyticsBtn = document.getElementById('tabAnalyticsBtn');
const queueTabContent = document.getElementById('queueTabContent');
const historyTabContent = document.getElementById('historyTabContent');
const analyticsTabContent = document.getElementById('analyticsTabContent');

function switchTab(active) {
  [tabQueueBtn, tabHistoryBtn, tabAnalyticsBtn].forEach((b) => b.classList.remove('active'));
  [queueTabContent, historyTabContent, analyticsTabContent].forEach((c) => c.classList.add('hidden'));
  active.btn.classList.add('active');
  active.content.classList.remove('hidden');
}
tabQueueBtn.addEventListener('click', () => switchTab({ btn: tabQueueBtn, content: queueTabContent }));
tabHistoryBtn.addEventListener('click', () => { switchTab({ btn: tabHistoryBtn, content: historyTabContent }); loadDoctorHistory(); });
tabAnalyticsBtn.addEventListener('click', () => { switchTab({ btn: tabAnalyticsBtn, content: analyticsTabContent }); loadConsultingFee(); loadAnalytics(); });

// ---- History ----
const doctorHistoryRange = document.getElementById('doctorHistoryRange');
document.getElementById('doctorHistoryRange').addEventListener('change', () => {
  const isCustom = doctorHistoryRange.value === 'custom';
  document.getElementById('doctorHistoryFrom').classList.toggle('hidden', !isCustom);
  document.getElementById('doctorHistoryTo').classList.toggle('hidden', !isCustom);
});
document.getElementById('doctorHistoryGoBtn').addEventListener('click', loadDoctorHistory);

async function loadDoctorHistory() {
  const list = document.getElementById('doctorHistoryList');
  list.innerHTML = '<p class="empty-state">Loading…</p>';
  const range = doctorHistoryRange.value;
  const params = new URLSearchParams({ range });
  if (range === 'custom') {
    const f = document.getElementById('doctorHistoryFrom').value;
    const t = document.getElementById('doctorHistoryTo').value;
    if (f) params.set('from', f);
    if (t) params.set('to', t);
  }
  try {
    const res = await staffFetch(`/api/doctor/history?${params.toString()}`);
    const { history } = await res.json();
    if (!history.length) {
      list.innerHTML = '<p class="empty-state">No consultations in this period.</p>';
      return;
    }
    const STATUS_LABEL = { ready_for_billing: 'Sent to Billing', billed: 'Billed', completed: 'Completed', with_doctor: 'In Progress' };
    list.innerHTML = history.map((v) => `
      <div class="history-row">
        <div>
          <b>${escapeHtml(v.first_name)} ${escapeHtml(v.last_name || '')}</b> · ${escapeHtml(v.phone)}
          <span class="completed-tag">${STATUS_LABEL[v.status] || v.status}</span>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${escapeHtml(v.chief_complaint || '-')} · ${new Date(v.created_at).toLocaleString()}</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="empty-state">Could not load history.</p>';
  }
}

// ---- Analytics ----
const doctorAnalyticsRange = document.getElementById('doctorAnalyticsRange');
document.getElementById('doctorAnalyticsRange').addEventListener('change', () => {
  const isCustom = doctorAnalyticsRange.value === 'custom';
  document.getElementById('doctorAnalyticsFrom').classList.toggle('hidden', !isCustom);
  document.getElementById('doctorAnalyticsTo').classList.toggle('hidden', !isCustom);
});
document.getElementById('doctorAnalyticsGoBtn').addEventListener('click', loadAnalytics);

let revenueChartInstance = null;
let patientsChartInstance = null;
let revenueSplitChartInstance = null;
let topMedicinesChartInstance = null;

const CHART_COLORS = ['#6d8f70', '#c78a3f', '#4a6b8a', '#b3432c', '#8a6bb3', '#3f5b45', '#e0a94f', '#7a8574'];

async function loadAnalytics() {
  const errMsg = document.getElementById('analyticsErrorMsg');
  errMsg.textContent = '';

  if (typeof Chart === 'undefined') {
    errMsg.textContent = 'Chart library failed to load. Please refresh the page.';
    errMsg.style.color = 'var(--danger)';
    return;
  }

  const range = doctorAnalyticsRange.value;
  const params = new URLSearchParams({ range });
  if (range === 'custom') {
    const f = document.getElementById('doctorAnalyticsFrom').value;
    const t = document.getElementById('doctorAnalyticsTo').value;
    if (f) params.set('from', f);
    if (t) params.set('to', t);
  }
  try {
    const res = await staffFetch(`/api/doctor/analytics?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not load analytics.');
    const analytics = data.analytics;

    document.getElementById('anaPatients').textContent = analytics.patientCount;
    document.getElementById('anaConsultingFee').textContent = `₹${Number(analytics.totalConsultingFee).toFixed(0)}`;
    document.getElementById('anaMedicineRevenue').textContent = `₹${Number(analytics.totalMedicineRevenue).toFixed(0)}`;
    document.getElementById('anaTotalRevenue').textContent = `₹${Number(analytics.totalRevenue).toFixed(0)}`;

    const labels = analytics.dailyRevenue.map((d) => new Date(d.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    const revenueData = analytics.dailyRevenue.map((d) => Number(d.medicine_revenue));
    const patientLabels = analytics.dailyPatients.map((d) => new Date(d.day).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }));
    const patientData = analytics.dailyPatients.map((d) => d.c);

    if (revenueChartInstance) revenueChartInstance.destroy();
    revenueChartInstance = new Chart(document.getElementById('revenueChart'), {
      type: 'bar',
      data: { labels: labels.length ? labels : ['No data'], datasets: [{ label: 'Medicine Revenue (₹)', data: revenueData.length ? revenueData : [0], backgroundColor: '#6d8f70', borderRadius: 4 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });

    if (patientsChartInstance) patientsChartInstance.destroy();
    patientsChartInstance = new Chart(document.getElementById('patientsChart'), {
      type: 'line',
      data: { labels: patientLabels.length ? patientLabels : ['No data'], datasets: [{ label: 'Patients', data: patientData.length ? patientData : [0], borderColor: '#c78a3f', backgroundColor: 'rgba(199,138,63,.15)', fill: true, tension: 0.3 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
    });

    // Revenue split donut: consulting fee vs medicine sales
    if (revenueSplitChartInstance) revenueSplitChartInstance.destroy();
    const fee = Number(analytics.totalConsultingFee);
    const medRev = Number(analytics.totalMedicineRevenue);
    revenueSplitChartInstance = new Chart(document.getElementById('revenueSplitChart'), {
      type: 'doughnut',
      data: {
        labels: ['Consulting Fee', 'Medicine Sales'],
        datasets: [{ data: (fee + medRev) > 0 ? [fee, medRev] : [1, 0], backgroundColor: ['#c78a3f', '#6d8f70'] }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } },
    });

    // Top medicines sold (pie)
    if (topMedicinesChartInstance) topMedicinesChartInstance.destroy();
    const topMeds = analytics.topMedicines || [];
    topMedicinesChartInstance = new Chart(document.getElementById('topMedicinesChart'), {
      type: 'pie',
      data: {
        labels: topMeds.length ? topMeds.map((m) => m.medicine_name) : ['No sales yet'],
        datasets: [{ data: topMeds.length ? topMeds.map((m) => Number(m.revenue)) : [1], backgroundColor: CHART_COLORS }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } } } },
    });
  } catch (err) {
    console.error(err);
    errMsg.textContent = err.message || 'Could not load analytics. Please try again.';
    errMsg.style.color = 'var(--danger)';
  }
}

// ---- Consulting Fee ----
async function loadConsultingFee() {
  try {
    const res = await staffFetch('/api/doctor/consulting-fee');
    const { fee } = await res.json();
    document.getElementById('consultingFeeInput').value = fee;
  } catch (err) {}
}
document.getElementById('saveConsultingFeeBtn').addEventListener('click', async () => {
  const msg = document.getElementById('consultingFeeMsg');
  msg.textContent = '';
  const fee = document.getElementById('consultingFeeInput').value;
  try {
    const res = await staffFetch('/api/doctor/consulting-fee', { method: 'PUT', body: JSON.stringify({ fee }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    msg.textContent = 'Saved!';
    msg.style.color = 'var(--sage-deep)';
    showToast('Consulting fee updated.');
  } catch (err) {
    msg.textContent = err.message;
    msg.style.color = 'var(--danger)';
  }
});

// ---------------- Start consultation / Rx view ----------------
async function startConsultation(visitId) {
  try {
    await staffFetch(`/api/doctor/visits/${visitId}/start`, { method: 'POST' });
    const res = await staffFetch(`/api/doctor/visits/${visitId}`);
    const { visit, history } = await res.json();

    currentVisitId = visitId;
    selectedMedicines = [];
    selectedPhotoRxFile = null;
    document.getElementById('modeDigital').checked = true;
    digitalRxWrap.classList.remove('hidden');
    photoRxWrap.classList.add('hidden');
    document.getElementById('photoRxFileName').textContent = '';
    document.getElementById('photoRxPreview').innerHTML = '';
    photoRxInput.value = '';

    document.getElementById('rxPatientName').textContent = `${visit.first_name} ${visit.last_name || ''}`;
    document.getElementById('patientHeaderCard').innerHTML = `
      <div class="form-grid cols-3" style="font-size:13px;">
        <div><b>Phone:</b> ${escapeHtml(visit.phone)}</div>
        <div><b>Gender/Age:</b> ${escapeHtml(visit.gender || '-')}, ${escapeHtml(visit.age || '-')}</div>
        <div><b>BP:</b> ${escapeHtml(visit.bp || '-')} &nbsp; <b>Temp:</b> ${escapeHtml(visit.temperature || '-')} &nbsp; <b>Pulse:</b> ${escapeHtml(visit.pulse || '-')}</div>
      </div>
      <div style="margin-top:8px;font-size:13px;"><b>Chief Complaint (from reception):</b> ${escapeHtml(visit.chief_complaint || '-')}</div>
      ${history.length ? `<div style="margin-top:10px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:12.5px;color:var(--ink-soft);">📋 ${history.length} previous visit(s)${history.some(h => h.has_photo_rx) ? ' · 📷 includes Photo Rx' : ''}</span>
        <button type="button" class="btn-outline btn-sm" id="viewHistoryBtn">View Full History</button>
      </div>` : ''}
    `;
    if (history.length) {
      document.getElementById('viewHistoryBtn').addEventListener('click', () => {
        showPatientHistoryModal(`${visit.first_name} ${visit.last_name || ''}`, history);
      });
    }

    renderRxSections();
    document.getElementById('medList').innerHTML = '';
    document.getElementById('medSearchInput').value = '';
    loadAttachments(visitId);

    queueView.classList.add('hidden');
    rxView.classList.remove('hidden');
    window.scrollTo(0, 0);
  } catch (err) {
    alert('Could not open patient.');
  }
}

// ---------------- Attachments (lab reports, documents) ----------------
document.getElementById('addAttachmentBtn').addEventListener('click', () => document.getElementById('attachmentInput').click());
document.getElementById('attachmentInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || !currentVisitId) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await staffFetch(`/api/attachments/visit/${currentVisitId}`, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not upload file.');
    showToast('File attached.');
    loadAttachments(currentVisitId);
  } catch (err) {
    alert(err.message);
  } finally {
    e.target.value = '';
  }
});

async function loadAttachments(visitId) {
  const list = document.getElementById('attachmentsList');
  list.innerHTML = '<span style="font-size:12px;color:var(--ink-soft);">Loading…</span>';
  try {
    const res = await staffFetch(`/api/attachments/visit/${visitId}`);
    const { attachments } = await res.json();
    if (!attachments.length) {
      list.innerHTML = '<span style="font-size:12px;color:var(--ink-soft);">No attachments yet.</span>';
      return;
    }
    list.innerHTML = attachments.map((a) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:var(--cream);border-radius:8px;margin-bottom:6px;font-size:12.5px;">
        <a href="/api/attachments/${a.id}?token=${getStaffToken()}" target="_blank">${escapeHtml(a.filename)}</a>
        <span style="color:var(--ink-soft);">${new Date(a.uploaded_at).toLocaleDateString()}</span>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<span style="font-size:12px;color:var(--ink-soft);">Could not load attachments.</span>';
  }
}

// ---------------- Rx sections + Quick Type ----------------
function renderRxSections() {
  const nav = document.getElementById('rxNav');
  const sectionsEl = document.getElementById('rxSections');
  nav.innerHTML = RX_SECTIONS.map((s, i) => `<button data-section="${s.key}" class="${i === 0 ? 'active' : ''}">${s.label}</button>`).join('');
  sectionsEl.innerHTML = RX_SECTIONS.map((s, i) => `
    <div class="rx-section ${i === 0 ? 'active' : ''}" data-section="${s.key}">
      <div class="form-card">
        <h3>${s.label}</h3>
        <div class="quick-type-row" id="qt-${s.key}"><span style="font-size:12px;color:var(--ink-soft);">Loading suggestions…</span></div>
        <textarea id="field-${s.key}" rows="4" placeholder="Type ${s.label.toLowerCase()}…"></textarea>
      </div>
    </div>
  `).join('');

  nav.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      nav.querySelectorAll('button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      sectionsEl.querySelectorAll('.rx-section').forEach((sec) => sec.classList.toggle('active', sec.dataset.section === btn.dataset.section));
    });
  });

  RX_SECTIONS.forEach((s) => loadQuickType(s.key));
}

async function loadQuickType(section) {
  const container = document.getElementById(`qt-${section}`);
  try {
    const res = await staffFetch(`/api/doctor/quick-type/${section}`);
    const { suggestions } = await res.json();
    container.innerHTML = suggestions.map((s) => `<button type="button" class="qt-chip" data-text="${escapeHtml(s.text)}" data-section="${section}">${escapeHtml(s.text)}</button>`).join('')
      + `<button type="button" class="qt-add-btn" data-section="${section}">+ Add</button>`;

    container.querySelectorAll('.qt-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const field = document.getElementById(`field-${section}`);
        field.value = field.value ? field.value + ', ' + chip.dataset.text : chip.dataset.text;
      });
    });
    container.querySelector('.qt-add-btn').addEventListener('click', async () => {
      const text = prompt('Add a new quick-type suggestion for this section:');
      if (!text || !text.trim()) return;
      await staffFetch('/api/doctor/quick-type', { method: 'POST', body: JSON.stringify({ section, text: text.trim() }) });
      loadQuickType(section);
    });
  } catch (err) {
    container.innerHTML = '';
  }
}

// ---------------- Medicine search & selection ----------------
const medSearchInput = document.getElementById('medSearchInput');
const medSuggestions = document.getElementById('medSuggestions');
let medSearchTimer;

medSearchInput.addEventListener('input', () => {
  clearTimeout(medSearchTimer);
  const q = medSearchInput.value.trim();
  if (!q) { medSuggestions.classList.add('hidden'); return; }
  medSearchTimer = setTimeout(async () => {
    try {
      const res = await staffFetch(`/api/medicines?search=${encodeURIComponent(q)}`);
      const { medicines } = await res.json();
      if (!medicines.length) { medSuggestions.classList.add('hidden'); return; }
      medSuggestions.innerHTML = medicines.map((m) => `
        <div class="med-suggestion-item" data-id="${m.id}" data-name="${escapeHtml(m.name)}" data-price="${m.price || ''}">
          ${escapeHtml(m.name)} ${m.strength ? `(${escapeHtml(m.strength)})` : ''}
          ${m.stock_quantity != null && m.stock_quantity <= (m.low_stock_threshold || 10) ? '<span style="color:var(--danger);font-size:11px;font-weight:700;margin-left:6px;">Low Stock</span>' : ''}
          ${m.price ? `<span class="price">₹${m.price}</span>` : ''}
        </div>
      `).join('');
      medSuggestions.classList.remove('hidden');
      medSuggestions.querySelectorAll('.med-suggestion-item').forEach((item) => {
        item.addEventListener('click', () => {
          addMedicine({ medicine_id: item.dataset.id, medicine_name: item.dataset.name, price: item.dataset.price || '' });
          medSearchInput.value = '';
          medSuggestions.classList.add('hidden');
        });
      });
    } catch (err) {}
  }, 300);
});

document.getElementById('addCustomMedBtn').addEventListener('click', () => {
  const name = medSearchInput.value.trim();
  if (!name) return alert('Type a medicine name first.');
  addMedicine({ medicine_id: null, medicine_name: name, price: '' });
  medSearchInput.value = '';
  medSuggestions.classList.add('hidden');
});

function addMedicine(med) {
  selectedMedicines.push({ ...med, dosage: '', instructions: '' });
  renderMedList();
}

// homeopathic medicines: one unit (tube/bottle) per line item — no quantity field
function renderMedList() {
  const medList = document.getElementById('medList');
  medList.innerHTML = selectedMedicines.map((m, i) => `
    <div class="med-row" style="grid-template-columns:1.6fr 1fr 1.2fr auto;">
      <input type="text" value="${escapeHtml(m.medicine_name)}" readonly style="font-weight:600;">
      <input type="text" placeholder="Dosage" value="${escapeHtml(m.dosage)}" data-i="${i}" data-field="dosage">
      <input type="text" placeholder="Instructions" value="${escapeHtml(m.instructions)}" data-i="${i}" data-field="instructions">
      <button type="button" class="remove-med" data-i="${i}">✕</button>
    </div>
  `).join('');

  medList.querySelectorAll('input[data-field]').forEach((inp) => {
    inp.addEventListener('input', () => {
      selectedMedicines[inp.dataset.i][inp.dataset.field] = inp.value;
    });
  });
  medList.querySelectorAll('.remove-med').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMedicines.splice(btn.dataset.i, 1);
      renderMedList();
    });
  });
}

// ---------------- Save prescription ----------------
document.getElementById('saveRxBtn').addEventListener('click', async () => {
  const rxMsg = document.getElementById('rxMsg');
  rxMsg.textContent = '';
  const saveBtn = document.getElementById('saveRxBtn');

  const isPhotoMode = document.getElementById('modePhoto').checked;
  if (isPhotoMode && !selectedPhotoRxFile) {
    rxMsg.textContent = 'Please choose a prescription photo to upload.';
    rxMsg.style.color = 'var(--danger)';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const sections = { mode: isPhotoMode ? 'photo' : 'digital' };
  if (!isPhotoMode) {
    RX_SECTIONS.forEach((s) => { sections[s.key] = document.getElementById(`field-${s.key}`).value; });
  }
  sections.medicines = selectedMedicines.map((m) => ({
    medicine_id: m.medicine_id || null,
    medicine_name: m.medicine_name,
    dosage: m.dosage,
    instructions: m.instructions,
    price: m.price || null,
  }));

  try {
    const res = await staffFetch(`/api/doctor/visits/${currentVisitId}/prescription`, {
      method: 'POST', body: JSON.stringify(sections),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save prescription.');

    if (isPhotoMode && selectedPhotoRxFile) {
      const formData = new FormData();
      formData.append('photo', selectedPhotoRxFile);
      const photoRes = await staffFetch(`/api/doctor/visits/${currentVisitId}/photo-rx`, { method: 'POST', body: formData });
      if (!photoRes.ok) {
        const photoErr = await photoRes.json();
        throw new Error(photoErr.error || 'Prescription saved, but photo upload failed.');
      }
    }

    showToast('Prescription saved — sent to billing!');
    rxView.classList.add('hidden');
    queueView.classList.remove('hidden');
    loadQueue();
  } catch (err) {
    rxMsg.textContent = err.message;
    rxMsg.style.color = 'var(--danger)';
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Prescription & Send to Billing';
  }
});
