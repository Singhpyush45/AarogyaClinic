// public/js/staff-login.js — role picker + login for the clinic workflow system
const rolePicker = document.getElementById('rolePicker');
const loginForm = document.getElementById('staffLoginForm');
const screenTitle = document.getElementById('screenTitle');
const loginMsg = document.getElementById('staffLoginMsg');
const loginBtn = document.getElementById('staffLoginBtn');
const backToRoles = document.getElementById('backToRoles');

const ROLE_LABELS = { doctor: 'Doctor Login', reception: 'Reception Staff Login', billing: 'Medical / Billing Staff Login' };
const ROLE_REDIRECT = { doctor: '/doctor.html', reception: '/reception.html', billing: '/billing.html' };

let selectedRole = null;

document.querySelectorAll('.role-choice').forEach((card) => {
  card.addEventListener('click', () => {
    if (card.dataset.target) {
      window.location.href = card.dataset.target;
      return;
    }
    selectedRole = card.dataset.role;
    screenTitle.textContent = ROLE_LABELS[selectedRole];
    rolePicker.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });
});

backToRoles.addEventListener('click', () => {
  selectedRole = null;
  screenTitle.textContent = 'Staff & Admin Login';
  loginForm.classList.add('hidden');
  rolePicker.classList.remove('hidden');
  loginMsg.textContent = '';
  loginForm.reset();
});

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginMsg.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Logging in…';

  const payload = { role: selectedRole, ...Object.fromEntries(new FormData(loginForm).entries()) };

  try {
    const res = await fetch('/api/staff/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed.');

    localStorage.setItem('aarogya_staff_token', data.token);
    localStorage.setItem('aarogya_staff_role', data.staff.role);
    localStorage.setItem('aarogya_staff_name', data.staff.full_name || data.staff.username);
    window.location.href = ROLE_REDIRECT[selectedRole];
  } catch (err) {
    loginMsg.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Log In';
  }
});
