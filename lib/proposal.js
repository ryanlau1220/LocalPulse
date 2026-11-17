import { evidenceFor, fullScreenshot } from './evidence';
// Build one combined proposal and evidence report, suitable for download or preview attachment.
export async function createProposal({ prospect, settings, findings }) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const navy = [25, 48, 79], blue = [26, 115, 232], muted = [100, 119, 144];
  const filename = `${(prospect.name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-proposal.pdf`;
  const safe = value => String(value ?? '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  let y = 0;
  function page() {
    doc.addPage();
    doc.setFillColor(...navy); doc.rect(0, 0, 210, 16, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255); doc.setFontSize(10); doc.text('LOCALPULSE', 17, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text('WEBSITE PROPOSAL / CADANGAN LAMAN WEB', 193, 10, { align: 'right' });
    y = 29;
  }
  function line(value, size = 10, color = navy, bold = false) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color);
    const lines = doc.splitTextToSize(safe(value), 176);
    for (const text of lines) { if (y > 275) page(); doc.text(text, 17, y); y += size * .45 + 1.5; }
    y += 2;
  }
  doc.setFillColor(...navy); doc.rect(0, 0, 210, 115, 'F');
  try {
    const response = await fetch('/localpulse-mark.png');
    if (!response.ok) throw Error('Logo unavailable');
    doc.addImage(new Uint8Array(await response.arrayBuffer()), 'PNG', 17, 17, 11, 11);
  } catch {
    doc.setFillColor(...blue); doc.roundedRect(17, 17, 11, 11, 3, 3, 'F');
  }
  doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text('local', 32, 25);
  doc.setTextColor(138, 180, 248); doc.text('pulse', 32 + doc.getTextWidth('local'), 25);
  doc.setFontSize(9); doc.setTextColor(167, 198, 244); doc.text('WEBSITE PROPOSAL / CADANGAN LAMAN WEB', 17, 49);
  doc.setFontSize(25); doc.setTextColor(255); doc.text(['Let\'s make your business', 'easier to find.'], 17, 69);
  if (prospect.demo) { doc.setFontSize(9); doc.setTextColor(255, 216, 163); doc.text('SAMPLE ONLY - FICTIONAL BUSINESS / CONTOH SAHAJA', 17, 104); }
  if (prospect.demo && prospect.logo?.startsWith('/businesses/')) {
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = prospect.logo; });
      const canvas = document.createElement('canvas');
      canvas.width = 120; canvas.height = 120;
      canvas.getContext('2d').drawImage(image, 0, 0, 120, 120);
      doc.addImage(canvas.toDataURL('image/png'), 'PNG', 172, 126, 20, 20);
    } catch { /* The proposal remains usable if the sample logo is unavailable. */ }
  }
  y = 132;
  line('PREPARED FOR / DISEDIAKAN UNTUK', 8, blue, true); line(prospect.name, 16, navy, true);
  line(prospect.location || 'Location to be confirmed / Lokasi akan disahkan', 10, muted);
  y += 7; line('PREPARED BY / DISEDIAKAN OLEH', 8, blue, true);
  line(settings.business || 'To be confirmed / Akan disahkan', 12, navy, true);
  line(settings.contact || 'Contact to be confirmed / Hubungi akan disahkan', 10, muted);
  y += 8; line('INDICATIVE STARTING PRICE / HARGA PERMULAAN ANGGARAN', 8, blue, true);
  line(`${settings.currency || 'RM'} ${settings.price || 'To be confirmed / Akan disahkan'}`, 18, navy, true);
  line('Editable estimate; scope, timeline and price are subject to agreement. / Anggaran boleh diubah; skop, tempoh dan harga tertakluk kepada persetujuan.', 9, muted);
  page();
  line('A clearer path to your customers', 19, navy, true);
  line('A mobile-friendly website can help customers find your business and contact you. / Laman web mesra mudah alih membantu pelanggan mencari dan menghubungi perniagaan anda.', 10);
  if (prospect.documentAnalysis) line(`Company information / Maklumat syarikat: ${prospect.documentAnalysis.summary}`, 10, muted);
  line('FINDINGS AND NEXT STEPS / PENEMUAN DAN LANGKAH SETERUSNYA', 10, blue, true);
  if (!findings.length) line('No clear issues were detected in the basic checks. A full review is recommended. / Tiada isu jelas dikesan dalam semakan asas. Semakan penuh disyorkan.');
  for (const [index, finding] of findings.entries()) {
    const evidence = evidenceFor(prospect, finding.title);
    if (y > (evidence ? 160 : 235)) page();
    line(`${index + 1}. ${finding.title} / ${finding.ms}  |  ${finding.priority}  |  ${finding.effort}`, 11, navy, true);
    line(`${finding.detail} / ${finding.msDetail}`, 9);
    if (evidence) {
      try {
        const source = evidence.src.startsWith('data:') ? evidence.src : await fetch(evidence.src).then(r => { if (!r.ok) throw Error('Image unavailable'); return r.blob(); }).then(blob => new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }));
        const props = doc.getImageProperties(source); const width = Math.min(135, props.width * 55 / props.height); const height = width * props.height / props.width;
        if (y + height + 22 > 275) page();
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(180, 45, 49);
        doc.text(doc.splitTextToSize(safe(`REVIEW: ${finding.title}`), 170)[0], 17, y); y += 4;
        doc.addImage(source, 'JPEG', 17, y, width, height, undefined, 'FAST');
        const region = evidence.region || fullScreenshot;
        doc.setDrawColor(210, 48, 54); doc.setLineWidth(.75);
        doc.rect(17 + width * region.x, y + height * region.y, width * region.width, height * region.height);
        y += height + 5;
        line(`Screenshot context: ${evidence.note || 'Provided by the reviewer; verify the finding independently.'}`, 8, muted);
      } catch { line('Screenshot could not be included; verify this finding independently.', 8, muted); }
    } else line('Screenshot not supplied; verify this finding independently. / Tangkapan skrin belum disediakan; sila sahkan penemuan ini.', 8, muted);
    y += 4;
  }
  if (y > 230) page();
  line('PROPOSED WEBSITE / CADANGAN LAMAN WEB', 10, blue, true);
  line('A mobile-friendly business website with business details, an agreed set of pages and a clear contact option. / Laman web mesra mudah alih dengan maklumat perniagaan, halaman yang dipersetujui dan cara menghubungi anda.', 9);
  line('Website checks inspect the returned page only and are not a full usability test. Screenshots provide visual context, not proof that an absent feature does not exist. Google information and review replies may require verification.', 8, muted);
  return { blob: doc.output('blob'), filename };
}
