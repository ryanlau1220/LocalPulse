import { evidenceFor } from './evidence';
import { chineseCopy, chineseFindings } from './chinese';
// Build one combined proposal and evidence report, suitable for download or preview attachment.
export async function createProposal({ prospect, settings, findings, language = 'en' }) {
  const bm = language === 'ms', zh = language === 'zh';
  const t = (en, ms) => zh ? (chineseCopy[en] || en) : bm ? ms : en;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({orientation:'portrait', format:'a4'});
  if (zh) {
    const response = await fetch('/fonts/NotoSansSC-Regular.ttf');
    if (!response.ok) throw new Error('Chinese PDF font unavailable');
    const font = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;response.blob().then(blob=>reader.readAsDataURL(blob),reject)});
    doc.addFileToVFS('NotoSansSC.ttf',font); doc.addFont('NotoSansSC.ttf','NotoSC','normal'); doc.addFont('NotoSansSC.ttf','NotoSC','bold');
  }
  const setFont = bold => doc.setFont(zh ? 'NotoSC' : 'helvetica', bold ? 'bold' : 'normal');
  const navy = [25, 48, 79], blue = [26, 115, 232], muted = [100, 119, 144];
  const filename = `${(prospect.name || 'business').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-proposal.pdf`;
  const safe = value => String(value ?? '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"');
  const demoNotes = {
    'Review mobile usability': `Pada lebar ${prospect.audit?.mobileOverflow?.viewportWidth || 390} px, tajuk terpotong di sebelah kanan dan halaman melimpah secara mendatar.`,
    'Add a contact or booking path': 'Tiada pautan WhatsApp atau tempahan ditemui pada halaman yang dipaparkan. Halaman lain mungkin mempunyai pilihan tersebut.',
    'Improve search result description': 'Penerangan halaman bersifat umum dan tidak menerangkan perniagaan ini. Enjin carian mungkin memilih teks lain.',
    'Review direct contact links': 'Tiada pautan telefon atau e-mel ditemui pada halaman yang dipaparkan. Halaman lain mungkin mempunyai pilihan tersebut.'
  };
  let brandMark = null;
  try {
    const response = await fetch('/localpulse-mark.png');
    if (response.ok) brandMark = new Uint8Array(await response.arrayBuffer());
  } catch { /* Keep the report usable if the image cannot be loaded. */ }
  let businessLogo = null;
  if (prospect.demo && prospect.logo?.startsWith('/businesses/')) {
    try {
      const image = new Image();
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = prospect.logo; });
      const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 120;
      canvas.getContext('2d').drawImage(image, 0, 0, 120, 120); businessLogo = canvas.toDataURL('image/png');
    } catch { /* Continue without the sample logo if it cannot be loaded. */ }
  }
  let y = 0;
  function header() {
    if (brandMark) doc.addImage(brandMark, 'PNG', 17, 5, 8, 8, 'localpulse-mark');
    else { doc.setFillColor(...blue); doc.roundedRect(17, 5, 8, 8, 2, 2, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...navy);
    doc.text('local', 28, 10.7);
    doc.setTextColor(...blue); doc.text('pulse', 28 + doc.getTextWidth('local'), 10.7);
    setFont(false); doc.setTextColor(...muted); doc.setFontSize(8);
    doc.text(t('WEBSITE PROPOSAL', 'CADANGAN LAMAN WEB'), 193, 10.5, {align:'right'});
    doc.setDrawColor(221,230,240); doc.setLineWidth(.3); doc.line(17, 18, 193, 18);
    y = 27;
  }
  function page() { doc.addPage(); header(); }
  function line(value, size = 10, color = navy, bold = false, x = 17, maxWidth = 176) {
    setFont(bold); doc.setFontSize(size);
    const lines = doc.splitTextToSize(safe(value), maxWidth);
    for (const text of lines) {
      if (y > 272) page();
      setFont(bold); doc.setFontSize(size); doc.setTextColor(...color);
      doc.text(text, x, y); y += size * .45 + 1.5;
    }
    y += 2;
  }
  header();
  line(t('Website presence audit & proposal', 'Audit kehadiran laman web dan cadangan'), 18, navy, true);
  if (prospect.demo) line(t('SAMPLE ONLY - FICTIONAL BUSINESS', 'CONTOH SAHAJA - PERNIAGAAN REKAAN'), 8, [155,101,42], true);
  const detailsTop = y + 1;
  y = detailsTop;
  line(t('PREPARED FOR', 'DISEDIAKAN UNTUK'), 8, blue, true, 17, 80);
  if (businessLogo) doc.addImage(businessLogo, 'PNG', 17, y - 4, 9, 9, 'sample-business-logo');
  const clientX = businessLogo ? 29 : 17, clientWidth = businessLogo ? 68 : 80;
  line(prospect.name, 12, navy, true, clientX, clientWidth);
  line(prospect.location || t('Location to be confirmed', 'Lokasi akan disahkan'), 9, muted, false, clientX, clientWidth);
  const leftBottom = y;
  y = detailsTop;
  line(t('PREPARED BY', 'DISEDIAKAN OLEH'), 8, blue, true, 109, 84);
  line(settings.business || t('To be confirmed', 'Akan disahkan'), 10, navy, true, 109, 84);
  line(settings.contact || t('Contact to be confirmed', 'Maklumat hubungan akan disahkan'), 9, muted, false, 109, 84);
  y = Math.max(leftBottom, y) + 2;
  doc.setDrawColor(221,230,240); doc.line(17, y, 193, y); y += 7;
  line(`${t('INDICATIVE STARTING PRICE', 'HARGA PERMULAAN ANGGARAN')}: ${settings.currency || 'RM'} ${settings.price || t('To be confirmed', 'Akan disahkan')}`, 10, navy, true);
  line(t('Editable estimate; scope, timeline and price are subject to agreement.', 'Anggaran boleh diubah; skop, tempoh dan harga tertakluk kepada persetujuan.'), 8, muted);
  line(t('Audit overview', 'Ringkasan audit'), 13, navy, true);
  line(t('This preliminary report summarises website findings, supporting evidence and practical next steps.', 'Laporan awal ini merumuskan penemuan laman web, bukti sokongan dan langkah seterusnya.'), 9);
  if (prospect.documentAnalysis) line(`${t('Company information (original text)', 'Maklumat syarikat (teks asal)')}: ${prospect.documentAnalysis.summary}`, 9, muted);
  line(t('FINDINGS AND NEXT STEPS', 'PENEMUAN DAN LANGKAH SETERUSNYA'), 10, blue, true);
  if (!findings.length) line(t('No clear issues were detected in the basic checks. A full review is recommended.', 'Tiada isu jelas dikesan dalam semakan asas. Semakan penuh disyorkan.'));
  for (const [index, finding] of findings.entries()) {
    const evidence = evidenceFor(prospect, finding.title);
    const translated = chineseFindings[finding.title];
    const title = zh ? (finding.zh || translated?.[0] || `${finding.title} (原文)`) : bm ? (finding.ms || finding.title) : finding.title;
    const detail = zh ? (finding.zhDetail || (finding.title === 'Review mobile usability' && prospect.audit?.mobileOverflow ? `在 ${prospect.audit.mobileOverflow.viewportWidth}px 宽的视图中，页面宽度达到 ${prospect.audit.mobileOverflow.documentWidth}px，标题被截断。请允许文字换行并消除横向溢出。` : translated?.[1]) || `${finding.detail} (原文)`) : bm ? (finding.msDetail || `${finding.detail} (teks asal)`) : finding.detail;
    const priority = zh ? ({High:'高',Medium:'中',Review:'待审核'}[finding.priority] || finding.priority) : bm ? ({High:'Tinggi',Medium:'Sederhana',Review:'Semak'}[finding.priority] || finding.priority) : finding.priority;
    const effort = zh ? String(finding.effort || '').replace('hours','小时').replace('hour','小时').replace('days','天').replace('day','天').replace('min','分钟') : bm ? String(finding.effort || '').replace('hours','jam').replace('hour','jam').replace('days','hari').replace('day','hari').replace('min','minit') : finding.effort;
    if (y > (evidence ? 145 : 235)) page();
    const top = y;
    line(`${index + 1}. ${title}`, 11, navy, true, 17, evidence ? 84 : 176);
    line(`${priority}  |  ${effort}`, 8, blue, true, 17, evidence ? 84 : 176);
    line(detail, 9, navy, false, 17, evidence ? 84 : 176);
    let bottom = y;
    if (evidence) {
      try {
        const source = evidence.src.startsWith('data:') ? evidence.src : await fetch(evidence.src).then(r => { if (!r.ok) throw Error('Image unavailable'); return r.blob(); }).then(blob => new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); }));
        const props = doc.getImageProperties(source), maxHeight = evidence.device === 'Mobile viewport' ? 100 : 74;
        const width = Math.min(78, props.width * maxHeight / props.height), height = width * props.height / props.width;
        setFont(true); doc.setFontSize(8); doc.setTextColor(180,45,49);
        doc.text(doc.splitTextToSize(safe(`${evidence.region ? t('REVIEW','SEMAKAN') : t('SCREENSHOT','TANGKAPAN SKRIN')}: ${title}`),78)[0], 113, top);
        doc.setDrawColor(220,229,240); doc.setLineWidth(.3); doc.line(107, top - 3, 107, top + height + 4);
        doc.addImage(source, 'JPEG', 113, top + 4, width, height, undefined, 'FAST');
        if (evidence.region) { const r = evidence.region; doc.setDrawColor(210,48,54); doc.setLineWidth(.75); doc.rect(113 + width*r.x,top + 4 + height*r.y,width*r.width,height*r.height); }
        bottom = Math.max(bottom, top + height + 9); y = bottom;
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
        const context = zh && evidence.kind !== 'reviewer' && translated ? translated[1] : bm && evidence.kind !== 'reviewer' && demoNotes[finding.title] ? demoNotes[finding.title] : evidence.note || t('Provided by the reviewer; verify the finding independently.','Diberikan oleh penyemak; sahkan penemuan secara berasingan.');
        line(`${t('Screenshot context','Konteks tangkapan skrin')}${(bm || zh) && evidence.kind === 'reviewer' && evidence.note ? (zh ? ' (原文)' : ' (teks asal)') : ''}: ${context}`, 8, muted);
        if (evidence.reproduction && ((!bm && !zh) || evidence.kind === 'reviewer')) line(`${t('Steps to reproduce','Langkah untuk mengulangi')}${bm ? ' (teks asal)' : zh ? ' (原文)' : ''}: ${evidence.reproduction}`, 8, muted);
      } catch { y = bottom; line(t('Screenshot could not be included; verify this finding independently.', 'Tangkapan skrin tidak dapat disertakan; sahkan penemuan ini secara berasingan.'), 8, muted); }
    } else line(t('Screenshot not supplied; verify this finding independently.', 'Tangkapan skrin belum disediakan; sila sahkan penemuan ini.'), 8, muted);
    y += 5;
  }
  if (y > 230) page();
  line(t('PROPOSED WEBSITE', 'CADANGAN LAMAN WEB'), 10, blue, true);
  line(t('A mobile-friendly business website with business details, an agreed set of pages and a clear contact option.', 'Laman web mesra mudah alih dengan maklumat perniagaan, halaman yang dipersetujui dan cara menghubungi anda.'), 9);
  line(t('Website checks inspect the returned page only and are not a full usability test. Screenshots provide visual context, not proof that an absent feature does not exist. Google information and review replies may require verification.', 'Semakan laman web hanya meliputi halaman yang diterima dan bukan ujian kebolehgunaan penuh. Tangkapan skrin memberi konteks visual, bukan bukti bahawa sesuatu ciri tidak wujud. Maklumat Google dan balasan ulasan mungkin perlu disahkan. Teks dalam tangkapan skrin dan nota pengguna dikekalkan dalam bahasa asal.'), 8, muted);
  const totalPages = doc.getNumberOfPages();
  for (let number = 1; number <= totalPages; number++) {
    doc.setPage(number); doc.setDrawColor(221,230,240); doc.setLineWidth(.3); doc.line(17, 282, 193, 282);
    setFont(false); doc.setFontSize(8); doc.setTextColor(...muted);
    doc.text(doc.splitTextToSize(safe(prospect.name || ''), 140)[0] || '', 17, 287);
    doc.text(`${number} / ${totalPages}`, 193, 287, {align:'right'});
  }
  return { blob: doc.output('blob'), filename };
}
