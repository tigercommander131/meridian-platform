import { jsPDF } from 'jspdf';

// Builds a candidate assessment report PDF from the learner-report payload.
// Plain, print-ready layout — neutral type, single teal accent, no images.
const TEAL = [15, 118, 110]; // teal-700
const INK = [23, 23, 23];
const MUTE = [115, 115, 115];

export function downloadReportPdf(report) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 48;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = margin;

  const line = (x1, yy, x2) => { doc.setDrawColor(220); doc.line(x1, yy, x2, yy); };
  const ensure = (need) => {
    if (y + need > pageH - margin) { doc.addPage(); y = margin; }
  };

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text('Candidate Assessment Report', margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTE);
  doc.text(`Generated ${new Date(report.generatedAt).toLocaleString()}`, margin, y);
  y += 20;

  // Learner block
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(report.learner.name, margin, y);
  y += 15;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...MUTE);
  const idLine = [report.learner.email, report.learner.externalId && `ID ${report.learner.externalId}`]
    .filter(Boolean).join('   ·   ');
  doc.text(idLine, margin, y);
  y += 16;

  // Summary
  doc.setTextColor(...TEAL);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`${report.summary.assessed} assessment(s) released   ·   Average ${report.summary.averagePercent}%`, margin, y);
  y += 10;
  line(margin, y, pageW - margin);
  y += 18;

  if (report.results.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...MUTE);
    doc.text('No released assessments yet.', margin, y);
  }

  for (const r of report.results) {
    ensure(70);
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${r.scenarioName}${r.role ? ' — ' + r.role.replace('_', ' ') : ''}`, margin, y);
    // score right-aligned
    doc.setTextColor(...TEAL);
    doc.text(`${r.total}/${r.maxPoints}  (${r.percent}%)`, pageW - margin, y, { align: 'right' });
    y += 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTE);
    doc.text(`${r.rubricName}   ·   released ${r.releasedAt ? new Date(r.releasedAt).toLocaleDateString() : '—'}`, margin, y);
    y += 14;

    for (const c of r.criteria) {
      ensure(16);
      doc.setTextColor(...INK);
      doc.setFontSize(9);
      doc.text(`• ${c.name}`, margin + 8, y);
      doc.text(`${c.points}/${c.maxPoints}`, pageW - margin, y, { align: 'right' });
      y += 12;
      if (c.notes) {
        ensure(12);
        doc.setTextColor(...MUTE);
        const notes = doc.splitTextToSize(`   ${c.notes}`, pageW - margin * 2 - 8);
        doc.text(notes, margin + 16, y);
        y += notes.length * 11;
      }
    }
    if (r.assessorNotes) {
      ensure(20);
      doc.setTextColor(...MUTE);
      doc.setFontSize(9);
      const an = doc.splitTextToSize(`Assessor: ${r.assessorNotes}`, pageW - margin * 2);
      doc.text(an, margin, y);
      y += an.length * 11;
    }
    y += 8;
    line(margin, y, pageW - margin);
    y += 16;
  }

  // Footer page numbers
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTE);
    doc.text(`Page ${i} of ${pages}`, pageW - margin, pageH - 24, { align: 'right' });
    doc.text('Confidential — training record', margin, pageH - 24);
  }

  const safe = report.learner.name.replace(/[^a-z0-9]+/gi, '_');
  doc.save(`report_${safe}.pdf`);
}
