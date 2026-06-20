import { jsPDF } from 'jspdf';

// Renders a simple landscape certificate and triggers a download.
export function downloadCertificatePdf(cert) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const mid = W / 2;

  // Teal double border.
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(3);
  doc.rect(24, 24, W - 48, H - 48);
  doc.setLineWidth(1);
  doc.rect(34, 34, W - 68, H - 68);

  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text((cert.organisation || 'Indigo Learning').toUpperCase(), mid, 104, { align: 'center' });

  doc.setTextColor(23, 23, 23);
  doc.setFontSize(28);
  doc.text('Certificate of Completion', mid, 172, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(13);
  doc.setTextColor(90, 90, 90);
  doc.text('This certifies that', mid, 222, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(23, 23, 23);
  doc.text(cert.learnerName || 'Student', mid, 266, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(14);
  doc.setTextColor(90, 90, 90);
  doc.text(cert.title || 'Certificate of Completion', mid, 310, { align: 'center', maxWidth: W - 160 });

  doc.setFontSize(11);
  const issued = cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : '';
  doc.text(`Issued ${issued}`, mid, 354, { align: 'center' });

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(9);
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  doc.text(`Verify at ${base}/verify/${cert.verificationCode}`, mid, H - 56, { align: 'center' });

  doc.save(`certificate-${(cert.learnerName || 'student').replace(/\s+/g, '_')}.pdf`);
}
