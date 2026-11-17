import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';

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
} finally { await browser.close(); }
