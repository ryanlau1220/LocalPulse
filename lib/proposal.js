import { evidenceFor } from './evidence';
// Build one combined proposal and evidence report, suitable for download or preview attachment.
export async function createProposal({ prospect, settings, findings, language = 'en' }) {
  const bm = language === 'ms';
  const t = (en, ms) => bm ? ms : en;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const navy = [25, 48, 79], blue = [26, 115, 232], muted = [100, 119, 144];
  const filename = `${(prospect.name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-proposal.pdf`;
  const safe = value => String(value ?? '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  const demoNotes = {
    'Review mobile usability': `Pada lebar ${prospect.audit?.mobileOverflow?.viewportWidth || 390} px, tajuk terpotong di sebelah kanan dan halaman melimpah secara mendatar.`,
    'Add a contact or booking path': 'Tiada pautan WhatsApp atau tempahan ditemui pada halaman yang dipaparkan. Halaman lain mungkin mempunyai pilihan tersebut.',
    'Improve search result description': 'Penerangan halaman bersifat umum dan tidak menerangkan perniagaan ini. Enjin carian mungkin memilih teks lain.',
    'Review direct contact links': 'Tiada pautan telefon atau e-mel ditemui pada halaman yang dipaparkan. Halaman lain mungkin mempunyai pilihan tersebut.'
  };
  let y = 0;
  function page() {
    doc.addPage();
    doc.setFillColor(...navy); doc.rect(0, 0, 210, 16, 'F');
    doc.setFont('helvetica', 'bold'); doc.setTextColor(255); doc.setFontSize(10); doc.text('LOCALPULSE', 17, 10);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.text(t('WEBSITE PROPOSAL', 'CADANGAN LAMAN WEB'), 193, 10, { align: 'right' });
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
  doc.setFontSize(9); doc.setTextColor(167, 198, 244); doc.text(t('WEBSITE PROPOSAL', 'CADANGAN LAMAN WEB'), 17, 49);
  doc.setFontSize(25); doc.setTextColor(255); doc.text(bm ? ['Jadikan perniagaan anda', 'lebih mudah ditemui.'] : ["Let's make your business", 'easier to find.'], 17, 69);
  if (prospect.demo) { doc.setFontSize(9); doc.setTextColor(255, 216, 163); doc.text(t('SAMPLE ONLY - FICTIONAL BUSINESS', 'CONTOH SAHAJA - PERNIAGAAN REKAAN'), 17, 104); }
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
  line(t('PREPARED FOR', 'DISEDIAKAN UNTUK'), 8, blue, true); line(prospect.name, 16, navy, true);
  line(prospect.location || t('Location to be confirmed', 'Lokasi akan disahkan'), 10, muted);
  y += 7; line(t('PREPARED BY', 'DISEDIAKAN OLEH'), 8, blue, true);
  line(settings.business || t('To be confirmed', 'Akan disahkan'), 12, navy, true);
  line(settings.contact || t('Contact to be confirmed', 'Maklumat hubungan akan disahkan'), 10, muted);
  y += 8; line(t('INDICATIVE STARTING PRICE', 'HARGA PERMULAAN ANGGARAN'), 8, blue, true);
  line(`${settings.currency || 'RM'} ${settings.price || t('To be confirmed', 'Akan disahkan')}`, 18, navy, true);
  line(t('Editable estimate; scope, timeline and price are subject to agreement.', 'Anggaran boleh diubah; skop, tempoh dan harga tertakluk kepada persetujuan.'), 9, muted);
  page();
  line(t('A clearer path to your customers', 'Lebih dekat dengan pelanggan anda'), 19, navy, true);
  line(t('A mobile-friendly website can help customers find your business and contact you.', 'Laman web mesra mudah alih membantu pelanggan mencari dan menghubungi perniagaan anda.'), 10);
  if (prospect.documentAnalysis) line(`${t('Company information (original text)', 'Maklumat syarikat (teks asal)')}: ${prospect.documentAnalysis.summary}`, 10, muted);
  line(t('FINDINGS AND NEXT STEPS', 'PENEMUAN DAN LANGKAH SETERUSNYA'), 10, blue, true);
  if (!findings.length) line(t('No clear issues were detected in the basic checks. A full review is recommended.', 'Tiada isu jelas dikesan dalam semakan asas. Semakan penuh disyorkan.'));
  for (const [index, finding] of findings.entries()) {
    const evidence = evidenceFor(prospect, finding.title);
    if (y > (evidence?.device === 'Mobile viewport' ? 115 : evidence?.kind === 'inspected-demo' ? 120 : evidence ? 160 : 235)) page();
    line(`${index + 1}. ${bm ? (finding.ms || finding.title) : finding.title}  |  ${bm ? ({High:'Tinggi',Medium:'Sederhana',Review:'Semak'}[finding.priority] || finding.priority) : finding.priority}  |  ${bm ? String(finding.effort || '').replace('hours','jam').replace('hour','jam').replace('days','hari').replace('day','hari').replace('min','minit') : finding.effort}`, 11, navy, true);
    line(bm ? (finding.msDetail || `${finding.detail} (teks asal)`) : finding.detail, 9);
    if (evidence) {
      try {
        const source = evidence.src.startsWith('data:') ? evidence.src : await fetch(evidence.src).then(r => { if (!r.ok) throw Error('Image unavailable'); return r.blob(); }).then(blob => new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }));
        const props = doc.getImageProperties(source); const maxHeight = evidence.device === 'Mobile viewport' ? 105 : evidence.kind === 'inspected-demo' ? 80 : 55;
        const width = Math.min(135, props.width * maxHeight / props.height); const height = width * props.height / props.width;
        if (y + height + 30 > 275) page();
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(180, 45, 49);
        doc.text(doc.splitTextToSize(safe(`${evidence.region ? t('REVIEW','SEMAKAN') : t('SCREENSHOT','TANGKAPAN SKRIN')}: ${bm ? (finding.ms || finding.title) : finding.title}`), 170)[0], 17, y); y += 4;
        doc.addImage(source, 'JPEG', 17, y, width, height, undefined, 'FAST');
        if (evidence.region) {
          const region = evidence.region;
          doc.setDrawColor(210, 48, 54); doc.setLineWidth(.75);
          doc.rect(17 + width * region.x, y + height * region.y, width * region.width, height * region.height);
        }
        y += height + 5;
        if (evidence.kind === 'measured-demo') {
          line(`${t('Mobile viewport','Paparan mudah alih')}: ${evidence.viewportWidth} x ${evidence.viewportHeight} CSS px | ${evidence.browser} | ${t('Captured','Dirakam')} ${evidence.capturedAt}`, 8, muted);
          line(`${t('Source','Sumber')}: ${evidence.sourcePath} (${t('fictional demo','contoh rekaan')})`, 8, muted);
        }
        if (evidence.kind === 'inspected-demo') {
          line(`${t('Generated DOM inspection','Paparan pemeriksaan DOM')} | ${evidence.browser} | ${t('Captured','Dirakam')} ${evidence.capturedAt}`, 8, muted);
          line(`${t('Source','Sumber')}: ${evidence.sourcePath} (${t('fictional demo','contoh rekaan')})`, 8, muted);
        }
        if (evidence.kind === 'reviewer' && (evidence.device !== 'Not specified' || evidence.viewportWidth || evidence.viewportHeight)) {
          const viewport = evidence.viewportWidth && evidence.viewportHeight ? ` | ${evidence.viewportWidth} x ${evidence.viewportHeight} CSS px` : evidence.viewportWidth ? ` | width ${evidence.viewportWidth} CSS px` : evidence.viewportHeight ? ` | height ${evidence.viewportHeight} CSS px` : '';
          line(`${t('Reviewer-reported view','Paparan dilaporkan penyemak')}: ${evidence.device || t('Not specified','Tidak dinyatakan')}${viewport}`, 8, muted);
        }
        if (evidence.kind === 'reviewer' && (evidence.browser || evidence.capturedDate)) line(`${t('Reviewer-reported capture','Rakaman dilaporkan penyemak')}: ${[evidence.browser, evidence.capturedDate].filter(Boolean).join(' | ')}`, 8, muted);
        line(`${t('Screenshot context','Konteks tangkapan skrin')}${bm && evidence.kind === 'reviewer' && evidence.note ? ' (teks asal)' : ''}: ${bm && evidence.kind !== 'reviewer' && demoNotes[finding.title] ? demoNotes[finding.title] : evidence.note || t('Provided by the reviewer; verify the finding independently.','Diberikan oleh penyemak; sahkan penemuan secara berasingan.')}`, 8, muted);
        if (evidence.reproduction && (!bm || evidence.kind === 'reviewer')) line(`${t('Steps to reproduce','Langkah untuk mengulangi')}${bm ? ' (teks asal)' : ''}: ${evidence.reproduction}`, 8, muted);
      } catch { line(t('Screenshot could not be included; verify this finding independently.', 'Tangkapan skrin tidak dapat disertakan; sahkan penemuan ini secara berasingan.'), 8, muted); }
    } else line(t('Screenshot not supplied; verify this finding independently.', 'Tangkapan skrin belum disediakan; sila sahkan penemuan ini.'), 8, muted);
    y += 4;
  }
  if (y > 230) page();
  line(t('PROPOSED WEBSITE', 'CADANGAN LAMAN WEB'), 10, blue, true);
  line(t('A mobile-friendly business website with business details, an agreed set of pages and a clear contact option.', 'Laman web mesra mudah alih dengan maklumat perniagaan, halaman yang dipersetujui dan cara menghubungi anda.'), 9);
  line(t('Website checks inspect the returned page only and are not a full usability test. Screenshots provide visual context, not proof that an absent feature does not exist. Google information and review replies may require verification.', 'Semakan laman web hanya meliputi halaman yang diterima dan bukan ujian kebolehgunaan penuh. Tangkapan skrin memberi konteks visual, bukan bukti bahawa sesuatu ciri tidak wujud. Maklumat Google dan balasan ulasan mungkin perlu disahkan. Teks dalam tangkapan skrin dan nota pengguna dikekalkan dalam bahasa asal.'), 8, muted);
  return { blob: doc.output('blob'), filename };
}
