import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { writeFile, mkdir } from 'node:fs/promises';

// Capture only the trusted, fictional demo hosted on this computer.
const origin = new URL(process.env.LOCALPULSE_DEMO_ORIGIN || 'http://localhost:3001');
if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || origin.protocol !== 'http:') throw new Error('The demo capture must use a local HTTP server.');
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch({ ...(executablePath ? { executablePath } : {}), headless:true });
try {
  const page = await browser.newPage({ viewport:{ width:390, height:844 }, deviceScaleFactor:1, isMobile:true, hasTouch:true });
  const response = await page.goto(new URL('/demo/bluebird', origin).href, { waitUntil:'networkidle' });
  if (!response?.ok()) throw new Error(`Demo page returned ${response?.status()}`);
  await page.evaluate(() => document.fonts.ready);
  const metrics = await page.evaluate(() => {
    const heading = document.querySelector('.bluebird-hero h1');
    if (!heading) throw new Error('Demo heading not found');
    const rect = heading.getBoundingClientRect();
    return {viewportWidth:document.documentElement.clientWidth,viewportHeight:document.documentElement.clientHeight,documentWidth:document.documentElement.scrollWidth,headingRight:Math.ceil(rect.right),headingTop:rect.top,headingBottom:rect.bottom};
  });
  if (metrics.headingRight <= metrics.viewportWidth || metrics.documentWidth <= metrics.viewportWidth) throw new Error('The expected clipped heading was not observed; screenshot was not updated.');
  await page.addStyleTag({content:'nextjs-portal{display:none!important}'});
  await page.screenshot({path:'public/bluebird-mobile-evidence.jpg',type:'jpeg',quality:85});
  // This is a temporary design concept, not a change deployed to the example site.
  await page.addStyleTag({content:'@media(max-width:600px){.bluebird-site .bluebird-hero h1{width:auto;max-width:100%;white-space:normal;font-size:48px;overflow-wrap:anywhere}}'});
  const proposed = await page.evaluate(() => ({viewportWidth:document.documentElement.clientWidth, documentWidth:document.documentElement.scrollWidth, headingRight:Math.ceil(document.querySelector('.bluebird-hero h1').getBoundingClientRect().right)}));
  if (proposed.documentWidth > proposed.viewportWidth || proposed.headingRight > proposed.viewportWidth) throw new Error('The proposed mobile concept still overflows; screenshot was not updated.');
  await page.screenshot({path:'public/bluebird-mobile-proposed.jpg',type:'jpeg',quality:85});
  const metadata={...metrics,proposed,browser:`Chromium ${browser.version()} (mobile emulation)`,capturedAt:new Date().toISOString(),path:'/demo/bluebird',region:{x:.72,y:Math.max(0,(metrics.headingTop-4)/metrics.viewportHeight),width:.27,height:Math.min(1,(metrics.headingBottom-metrics.headingTop+8)/metrics.viewportHeight)}};
  await writeFile('lib/bluebird-mobile-evidence.json',JSON.stringify(metadata,null,2)+'\n');
  console.log(`Captured ${metadata.viewportWidth}×${metadata.viewportHeight}; page width ${metadata.documentWidth}px; heading right edge ${metadata.headingRight}px.`);
  await mkdir('public/evidence', {recursive:true});
  const inspections = {};
  const escape = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
  const inspector = await browser.newPage({viewport:{width:1200,height:800},deviceScaleFactor:1});
  for (const slug of ['bluebird','luma','petal','golden']) {
    const source = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const path = `/demo/${slug}`;
    const result = await source.goto(new URL(path, origin).href,{waitUntil:'networkidle'});
    if (!result?.ok()) throw new Error(`Unable to capture ${path}`);
    await source.evaluate(() => document.fonts.ready);
    await source.addStyleTag({content:'nextjs-portal{display:none!important}'});
    const data = await source.evaluate(() => {
      const links = [...document.querySelectorAll('a[href]')].map(a => ({text:a.textContent.trim(),href:a.getAttribute('href')}));
      return {title:document.title,description:document.querySelector('meta[name="description"]')?.content || '',links,
        counts:{whatsapp:links.filter(a=>/wa\.me\/|(?:api|web)\.whatsapp\.com/i.test(a.href)).length,booking:links.filter(a=>/\b(book|booking|reserve|reservation)\b/i.test(`${a.text} ${a.href}`)).length,phone:links.filter(a=>/^tel:/i.test(a.href)).length,email:links.filter(a=>/^mailto:/i.test(a.href)).length}};
    });
    if (Object.values(data.counts).some(Boolean) || !data.description.includes('practical opportunities')) throw new Error(`Unexpected demo content at ${path}; inspect before updating evidence.`);
    const screenshot = (await source.screenshot({type:'jpeg',quality:78})).toString('base64');
    inspections[slug] = {...data,sourcePath:path,browser:`Chromium ${browser.version()} (mobile emulation)`,capturedAt:new Date().toISOString()};
    const links = data.links.map(a=>`<div class="link"><strong>${escape(a.text || '(unnamed link)')}</strong><span>${escape(a.href)}</span></div>`).join('');
    for (const type of ['conversion','contact','search']) {
      const content = type === 'search'
        ? `<div class="eyebrow">PAGE METADATA</div><h1>Search description needs context</h1><p>The description describes LocalPulse rather than this business. Search engines may choose different text.</p><div class="box"><small>PAGE TITLE</small><strong>${escape(data.title)}</strong></div><div class="issue"><span class="issue-label">GENERIC DESCRIPTION</span><div class="box"><small>META DESCRIPTION</small><strong>${escape(data.description)}</strong></div></div>`
        : `<div class="eyebrow">LINK INSPECTION</div><h1>${type === 'conversion' ? 'Contact and booking paths' : 'Direct contact links'}</h1><p>Links found on the initial rendered page. Other pages may contain additional options.</p><div class="issue"><span class="issue-label">${type === 'conversion' ? 'NO MATCHING CONTACT OR BOOKING LINKS' : 'NO TELEPHONE OR EMAIL LINKS'}</span><div class="counts">${type === 'conversion' ? `<div><b>${data.counts.whatsapp}</b><span>WhatsApp links</span></div><div><b>${data.counts.booking}</b><span>Booking links</span></div>` : `<div><b>${data.counts.phone}</b><span>Telephone links</span></div><div><b>${data.counts.email}</b><span>Email links</span></div>`}</div></div><h2>Links found on this page</h2><div class="links">${links}</div>`;
      await inspector.setContent(`<!doctype html><html><head><style>*{box-sizing:border-box}body{margin:0;background:#edf3fa;color:#173354;font:17px Arial,sans-serif}.header{height:64px;background:#173354;color:white;display:flex;justify-content:space-between;align-items:center;padding:0 35px;font-weight:bold;letter-spacing:.08em;font-size:13px}.layout{display:flex;gap:38px;padding:30px 42px}.phone{width:295px;height:640px;overflow:hidden;flex:none;border:8px solid #21364d;border-radius:23px;box-shadow:0 12px 25px #b7c8d9;background:white}.phone img{width:100%;display:block}.panel{padding:16px 0;width:740px}.eyebrow{font-size:12px;color:#246bd1;font-weight:bold;letter-spacing:.13em}h1{font-size:32px;line-height:1.15;margin:12px 0}p{color:#526a83;line-height:1.45;margin:0 0 22px}h2{font-size:15px;margin:23px 0 10px}.issue{position:relative;margin-top:27px;border:3px solid #d93139;border-radius:3px;padding:5px;background:#fff}.issue-label{position:absolute;left:-3px;top:-26px;background:#c92e37;color:#fff;font-size:11px;line-height:1;font-weight:bold;letter-spacing:.03em;padding:7px 9px;border-radius:4px 4px 0 0}.issue .box{margin:0;border:0}.counts{display:flex;gap:12px}.counts div,.box{background:white;border:1px solid #dbe5ef;border-radius:12px;padding:17px;flex:1}.counts b{font-size:35px;color:#bb3740;display:block}.counts span,small{color:#607a94;font-size:13px}.links{background:white;border-radius:12px;padding:4px 16px}.link{padding:9px 0;border-bottom:1px solid #edf1f5;display:flex;justify-content:space-between;gap:20px;font-size:13px}.link:last-child{border:0}.link span{color:#607a94;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.box{margin-bottom:12px}.box small,.box strong{display:block}.box strong{font-size:17px;line-height:1.45;margin-top:9px}.footer{position:absolute;bottom:22px;left:376px;color:#607a94;font-size:12px}</style></head><body><div class="header"><span>LOCALPULSE / EVIDENCE</span><span>GENERATED INSPECTION VIEW · FICTIONAL DEMO</span></div><div class="layout"><div class="phone"><img src="data:image/jpeg;base64,${screenshot}" alt="Captured mobile page"></div><div class="panel">${content}</div></div><div class="footer">Source: ${escape(path)} · Initial rendered page · ${escape(inspections[slug].capturedAt)}</div></body></html>`);
      await inspector.screenshot({path:`public/evidence/${slug}-${type}.jpg`,type:'jpeg',quality:88});
    }
    await source.close();
  }
  await writeFile('lib/demo-inspections.json',JSON.stringify(inspections,null,2)+'\n');
  console.log('Captured inspected evidence for all four fictional demo websites.');
} finally { await browser.close(); }
