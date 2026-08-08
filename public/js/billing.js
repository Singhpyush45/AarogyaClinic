// public/js/billing.js
requireRole('billing');
updateHeaderName();
initProfileModal('billing');

document.getElementById('profileBtn').addEventListener('click', () => window.openProfileModal());
document.getElementById('logoutBtn').addEventListener('click', staffLogout);

// ---- Live notification: doctor sent a new prescription to billing ----
connectClinicSocket({
  visit_ready_for_billing: (visit) => {
    playBeep();
    showToast(`Ready for billing: ${visit.first_name || 'A patient'} ${visit.last_name || ''}`.trim());
    if (!queueView.classList.contains('hidden')) loadBillingQueue();
  },
});

const queueView = document.getElementById('queueView');
const billView = document.getElementById('billView');
let currentVisitId = null;
let billItems = [];

async function loadBillingStats() {
  try {
    const res = await staffFetch('/api/billing/stats');
    const { stats } = await res.json();
    document.getElementById('statPending').textContent = stats.pendingCount;
    document.getElementById('statBillsToday').textContent = stats.billsToday;
    document.getElementById('statRevenueToday').textContent = `₹${Number(stats.revenueToday).toFixed(0)}`;
    document.getElementById('statMedicineRevenueToday').textContent = `₹${Number(stats.medicineRevenueToday || 0).toFixed(0)}`;
  } catch (err) {}
}

// ---------------- Tabs: Queue / History ----------------
const tabQueueBtn = document.getElementById('tabQueueBtn');
const tabHistoryBtn = document.getElementById('tabHistoryBtn');
const queueTabContent = document.getElementById('queueTabContent');
const historyTabContent = document.getElementById('historyTabContent');

tabQueueBtn.addEventListener('click', () => {
  tabQueueBtn.classList.add('active');
  tabHistoryBtn.classList.remove('active');
  queueTabContent.classList.remove('hidden');
  historyTabContent.classList.add('hidden');
});
tabHistoryBtn.addEventListener('click', () => {
  tabHistoryBtn.classList.add('active');
  tabQueueBtn.classList.remove('active');
  historyTabContent.classList.remove('hidden');
  queueTabContent.classList.add('hidden');
  loadBillingHistory();
});

const billingRangeSelect = document.getElementById('billingRangeSelect');
const billingFromDate = document.getElementById('billingFromDate');
const billingToDate = document.getElementById('billingToDate');

billingRangeSelect.addEventListener('change', () => {
  const isCustom = billingRangeSelect.value === 'custom';
  billingFromDate.classList.toggle('hidden', !isCustom);
  billingToDate.classList.toggle('hidden', !isCustom);
});
document.getElementById('billingHistoryGoBtn').addEventListener('click', loadBillingHistory);

