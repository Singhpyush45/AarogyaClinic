// public/js/script.js
document.addEventListener('DOMContentLoaded', () => {
  // ---- Mobile menu ----
  const menuToggle = document.getElementById('menuToggle');
  const navUl = document.querySelector('nav ul');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      navUl.style.display = navUl.style.display === 'flex' ? 'none' : 'flex';
      navUl.style.flexDirection = 'column';
      navUl.style.position = 'absolute';
      navUl.style.top = '68px';
      navUl.style.right = '24px';
      navUl.style.background = '#fff';
      navUl.style.padding = '18px 24px';
      navUl.style.borderRadius = '12px';
      navUl.style.boxShadow = '0 12px 24px rgba(0,0,0,.12)';
      navUl.style.gap = '16px';
    });
  }

  // ---- Load live clinic info from backend (.env driven) ----
  fetch('/api/clinic-info')
    .then((r) => r.json())
    .then((info) => {
      setText('infoPhone', info.phone);
      setText('infoEmail', info.email);
      setText('infoAddress', info.address);
      setText('footPhone', info.phone);
      setText('footEmail', info.email);
      setText('footAddress', info.address);
    })
    .catch(() => {
      // fails silently — the page still works without this
    });

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  // ---- Doctor photo: cache-bust so a freshly uploaded photo shows immediately ----
  fetch('/api/doctor-photo-meta')
    .then((r) => r.json())
    .then(({ updatedAt }) => {
      const img = document.getElementById('doctorPhoto');
      if (img && updatedAt) img.src = `/api/doctor-photo?v=${updatedAt}`;
    })
    .catch(() => {});

  // ---- Reviews: load + render ----
  const reviewsGrid = document.getElementById('reviewsGrid');

  function starString(n) {
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  function renderReviews(reviews) {
    if (!reviews.length) {
      reviewsGrid.innerHTML = `<p class="reviews-empty">No reviews yet — be the first to share your experience below!</p>`;
      return;
    }
    reviewsGrid.innerHTML = reviews
      .map(
        (r) => `
      <div class="test-card">
        <div class="stars">${starString(r.rating)}</div>
        <p class="quote">"${escapeHtml(r.review_text)}"</p>
        <div class="test-person">
          <div class="test-avatar">${escapeHtml(r.patient_name[0].toUpperCase())}</div>
          <div><div class="name">${escapeHtml(r.patient_name)}</div><div class="place">${escapeHtml(r.city || '')}</div></div>
        </div>
      </div>`
      )
      .join('');
  }

  function loadReviews() {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then(({ reviews }) => renderReviews(reviews))
      .catch(() => {
        reviewsGrid.innerHTML = `<p class="reviews-empty">Could not load reviews right now.</p>`;
      });
  }
  loadReviews();

  // ---- Write a review: toggle form ----
  const writeReviewBtn = document.getElementById('writeReviewBtn');
  const reviewForm = document.getElementById('reviewForm');
  const cancelReviewBtn = document.getElementById('cancelReviewBtn');

  writeReviewBtn.addEventListener('click', () => {
    reviewForm.classList.toggle('hidden');
    writeReviewBtn.style.display = reviewForm.classList.contains('hidden') ? 'inline-block' : 'none';
  });
  cancelReviewBtn.addEventListener('click', () => {
    reviewForm.classList.add('hidden');
    writeReviewBtn.style.display = 'inline-block';
    reviewForm.reset();
  });

  // ---- Star picker ----
  const starPicker = document.getElementById('starPicker');
  const ratingInput = document.getElementById('ratingInput');
  const stars = Array.from(starPicker.children);

  function paintStars(val) {
    stars.forEach((s) => s.classList.toggle('active', Number(s.dataset.val) <= val));
  }
  paintStars(5);

  stars.forEach((s) => {
    s.addEventListener('click', () => {
      ratingInput.value = s.dataset.val;
      paintStars(Number(s.dataset.val));
    });
  });

  // ---- Submit review ----
  const reviewSubmitBtn = document.getElementById('reviewSubmitBtn');
  const reviewMsg = document.getElementById('reviewMsg');

  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    reviewMsg.textContent = '';
    reviewMsg.className = 'form-msg';

    const payload = Object.fromEntries(new FormData(reviewForm).entries());
    reviewSubmitBtn.disabled = true;
    reviewSubmitBtn.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');

      reviewForm.reset();
      ratingInput.value = 5;
      paintStars(5);
      reviewForm.classList.add('hidden');
      writeReviewBtn.style.display = 'inline-block';
      loadReviews();
    } catch (err) {
      reviewMsg.textContent = err.message;
      reviewMsg.className = 'form-msg error';
    } finally {
      reviewSubmitBtn.disabled = false;
      reviewSubmitBtn.textContent = 'Submit Review';
    }
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- Prevent past dates in the date picker ----
  const dateInput = document.querySelector('input[name="preferred_date"]');
  if (dateInput) {
    dateInput.min = new Date().toISOString().slice(0, 10);
  }

  // ---- Booking form submission ----
  const form = document.getElementById('bookingForm');
  const submitBtn = document.getElementById('submitBtn');
  const formMsg = document.getElementById('formMsg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formMsg.textContent = '';
    formMsg.className = 'form-msg';

    const payload = Object.fromEntries(new FormData(form).entries());

    submitBtn.disabled = true;
    submitBtn.textContent = 'Booking…';

    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      showReceipt(data.appointment);
      form.reset();
      formMsg.textContent = '';
    } catch (err) {
      formMsg.textContent = err.message;
      formMsg.className = 'form-msg error';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Request Appointment';
    }
  });

  // ---- Receipt modal ----
  const modal = document.getElementById('receiptModal');
  const receiptBox = document.getElementById('receiptBox');
  const modalClose = document.getElementById('modalClose');
  const modalDoneBtn = document.getElementById('modalDoneBtn');
  const downloadBtn = document.getElementById('downloadReceiptBtn');
  let currentCode = null;
  let currentPhone = null;

  function showReceipt(appt) {
    currentCode = appt.appointment_code;
    currentPhone = appt.phone;
    const statusLabel = { pending: 'Pending Confirmation', confirmed: 'Confirmed', cancelled: 'Cancelled', completed: 'Completed' }[appt.status] || appt.status;
    receiptBox.innerHTML = `
      <div class="code">${appt.appointment_code}</div>
      <div class="receipt-row"><span class="k">Name</span><span class="v">${escapeHtml(appt.patient_name)}</span></div>
      <div class="receipt-row"><span class="k">Phone</span><span class="v">${escapeHtml(appt.phone)}</span></div>
      <div class="receipt-row"><span class="k">Date</span><span class="v">${escapeHtml(appt.preferred_date)}</span></div>
      <div class="receipt-row"><span class="k">Time</span><span class="v">${escapeHtml(appt.preferred_time)}</span></div>
      <div class="receipt-row"><span class="k">Status</span><span class="v">${escapeHtml(statusLabel)}</span></div>
    `;
    modal.classList.add('open');
  }

  function closeModal() {
    modal.classList.remove('open');
  }

  modalClose.addEventListener('click', closeModal);
  modalDoneBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  downloadBtn.addEventListener('click', () => {
    if (currentCode && currentPhone) {
      window.open(`/api/appointments/${currentCode}/receipt?phone=${encodeURIComponent(currentPhone)}`, '_blank');
    }
  });

  // ---- Check Appointment Status ----
  const statusForm = document.getElementById('statusForm');
  const statusMsg = document.getElementById('statusMsg');
  const statusResult = document.getElementById('statusResult');
  const statusSubmitBtn = document.getElementById('statusSubmitBtn');

  const statusLabels = {
    pending: 'Pending Confirmation',
    confirmed: 'Confirmed',
    cancelled: 'Cancelled',
    completed: 'Completed',
  };
  const statusNotes = {
    pending: "Your appointment hasn't been confirmed by the clinic yet. Please check back soon, or call us if your visit date is close.",
    confirmed: 'Your appointment is confirmed! Please arrive a few minutes early on the scheduled date and time.',
    cancelled: 'This appointment was cancelled. Please book a new appointment or contact the clinic.',
    completed: 'This appointment has already been completed. Thank you for visiting!',
  };

  statusForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMsg.textContent = '';
    statusMsg.className = 'form-msg';
    statusResult.classList.add('hidden');

    const payload = Object.fromEntries(new FormData(statusForm).entries());
    statusSubmitBtn.disabled = true;
    statusSubmitBtn.textContent = 'Checking…';

    try {
      const res = await fetch('/api/appointments/lookup-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not find any appointments.');

      statusResult.innerHTML = data.appointments.map((appt) => {
        const label = statusLabels[appt.status] || appt.status;
        return `
          <div style="border-bottom:1px solid var(--line);padding:14px 0;">
            <span class="status-badge-lg ${appt.status}">${label}</span>
            <div class="sr-row"><span class="k">Appointment ID</span><span class="v">${escapeHtml(appt.appointment_code)}</span></div>
            <div class="sr-row"><span class="k">Name</span><span class="v">${escapeHtml(appt.patient_name)}</span></div>
            <div class="sr-row"><span class="k">Date</span><span class="v">${escapeHtml(appt.preferred_date)}</span></div>
            <div class="sr-row"><span class="k">Time</span><span class="v">${escapeHtml(appt.preferred_time)}</span></div>
            <p class="sr-note">${statusNotes[appt.status] || ''}</p>
            <button class="btn status-download-btn" data-code="${escapeHtml(appt.appointment_code)}" data-phone="${escapeHtml(appt.phone)}">Download Receipt PDF</button>
          </div>
        `;
      }).join('');
      statusResult.querySelector('div:last-child').style.borderBottom = 'none';
      statusResult.classList.remove('hidden');

      statusResult.querySelectorAll('.status-download-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          window.open(`/api/appointments/${btn.dataset.code}/receipt?phone=${encodeURIComponent(btn.dataset.phone)}`, '_blank');
        });
      });
    } catch (err) {
      statusMsg.textContent = err.message;
      statusMsg.className = 'form-msg error';
    } finally {
      statusSubmitBtn.disabled = false;
      statusSubmitBtn.textContent = 'Check Status';
    }
  });

  // ---- Download Your Bill ----
  const billForm = document.getElementById('billForm');
  const billLookupMsg = document.getElementById('billLookupMsg');
  const billResult = document.getElementById('billResult');
  const billSubmitBtn = document.getElementById('billSubmitBtn');

  billForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    billLookupMsg.textContent = '';
    billLookupMsg.className = 'form-msg';
    billResult.classList.add('hidden');

    const payload = Object.fromEntries(new FormData(billForm).entries());
    billSubmitBtn.disabled = true;
    billSubmitBtn.textContent = 'Searching…';

    try {
      const res = await fetch('/api/bills/lookup-by-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not find any bills.');

      billResult.innerHTML = data.bills.map((bill) => `
        <div style="border-bottom:1px solid var(--line);padding:14px 0;">
          <span class="status-badge-lg confirmed">Bill Found</span>
          <div class="sr-row"><span class="k">Bill Number</span><span class="v">${escapeHtml(bill.bill_number)}</span></div>
          <div class="sr-row"><span class="k">Patient</span><span class="v">${escapeHtml(bill.patient_name)}</span></div>
          <div class="sr-row"><span class="k">Date</span><span class="v">${new Date(bill.created_at).toLocaleDateString('en-GB')}</span></div>
          <div class="sr-row"><span class="k">Grand Total</span><span class="v">₹${Number(bill.grand_total).toFixed(2)}</span></div>
          <button class="btn bill-download-btn" data-id="${bill.id}">Download Bill PDF</button>
        </div>
      `).join('');
      billResult.querySelector('div:last-child').style.borderBottom = 'none';
      billResult.classList.remove('hidden');

      billResult.querySelectorAll('.bill-download-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          window.open(`/api/bills/by-id/${btn.dataset.id}/pdf?phone=${encodeURIComponent(payload.phone)}`, '_blank');
        });
      });
    } catch (err) {
      billLookupMsg.textContent = err.message;
      billLookupMsg.className = 'form-msg error';
    } finally {
      billSubmitBtn.disabled = false;
      billSubmitBtn.textContent = 'Find Bill';
    }
  });
});
