// utils/mailer.js
// OPTIONAL email notifications. If SMTP_* env vars are not set, this
// silently does nothing — booking flow never breaks because of email.
const nodemailer = require('nodemailer');

function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function notifyClinicOfNewAppointment(appointment) {
  if (!isEmailConfigured()) return { skipped: true };

  const to = process.env.NOTIFY_EMAIL_TO || process.env.CLINIC_EMAIL;
  if (!to) return { skipped: true };

  try {
    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"${process.env.CLINIC_NAME || 'Clinic Website'}" <${process.env.SMTP_USER}>`,
      to,
      subject: `New Appointment: ${appointment.appointment_code} — ${appointment.patient_name}`,
      html: `
        <h2>New Appointment Booked</h2>
        <p><b>ID:</b> ${appointment.appointment_code}</p>
        <p><b>Name:</b> ${appointment.patient_name}</p>
        <p><b>Phone:</b> ${appointment.phone}</p>
        <p><b>Email:</b> ${appointment.email || '-'}</p>
        <p><b>Preferred Date/Time:</b> ${appointment.preferred_date} at ${appointment.preferred_time}</p>
        <p><b>Concern:</b> ${appointment.concern || '-'}</p>
        <p>Login to the admin dashboard to confirm or manage this appointment.</p>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error('Email notification failed (booking still succeeded):', err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = { notifyClinicOfNewAppointment, isEmailConfigured };
