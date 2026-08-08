// utils/billPdf.js — shared bill PDF generator (used by staff download AND public lookup)
const PDFDocument = require('pdfkit');

function formatDateTime(dateInput) {
  const d = new Date(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
}

function generateBillPDF(bill, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${bill.bill_number}.pdf"`);
  doc.pipe(res);

  const CLINIC_NAME = process.env.CLINIC_NAME || 'Aarogya Homeopathic Clinic';
  const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS || '';
  const CLINIC_PHONE = process.env.CLINIC_PHONE || '';

  // ---- Header ----
  doc.fillColor('#3f5b45').fontSize(21).font('Helvetica-Bold').text(CLINIC_NAME, { align: 'center' });
  if (bill.doctor_name) {
    doc.fillColor('#5a6355').fontSize(10).font('Helvetica').text(bill.doctor_name, { align: 'center' });
  }
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor('#7a8574')
    .text([CLINIC_ADDRESS, CLINIC_PHONE].filter(Boolean).join('  |  '), { align: 'center' });

  doc.moveDown(0.8);
  doc.strokeColor('#c78a3f').lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(1);

  doc.fillColor('#26301f').fontSize(15).font('Helvetica-Bold').text('Bill / Receipt', { align: 'center' });
  doc.moveDown(1);

  // ---- Bill number box ----
  const boxY = doc.y;
  doc.roundedRect(50, boxY, 495, 34, 6).fillAndStroke('#e7efe4', '#d9dfd2');
  doc.fillColor('#3f5b45').fontSize(13).font('Helvetica-Bold')
    .text(`Bill No: ${bill.bill_number}`, 62, boxY + 10, { characterSpacing: 0.5 });
  doc.y = boxY + 34;
  doc.moveDown(1);

  // ---- Patient/doctor details ----
  doc.font('Helvetica').fontSize(10).fillColor('#26301f');
  doc.text(`Date: ${formatDateTime(bill.created_at)}`);
  doc.text(`Patient: ${bill.patient_name}`);
  doc.text(`Phone: ${bill.patient_phone}`);
  doc.moveDown(1);

  // ---- Items table ----
  let y = doc.y;
  doc.roundedRect(50, y, 495, 24, 4).fill('#e7efe4');
  doc.fillColor('#3f5b45').font('Helvetica-Bold').fontSize(10);
  doc.text('Medicine', 60, y + 7, { width: 330 });
  doc.text('Price', 445, y + 7, { width: 90, align: 'right' });
  y += 30;

  doc.font('Helvetica').fontSize(10).fillColor('#26301f');
  bill.items.forEach((item, i) => {
    if (i % 2 === 0) doc.rect(50, y - 4, 495, 22).fill('#faf7f0');
    doc.fillColor('#26301f');
    doc.text(item.medicine_name, 60, y, { width: 330 });
    doc.text(`Rs.${Number(item.line_total).toFixed(2)}`, 445, y, { width: 90, align: 'right' });
    y += 22;
  });

  y += 8;
  doc.strokeColor('#d9dfd2').lineWidth(1).moveTo(50, y).lineTo(545, y).stroke();
  y += 12;

  doc.font('Helvetica').fontSize(10.5).fillColor('#5a6355');
  if (Number(bill.consulting_fee) > 0) {
    doc.text(`Consulting Fee:  Rs.${Number(bill.consulting_fee).toFixed(2)}`, 345, y, { width: 200, align: 'right' });
    y += 17;
  }
  doc.text(`Subtotal:  Rs.${Number(bill.subtotal).toFixed(2)}`, 345, y, { width: 200, align: 'right' });
  y += 17;
  if (Number(bill.discount) > 0) {
    doc.text(`Discount:  -Rs.${Number(bill.discount).toFixed(2)}`, 345, y, { width: 200, align: 'right' });
    y += 17;
  }
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#3f5b45')
    .text(`Grand Total:  Rs.${Number(bill.grand_total).toFixed(2)}`, 345, y, { width: 200, align: 'right' });

  y += 40;
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#9aa596')
    .text('This is a computer-generated bill and does not require a signature.', 50, y, { width: 495, align: 'center' });

  doc.end();
}

module.exports = { generateBillPDF };