async function loadBillingHistory() {
  const list = document.getElementById('billingHistoryList');
  list.innerHTML = '<p class="empty-state">Loading…</p>';
  const range = billingRangeSelect.value;
  const params = new URLSearchParams({ range });
  if (range === 'custom') {
    if (billingFromDate.value) params.set('from', billingFromDate.value);
    if (billingToDate.value) params.set('to', billingToDate.value);
  }
  try {
    const res = await staffFetch(`/api/billing/history?${params.toString()}`);
    const { history } = await res.json();
    if (!history.length) {
      list.innerHTML = '<p class="empty-state">No bills in this period.</p>';
      return;
    }
    list.innerHTML = history.map((b) => `
      <div class="history-row">
        <div>
          <b>${escapeHtml(b.patient_name)}</b> · ${escapeHtml(b.bill_number)}
          <span class="completed-tag">Completed</span>
          <div style="font-size:12px;color:var(--ink-soft);margin-top:2px;">${b.item_count} item(s) · ${new Date(b.created_at).toLocaleString()}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <b style="color:var(--sage-deep);">₹${Number(b.grand_total).toFixed(2)}</b>
          <a class="btn-outline btn-sm" href="/api/billing/bills/${b.id}/pdf?token=${getStaffToken()}" target="_blank">PDF</a>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p class="empty-state">Could not load history.</p>';
  }
}

async function loadBillingQueue() {
  const list = document.getElementById('billingQueueList');
  list.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    const res = await staffFetch('/api/billing/queue');
    const { queue } = await res.json();
    if (!queue.length) {
      list.innerHTML = `
        <div class="empty-card">
          <div class="empty-icon-circle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8M1 3h22v5H1z"/><path d="M10 12h4"/></svg></div>
          <div>
            <h3>Nothing waiting for billing right now.</h3>
            <p>You're all caught up! New bills will appear here.</p>
          </div>
          <div class="empty-illustration"><svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></div>
        </div>`;
      return;
    }
    list.innerHTML = queue.map((v) => `
      <div class="queue-card">
        <div class="qc-info">
          <div class="qc-name">${escapeHtml(v.first_name)} ${escapeHtml(v.last_name || '')}</div>
          <div class="qc-meta">${escapeHtml(v.phone)} · Dr. ${escapeHtml(v.doctor_name || v.doctor_username || '-')}</div>
          <div class="qc-time">${new Date(v.created_at).toLocaleString()}</div>
        </div>
        <button class="btn btn-sm open-bill-btn" data-id="${v.id}">Open</button>
      </div>
    `).join('');
    document.querySelectorAll('.open-bill-btn').forEach((btn) => btn.addEventListener('click', () => openVisit(btn.dataset.id)));
  } catch (err) {
    list.innerHTML = '<p class="empty-state">Could not load queue.</p>';
  }
}
document.getElementById('refreshBtn').addEventListener('click', loadBillingQueue);
document.getElementById('refreshBtn').addEventListener('click', loadBillingStats);
document.getElementById('backBtn').addEventListener('click', () => {
  billView.classList.add('hidden');
  queueView.classList.remove('hidden');
  loadBillingQueue();
  loadBillingStats();
});
loadBillingQueue();
loadBillingStats();

async function openVisit(visitId) {
  try {
    const res = await staffFetch(`/api/billing/visits/${visitId}`);
    const { visit, prescription, hasPhotoRx } = await res.json();
    currentVisitId = visitId;

    document.getElementById('billPatientName').textContent = `${visit.first_name} ${visit.last_name || ''}`;
    document.getElementById('billPatientCard').innerHTML = `
      <div style="font-size:13px;"><b>Phone:</b> ${escapeHtml(visit.phone)} &nbsp; <b>Gender/Age:</b> ${escapeHtml(visit.gender || '-')}, ${escapeHtml(visit.age || '-')}</div>
      ${prescription && prescription.mode === 'digital' ? `<div style="margin-top:6px;font-size:13px;"><b>Diagnosis:</b> ${escapeHtml(prescription.diagnosis || '-')}</div>` : ''}
      ${hasPhotoRx ? `<div style="margin-top:8px;"><a href="/api/billing/visits/${visitId}/photo-rx?token=${getStaffToken()}" target="_blank" class="btn-outline btn-sm">View Photo Rx</a></div>` : ''}
    `;

    billItems = (prescription && prescription.medicines ? prescription.medicines : []).map((m) => ({
      medicine_id: m.medicine_id || null,
      medicine_name: m.medicine_name,
      unit_price: m.price || 0,
      save_to_master: false,
      had_price: !!m.price,
    }));

    renderBillItems();
    document.getElementById('discountInput').value = 0;
    document.getElementById('discountInput').oninput = renderBillItems;
    loadConsultingFeeDisplay();

    queueView.classList.add('hidden');
    billView.classList.remove('hidden');
    window.scrollTo(0, 0);
  } catch (err) {
    alert('Could not open visit.');
  }
}

let currentConsultingFee = 0;
let includeConsultingFee = true;

async function loadConsultingFeeDisplay() {
  try {
    const res = await staffFetch('/api/billing/consulting-fee');
    const { fee } = await res.json();
    currentConsultingFee = Number(fee) || 0;
    includeConsultingFee = true;
    updateGrandTotal();
  } catch (err) {}
}

// homeopathic medicines: one unit (tube/bottle) per line item — no quantity field
function renderBillItems() {
  const container = document.getElementById('billItemsList');
  if (!billItems.length) {
    container.innerHTML = '<p class="empty-state">No medicines were prescribed for this visit.</p>';
  } else {
    container.innerHTML = billItems.map((it, i) => `
      <div class="med-row" style="grid-template-columns:2.5fr 1.2fr 1fr;">
        <div style="font-size:13px;font-weight:600;align-self:center;">${escapeHtml(it.medicine_name)}${!it.had_price ? ' <span style="color:var(--turmeric);font-size:11px;">(no saved price)</span>' : ''}</div>
        <input type="number" min="0" step="0.01" value="${it.unit_price}" data-i="${i}" data-field="unit_price">
        <div style="font-size:13px;align-self:center;">₹<span id="lineTotal-${i}">${Number(it.unit_price).toFixed(2)}</span></div>
      </div>
    `).join('');

    container.querySelectorAll('input[data-field]').forEach((inp) => {
      inp.addEventListener('input', () => {
        billItems[inp.dataset.i][inp.dataset.field] = Number(inp.value) || 0;
        document.getElementById(`lineTotal-${inp.dataset.i}`).textContent = Number(billItems[inp.dataset.i].unit_price).toFixed(2);
        updateGrandTotal();
      });
    });
  }
  updateGrandTotal();
}

function updateGrandTotal() {
  const medicineSubtotal = billItems.reduce((sum, it) => sum + Number(it.unit_price), 0);
  const feeAmount = includeConsultingFee ? currentConsultingFee : 0;
  const subtotal = medicineSubtotal + feeAmount;
  const discount = Number(document.getElementById('discountInput').value) || 0;
  const grandTotal = Math.max(0, subtotal - discount);
  document.getElementById('grandTotalDisplay').innerHTML = `
    ${currentConsultingFee > 0 ? `<div style="font-size:12px;font-weight:400;color:var(--ink-soft);">
      <label style="cursor:pointer;"><input type="checkbox" id="includeFeeCheck" ${includeConsultingFee ? 'checked' : ''}> Include consulting fee (₹${currentConsultingFee.toFixed(2)})</label>
    </div>` : ''}
    Total: ₹${grandTotal.toFixed(2)}
  `;
  const feeCheck = document.getElementById('includeFeeCheck');
  if (feeCheck) {
    feeCheck.addEventListener('change', () => {
      includeConsultingFee = feeCheck.checked;
      updateGrandTotal();
    });
  }
}

document.getElementById('generateBillBtn').addEventListener('click', async () => {
  const billMsg = document.getElementById('billMsg');
  billMsg.textContent = '';
  const btn = document.getElementById('generateBillBtn');
  btn.disabled = true;
  btn.textContent = 'Generating…';

  try {
    const res = await staffFetch(`/api/billing/visits/${currentVisitId}/bill`, {
      method: 'POST',
      body: JSON.stringify({
        items: billItems.map((it) => ({ medicine_id: it.medicine_id, medicine_name: it.medicine_name, unit_price: it.unit_price, save_to_master: !it.had_price })),
        discount: Number(document.getElementById('discountInput').value) || 0,
        save_unsaved_medicines: true,
        include_consulting_fee: includeConsultingFee,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not generate bill.');

    showToast(`Bill ${data.bill.bill_number} generated!`);
    window.open(`/api/billing/bills/${data.bill.id}/pdf?token=${getStaffToken()}`, '_blank');

    billView.classList.add('hidden');
    queueView.classList.remove('hidden');
    loadBillingQueue();
    loadBillingStats();
  } catch (err) {
    billMsg.textContent = err.message;
    billMsg.style.color = 'var(--danger)';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Bill';
  }
});

// ---------------- Medicine Inventory Management ----------------
const toggleInventoryBtn = document.getElementById('toggleInventoryBtn');
const inventoryPanel = document.getElementById('inventoryPanel');
const medicineForm = document.getElementById('medicineForm');
const inventoryList = document.getElementById('inventoryList');

toggleInventoryBtn.addEventListener('click', () => {
  inventoryPanel.classList.toggle('hidden');
  if (!inventoryPanel.classList.contains('hidden')) loadInventory();
});

document.getElementById('medFormCancelBtn').addEventListener('click', () => resetMedicineForm());

function resetMedicineForm() {
  medicineForm.reset();
  document.getElementById('medFormId').value = '';
  document.getElementById('medFormThreshold').value = 10;
  document.getElementById('medFormSubmitBtn').textContent = 'Save Medicine';
  document.getElementById('medFormMsg').textContent = '';
}

medicineForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const medFormMsg = document.getElementById('medFormMsg');
  medFormMsg.textContent = '';
  medFormMsg.className = 'login-msg';

  const payload = Object.fromEntries(new FormData(medicineForm).entries());
  const id = payload.id;
  delete payload.id;

  if (payload.price && Number(payload.price) < 0) {
    medFormMsg.textContent = 'Price cannot be negative.';
    medFormMsg.style.color = 'var(--danger)';
    return;
  }
  if (payload.stock_quantity && !/^\d+$/.test(payload.stock_quantity)) {
    medFormMsg.textContent = 'Stock quantity must be a whole number.';
    medFormMsg.style.color = 'var(--danger)';
    return;
  }

  try {
    const res = await staffFetch(id ? `/api/medicines/${id}` : '/api/medicines', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Could not save medicine.');
    showToast('Medicine saved.');
    resetMedicineForm();
    loadInventory();
  } catch (err) {
    medFormMsg.textContent = err.message;
    medFormMsg.style.color = 'var(--danger)';
  }
});

async function loadInventory() {
  inventoryList.innerHTML = '<p class="empty-state">Loading…</p>';
  try {
    const res = await staffFetch('/api/medicines');
    const { medicines } = await res.json();
    if (!medicines.length) {
      inventoryList.innerHTML = '<p class="empty-state">No medicines in the master list yet.</p>';
      return;
    }
    const soon = new Date(); soon.setDate(soon.getDate() + 30);

    inventoryList.innerHTML = medicines.map((m) => {
      const isLow = m.stock_quantity != null && m.stock_quantity <= (m.low_stock_threshold || 10);
      const isExpiring = m.expiry_date && new Date(m.expiry_date) <= soon;
      return `
        <div class="inv-item">
          <div>
            <span class="inv-name">${escapeHtml(m.name)}</span>
            ${m.strength ? `<span class="inv-meta">(${escapeHtml(m.strength)})</span>` : ''}
            ${isLow ? '<span class="inv-badge low">Low Stock</span>' : ''}
            ${isExpiring ? '<span class="inv-badge expiring">Expiring Soon</span>' : ''}
            <div class="inv-meta">₹${m.price || '-'} · Stock: ${m.stock_quantity != null ? m.stock_quantity : '-'} · ${m.category || 'Uncategorized'}</div>
          </div>
          <button class="btn-outline btn-sm edit-med-btn" data-id="${m.id}">Edit</button>
        </div>
      `;
    }).join('');

    inventoryList.querySelectorAll('.edit-med-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = medicines.find((x) => String(x.id) === btn.dataset.id);
        document.getElementById('medFormId').value = m.id;
        document.getElementById('medFormName').value = m.name;
        document.getElementById('medFormStrength').value = m.strength || '';
        document.getElementById('medFormCategory').value = m.category || '';
        document.getElementById('medFormPrice').value = m.price || '';
        document.getElementById('medFormStock').value = m.stock_quantity != null ? m.stock_quantity : '';
        document.getElementById('medFormExpiry').value = m.expiry_date ? m.expiry_date.slice(0, 10) : '';
        document.getElementById('medFormThreshold').value = m.low_stock_threshold || 10;
        document.getElementById('medFormSubmitBtn').textContent = 'Update Medicine';
        window.scrollTo({ top: medicineForm.offsetTop - 20, behavior: 'smooth' });
      });
    });
  } catch (err) {
    inventoryList.innerHTML = '<p class="empty-state">Could not load medicines.</p>';
  }
}
