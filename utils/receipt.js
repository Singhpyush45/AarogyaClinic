// utils/receipt.js
// Generates a PDF appointment receipt using PDFKit (pure JS, no native deps)
const PDFDocument = require('pdfkit');

function generateReceiptPDF(appointment, res) {
  const {
    CLINIC_NAME = 'Aarogya Homeopathic Clinic',
    CLINIC_DOCTOR = 'Dr. Alok Kushwaha',
    CLINIC_PHONE = '',
    CLINIC_EMAIL = '',
    CLINIC_ADDRESS = '',
  } = process.env;

  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="Receipt-${appointment.appointment_code}.pdf"`
  );

  doc.pipe(res);

  // ---- Header ----
  doc
    .fillColor('#3f5b45')
    .fontSize(22)
    .font('Helvetica-Bold')
    .text(CLINIC_NAME, { align: 'center' });

  doc
    .fillColor('#5a6355')
    .fontSize(11)
    .font('Helvetica')
    .text(CLINIC_DOCTOR, { align: 'center' });

  doc.moveDown(0.3);
  doc
    .fontSize(9)
    .fillColor('#7a8574')
    .text(
      [CLINIC_ADDRESS, CLINIC_PHONE, CLINIC_EMAIL].filter(Boolean).join('  |  '),
      { align: 'center' }
    );

  doc.moveDown(1);
  doc
    .strokeColor('#c78a3f')
    .lineWidth(2)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(1.2);

  // ---- Title ----
  doc
    .fillColor('#26301f')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('Appointment Receipt', { align: 'center' });
  doc.moveDown(1);

  // ---- Status banner (big and unmissable) ----
  const statusConfig = {
    pending: { bg: '#fbe9d3', border: '#c78a3f', text: '#8a5a1f', label: '⏳ AWAITING CLINIC CONFIRMATION' },
    confirmed: { bg: '#e0ede1', border: '#3f5b45', text: '#2c4030', label: '✓ CONFIRMED BY CLINIC' },
    cancelled: { bg: '#fbe2dc', border: '#b3432c', text: '#7a2e1c', label: '✗ CANCELLED' },
    completed: { bg: '#dfe8ee', border: '#4a6b8a', text: '#2e4c63', label: '✓ VISIT COMPLETED' },
  };
  const sc = statusConfig[appointment.status] || statusConfig.pending;

  const bannerY = doc.y;
  doc.roundedRect(50, bannerY, 495, 46, 6).fillAndStroke(sc.bg, sc.border);
  doc
    .fillColor(sc.text)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text(sc.label, 50, bannerY + 15, { width: 495, align: 'center' });
  doc.y = bannerY + 46;

  if (appointment.status === 'pending') {
    doc.moveDown(0.4);
    doc
      .fontSize(9)
      .fillColor('#8a5a1f')
      .font('Helvetica-Oblique')
      .text(
        'This is a booking REQUEST, not a confirmed appointment yet. Please check your status before visiting — use your Appointment ID and phone number on the website\'s "Check Appointment Status" section.',
        { align: 'center' }
      );
  }
  doc.moveDown(1);

  // ---- Appointment code box ----
  const boxY = doc.y;
  doc
    .roundedRect(50, boxY, 495, 40, 6)
    .fillAndStroke('#e7efe4', '#d9dfd2');
  doc
    .fillColor('#3f5b45')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text(`Appointment ID:  ${appointment.appointment_code}`, 62, boxY + 11, { characterSpacing: 1 });
  doc.moveDown(3.2);

  // ---- Details table ----
  const rows = [
    ['Patient Name', appointment.patient_name],
    ['Phone', appointment.phone],
    ['Email', appointment.email || '-'],
    ['Age', appointment.age ? String(appointment.age) : '-'],
    ['Gender', appointment.gender || '-'],
    ['Reason for Visit', appointment.concern || '-'],
    ['Preferred Date', appointment.preferred_date],
    ['Preferred Time', appointment.preferred_time],
    ['Status', appointment.status.toUpperCase()],
    ['Booked On', appointment.created_at],
  ];

  doc.font('Helvetica').fontSize(11);
  let y = doc.y;
  rows.forEach(([label, value], i) => {
    if (i % 2 === 0) {
      doc.rect(50, y - 4, 495, 24).fill('#faf7f0');
    }
    doc
      .fillColor('#5a6355')
      .font('Helvetica-Bold')
      .text(label, 60, y, { width: 160 });
    doc
      .fillColor('#26301f')
      .font('Helvetica')
      .text(String(value), 230, y, { width: 300 });
    y += 24;
  });

  doc.y = y + 20;

  doc
    .strokeColor('#d9dfd2')
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(545, doc.y)
    .stroke();
  doc.moveDown(1);

  doc
    .fontSize(9)
    .fillColor('#7a8574')
    .font('Helvetica-Oblique')
    .text(
      'This receipt confirms your appointment request. Our team will confirm the final time by phone/email. Please carry this receipt (printed or digital) on your visit.',
      { align: 'center' }
    );

  doc.end();
}

module.exports = { generateReceiptPDF };
