// public/js/reception.js
requireRole('reception');
updateHeaderName();
initProfileModal('reception');

document.getElementById('profileBtn').addEventListener('click', () => window.openProfileModal());
document.getElementById('logoutBtn').addEventListener('click', staffLogout);

const searchPhone = document.getElementById('searchPhone');
const searchBtn = document.getElementById('searchBtn');
const searchResults = document.getElementById('searchResults');
const intakeForm = document.getElementById('intakeForm');
const intakeFormTitle = document.getElementById('intakeFormTitle');
const patientIdField = document.getElementById('patientIdField');
const intakeMsg = document.getElementById('intakeMsg');
const intakeSubmitBtn = document.getElementById('intakeSubmitBtn');

searchBtn.addEventListener('click', async () => {
  const phone = searchPhone.value.trim();
  if (!phone) return;
  searchResults.innerHTML = '<p style="font-size:13px;color:var(--ink-soft);margin-top:10px;">Searching…</p>';

  try {
    const res = await staffFetch(`/api/reception/patients/search?phone=${encodeURIComponent(phone)}`);
    const { patients } = await res.json();

    if (!patients.length) {
      searchResults.innerHTML = '<p style="font-size:13px;color:var(--ink-soft);margin-top:10px;">No existing patient found — you can register a new one below.</p>';
      return;
    }

    searchResults.innerHTML = patients.map((p) => `
      <div class="queue-card" style="margin-top:10px;">
        <div class="qc-info">
          <div class="qc-name">${escapeHtml(p.first_name)} ${escapeHtml(p.last_name || '')}</div>
          <div class="qc-meta">${escapeHtml(p.phone)} · ${escapeHtml(p.gender || '-')} · Age ${escapeHtml(p.age || '-')}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="btn-sm btn-outline view-history-btn" data-id="${p.id}" data-name="${escapeHtml(p.first_name)} ${escapeHtml(p.last_name || '')}">History</button>
          <button class="btn-sm btn-outline use-patient-btn" data-id="${p.id}"
            data-fname="${escapeHtml(p.first_name)}" data-lname="${escapeHtml(p.last_name || '')}"
            data-phone="${escapeHtml(p.phone)}" data-gender="${escapeHtml(p.gender || '')}"
            data-age="${escapeHtml(p.age || '')}" data-address="${escapeHtml(p.address || '')}">
            Use This Patient
          </button>
        </div>
      </div>
    `).join('');

    document.querySelectorAll('.view-history-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          const res = await staffFetch(`/api/reception/patients/${btn.dataset.id}/history`);
          const { history } = await res.json();
          showPatientHistoryModal(btn.dataset.name, history);
        } catch (err) {}
      });
    });

    document.querySelectorAll('.use-patient-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        patientIdField.value = btn.dataset.id;
        intakeForm.first_name.value = btn.dataset.fname;
        intakeForm.last_name.value = btn.dataset.lname;
        intakeForm.phone.value = btn.dataset.phone;
        intakeForm.gender.value = btn.dataset.gender;
        intakeForm.age.value = btn.dataset.age;
        intakeForm.address.value = btn.dataset.address;
        intakeFormTitle.textContent = 'Returning Patient — New Visit';
        window.scrollTo({ top: intakeForm.offsetTop - 20, behavior: 'smooth' });
      });
    });
  } catch (err) {
    searchResults.innerHTML = '';
  }
});

intakeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  intakeMsg.textContent = '';
  intakeSubmitBtn.disabled = true;
  intakeSubmitBtn.textContent = 'Saving…';

  const payload = Object.fromEntries(new FormData(intakeForm).entries());
  if (!payload.patient_id) delete payload.patient_id;

  try {
    const res = await staffFetch('/api/reception/intake', { method: 'POST', body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not register patient.');

    showToast('Patient added to doctor\'s queue!');
    intakeForm.reset();
    patientIdField.value = '';
    intakeFormTitle.textContent = 'New Patient Registration';
    searchResults.innerHTML = '';
    searchPhone.value = '';
  } catch (err) {
    intakeMsg.textContent = err.message;
    intakeMsg.style.color = 'var(--danger)';
  } finally {
    intakeSubmitBtn.disabled = false;
    intakeSubmitBtn.textContent = 'Add to Doctor\'s Queue';
  }
});
