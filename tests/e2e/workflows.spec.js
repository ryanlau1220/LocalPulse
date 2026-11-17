import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockServices, seedSavedProspect } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await mockServices(page);
});

async function enterLive(page) {
  await page.getByRole('button', { name: 'Demo mode' }).click();
  await expect(page.getByRole('button', { name: 'Demo mode' })).toHaveAttribute('aria-pressed', 'false');
}

test('discover, audit, select Google listing, make proposal and preview outreach', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button', { name: 'Find businesses' }).click();
  await expect(page.getByRole('heading', { name: 'Fixture Cafe', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Audit business' }).click();
  await expect(page.getByText('Website checked. Review the findings below.')).toBeVisible();
  await page.getByRole('button', { name: 'Fixture Cafe Bangsar' }).click();
  await expect(page.getByText('Match selected')).toBeVisible();
  await expect(page.getByText('Could not verify')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Outreach', exact: true })).toBeDisabled();

  await page.getByRole('button', { name: 'Build proposal' }).click();
  await expect(page.getByRole('button', { name: 'Outreach', exact: true })).toBeEnabled();
  await page.getByLabel('Your business or name').fill('Fixture Studio');
  await page.getByLabel('Contact details').fill('hello@fixture.example');
  await page.getByLabel('Indicative starting price (RM)').fill('2300');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download bilingual PDF' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('fixture-cafe-proposal.pdf');
  const contents = await readFile(await download.path());
  expect(contents.subarray(0, 5).toString()).toBe('%PDF-');
  expect(contents.length).toBeGreaterThan(1000);

  await page.getByRole('button', { name: 'Outreach', exact: true }).click();
  await expect(page.getByText('Messages stay on this screen.')).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('Hello from the demo');
  await page.getByRole('button', { name: 'Preview send' }).click();
  await expect(page.locator('.bubble').filter({ hasText: 'Hello from the demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  await expect(page.getByText('Demo conversation · Email')).toBeVisible();
  await expect(page.getByLabel('To', { exact: true })).toBeVisible();
  await page.getByLabel('To', { exact: true }).fill('owner@example.com');
  await page.getByLabel('Email message').fill('An email proposal');
  await page.getByRole('button', { name: 'Preview send' }).click();
  await expect(page.getByText('An email proposal')).toBeVisible();
  await page.getByRole('button', { name: 'WhatsApp', exact: true }).click();
  await expect(page.locator('.bubble').filter({ hasText: 'An email proposal' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  await expect(page.getByText('An email proposal')).toBeVisible();

  await page.reload();
  await enterLive(page);
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await expect(page.getByRole('heading', { name: 'Fixture Cafe', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View report' }).click();
  await page.getByRole('button', { name: 'Build proposal' }).click();
  await expect(page.getByLabel('Your business or name')).toHaveValue('Fixture Studio');
  await expect(page.getByLabel('Indicative starting price (RM)')).toHaveValue('2300');
  expect(pageErrors).toEqual([]);
});

test('seeded prospect can be reviewed and removed', async ({ page }) => {
  await seedSavedProspect(page);
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await expect(page.getByRole('heading', { name: 'Fixture Cafe', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View report' }).click();
  await expect(page.getByText('Viewport tag found')).toBeVisible();
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await page.getByRole('button', { name: 'Remove Fixture Cafe' }).click();
  await expect(page.getByText('No saved prospects yet.')).toBeVisible();
  await page.reload();
  await enterLive(page);
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await expect(page.getByText('No saved prospects yet.')).toBeVisible();
});

test('errors remain unverified and manual entry resets between businesses', async ({ page }) => {
  await page.unroute('**/api/discover**');
  await page.route('**/api/discover**', route => route.fulfill({ status: 503, json: { error: 'Map service unavailable', results: [] } }));
  await page.unroute('**/api/audit');
  await page.route('**/api/audit', route => route.fulfill({ status: 400, json: { error: 'Website unavailable' } }));
  await page.unroute('**/api/google');
  await page.route('**/api/google', route => route.fulfill({ status: 503, json: { error: 'Google unavailable' } }));
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button', { name: 'Find businesses' }).click();
  await expect(page.getByText('Map service unavailable')).toBeVisible();
  await page.getByText('Add a business').click();
  await page.getByLabel('Business name', { exact: true }).last().fill('First Cafe');
  await page.getByLabel('Website', { exact: false }).last().fill('https://first.example');
  await page.getByRole('button', { name: 'Start audit' }).click();
  await expect(page.getByText('Website could not be checked; it is marked unverified.')).toBeVisible();
  await expect(page.getByText('Google unavailable')).toBeVisible();
  await page.getByRole('button', { name: 'Discover', exact: true }).click();
  await page.getByText('Add a business').click();
  await expect(page.getByLabel('Website', { exact: false }).last()).toHaveValue('');
  await page.getByLabel('Business name', { exact: true }).last().fill('Second Cafe');
  await page.getByRole('button', { name: 'Start audit' }).click();
  await expect(page.getByText('No website was provided. This needs verification.')).toBeVisible();
  await expect(page.getByText('Website not provided', { exact: true })).toBeVisible();
});

test('motion can be paused and resumed', async ({ page }) => {
  await page.goto('/');
  const scene = page.locator('.city-float');
  await expect(scene).toHaveCSS('animation-play-state', 'running');
  await page.getByRole('button', { name: 'Pause motion' }).click();
  await expect(scene).toHaveCSS('animation-play-state', 'paused');
  await page.getByRole('button', { name: 'Play motion' }).click();
  await expect(scene).toHaveCSS('animation-play-state', 'running');
});

test('audit API rejects missing and local addresses', async ({ request }) => {
  const missing = await request.post('/api/audit', { data: {} });
  expect(missing.status()).toBe(400);
  expect((await missing.json()).error).toContain('website URL');
  const local = await request.post('/api/audit', { data: { url: 'http://127.0.0.1' } });
  expect(local.status()).toBe(400);
  expect((await local.json()).error).toContain('public IPv4');
});

test('demo mode supports the complete sample without service calls', async ({ page }) => {
  const externalCalls = [];
  page.on('request', request => {
    if (/\/api\/(discover|audit|google)(?:\?|$)/.test(request.url())) externalCalls.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await page.getByRole('button', { name: 'Audit report' }).click();
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await expect(page.getByText('This business and website are fictional. Automated findings are simulated except where measurements are shown.')).toBeVisible();
  await expect(page.getByText('Review mobile usability', { exact: true })).toBeVisible();
  await expect(page.getByText('Add a contact or booking path', { exact: true })).toBeVisible();
  await expect(page.getByText('Sample profile includes a name, phone number and opening hours. No Google request is made.')).toBeVisible();
  await page.getByRole('button', { name: 'Reload sample' }).click();
  await page.getByRole('button', { name: 'Build proposal' }).click();
  await expect(page.getByText('The business and findings are fictional.')).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download bilingual PDF' }).click(),
  ]);
  const pdf = (await readFile(await download.path())).toString('latin1');
  expect(pdf).toContain('SAMPLE ONLY');
  expect(pdf).toContain('Bluebird Corner Cafe');
  expect(pdf).toContain('LocalPulse Studio');
  await page.getByRole('button', { name: 'Outreach', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(/Bluebird Corner Cafe/);
  await page.getByRole('button', { name: 'Preview send' }).click();
  await expect(page.locator('.bubble').filter({ hasText: 'Bluebird Corner Cafe' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await expect(page.getByText('Fictional sample · simulated report')).toBeVisible();
  await page.getByRole('button', { name: 'View report' }).click();
  await page.getByRole('button', { name: 'Outreach', exact: true }).click();
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue(/Bluebird Corner Cafe/);
  expect(externalCalls).toEqual([]);
});


test('switching modes preserves live prospects and proposal settings', async ({ page }) => {
  await seedSavedProspect(page);
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await expect(page.getByRole('heading', { name: 'Fixture Cafe', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Demo mode' }).click();
  await expect(page.getByRole('button', { name: 'Demo mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await page.getByRole('button', { name: 'Proposal', exact: true }).click();
  await expect(page.getByLabel('Your business or name')).toHaveValue('LocalPulse Studio (sample)');
  await page.getByLabel('Your business or name').fill('Changed demo only');
  await page.getByRole('button', { name: 'Demo mode' }).click();
  await expect(page.getByRole('button', { name: 'Demo mode' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('heading', { name: 'Fixture Cafe', exact: true })).toBeVisible();
  const data = await page.evaluate(() => ({ prospects: JSON.parse(localStorage.getItem('localpulse-prospects-v1')), settings: JSON.parse(localStorage.getItem('localpulse-settings-v1')) }));
  expect(data.prospects.map(p => p.name)).toEqual(['Fixture Cafe']);
  expect(data.settings.business).not.toBe('Changed demo only');
});

test('demo search scans the radar, opens a pin, website and audit without network calls', async ({ page, context }) => {
  const calls = [];
  page.on('request', req => { if (/\/api\/(discover|audit|google|documents)(?:\?|$)/.test(req.url())) calls.push(req.url()); });
  await page.goto('/');
  await expect(page.getByLabel('Business name, optional')).toHaveValue('');
  await page.getByRole('button', { name:'Find businesses' }).click();
  const radar = page.getByRole('region', { name:'Business discovery radar' });
  await expect(radar.getByText('Scanning the area')).toBeVisible();
  await radar.getByRole('button', { name:'Select Bluebird Corner Cafe' }).click();
  await expect(radar.getByRole('heading', { name:'Bluebird Corner Cafe' })).toBeVisible();
  const [website] = await Promise.all([
    context.waitForEvent('page'),
    radar.getByRole('link', { name:'View website' }).click(),
  ]);
  await website.waitForLoadState();
  await expect(website.getByText('Fictional demo website · Created for LocalPulse')).toBeVisible();
  await expect(website.getByRole('heading', { name:'A little pause, a lot of good.' })).toBeVisible();
  await website.close();
  await radar.getByRole('button', { name:'View audit' }).click();
  await expect(page.getByText('Review mobile usability', { exact: true })).toBeVisible();
  expect(calls).toEqual([]);
});

test('company information upload creates a document assessment', async ({ page }) => {
  let uploadBody = '';
  await page.route('**/api/documents', async route => {
    uploadBody = route.request().postDataBuffer()?.toString('utf8') || '';
    await route.fulfill({ json: { businessName:'Harbour Fixture Cafe', category:'Cafe', location:'Bangsar', summary:'A neighbourhood cafe.', fileNames:['company.txt'], cached:true, opportunities:[{title:'Add a menu',ms:'Tambah menu',detail:'Share the menu online.',msDetail:'Kongsi menu dalam talian.',priority:'High',effort:'2 hours'}] } });
  });
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button', { name:'Upload information' }).click();
  await page.locator('input[type=file]').setInputFiles({ name:'company.txt', mimeType:'text/plain', buffer:Buffer.from('Harbour Fixture Cafe serves coffee and pastries.') });
  await expect(page.getByText('company.txt')).toBeVisible();
  await page.getByRole('button', { name:'Analyze information' }).click();
  await expect(page.getByRole('heading', { name:'Harbour Fixture Cafe' })).toBeVisible();
  await expect(page.getByText('Analysis loaded from cache.')).toBeVisible();
  await expect(page.getByText('Add a menu', { exact:true })).toBeVisible();
  await expect(page.getByText('A neighbourhood cafe.')).toBeVisible();
  expect(uploadBody).toContain('Harbour Fixture Cafe serves coffee and pastries.');
});

test('demo company notes are prefilled and use simulated analysis', async ({ page }) => {
  let calls=0;
  page.on('request', req => { if (/\/api\/(discover|audit|google|documents)(?:\?|$)/.test(req.url())) calls++; });
  await page.goto('/');
  await page.getByRole('button', { name:'Upload information' }).click();
  await expect(page.getByLabel('Company information', { exact:false })).toHaveValue(/Bluebird Corner Cafe/);
  await page.getByRole('button', { name:'Analyze information' }).click();
  await expect(page.getByText('SIMULATED ANALYSIS')).toBeVisible();
  await expect(page.getByText('Make the menu easy to find')).toBeVisible();
  expect(calls).toBe(0);
});

test('guided steps stack and remain available for going back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Demo mode' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Audit report', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Audit report', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  const card = page.locator('details.journey-card');
  await card.locator('summary').click();
  await expect(card).not.toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeHidden();
  await card.locator('summary').click();
  await expect(card).toHaveAttribute('open', '');
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await page.getByRole('button', { name: 'Build proposal' }).click();
  await expect(page.locator('.history-card')).toHaveCount(2);
  await page.locator('.history-card').filter({ hasText: 'Audit report' }).click();
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await expect(page.locator('.history-card')).toHaveCount(1);
});

test('screenshot evidence is saved, included in a proposal, and attached to previews', async ({ page }) => {
  await seedSavedProspect(page);
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await page.getByRole('button', { name: 'View report' }).click();
  await page.getByLabel('Screenshot for Add a contact or booking path').setInputFiles('public/bluebird-evidence.jpg');
  await expect(page.getByAltText('Screenshot context for Add a contact or booking path')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand screenshot for Add a contact or booking path' }).locator('.evidence-rectangle')).toHaveCount(0);
  await page.getByText('Add review details').click();
  await page.getByRole('combobox', { name: 'View', exact: true }).selectOption('Mobile');
  await page.getByLabel('Viewport width (CSS px)').fill('390');
  await page.getByLabel('Viewport height (CSS px)').fill('844');
  await page.getByLabel('Browser or device').fill('Chrome on Android');
  await page.getByLabel('Capture date').fill('2026-11-17');
  await page.getByLabel('Steps to reproduce').fill('Open the home page at 390 pixels wide.');
  await page.getByRole('button', { name: 'Expand screenshot for Add a contact or booking path' }).click();
  const evidenceDialog = page.getByRole('dialog', { name: 'Add a contact or booking path' });
  await evidenceDialog.getByText('Adjust highlight using controls').click();
  await evidenceDialog.getByLabel('Width (%)').fill('50');
  await evidenceDialog.getByRole('button', { name: 'Close screenshot' }).click();
  await page.getByLabel('What does this screenshot show?').fill('The contact section on the home page.');
  await page.reload();
  await enterLive(page);
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await page.getByRole('button', { name: 'View report' }).click();
  await expect(page.getByAltText('Screenshot context for Add a contact or booking path')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand screenshot for Add a contact or booking path' }).locator('.evidence-rectangle')).toHaveAttribute('style', /width: 50%/);
  await page.getByRole('button', { name: 'Build proposal' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download bilingual PDF' }).click()]);
  const pdf = (await readFile(await download.path())).toString('latin1');
  expect(pdf).toContain('/Subtype /Image');
  expect(pdf).toContain('Screenshot context');
  expect(pdf).toContain('The contact section on the home page.');
  expect(pdf).toContain('Reviewer-reported view: Mobile | 390 x 844 CSS px');
  expect(pdf).toContain('Open the home page at 390 pixels wide.');
  expect(pdf).toContain('Chrome on Android | 2026-11-17');
  await page.getByRole('button', { name: 'Continue to outreach' }).click();
  const composer=page.locator('.chat-composer-area');
  await expect(composer.getByRole('link', { name: 'fixture-cafe-proposal.pdf' })).toBeVisible();
  await composer.getByRole('button', { name: 'Remove proposal attachment' }).click();
  await expect(composer.getByRole('link', { name: 'fixture-cafe-proposal.pdf' })).toHaveCount(0);
  await composer.getByRole('button', { name: 'Attach proposal' }).click();
  await expect(composer.getByRole('link', { name: 'fixture-cafe-proposal.pdf' })).toBeVisible();
  await page.getByLabel('Message', { exact: true }).fill('Here is the proposal');
  await page.getByRole('button', { name: 'Preview send' }).click();
  await expect(page.locator('.bubble').filter({ hasText: 'Here is the proposal' }).getByText('fixture-cafe-proposal.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Email', exact: true }).click();
  await page.getByRole('button', { name: 'Preview send' }).click();
  await expect(page.locator('.email-previews').getByText('fixture-cafe-proposal.pdf')).toBeVisible();
});

test('sample businesses have matching websites and expandable evidence', async ({ page, context, request }) => {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Search area' })).toHaveValue('Kuala Lumpur, Malaysia');
  await expect(page.getByRole('heading', { name: 'Luma Hair Studio' })).toBeVisible();
  for (const slug of ['luma','petal','golden']) {
    const response = await request.get(`/demo/${slug}`);
    expect(response.ok()).toBeTruthy();
    expect(await response.text()).toContain('Fictional demo website');
  }
  await page.getByLabel('Search area').selectOption('Petaling Jaya, Selangor');
  await page.getByRole('button', { name: 'Find businesses' }).click();
  const radar=page.getByRole('region',{name:'Business discovery radar'});
  await expect(radar.getByRole('heading',{name:/Explore Petaling Jaya/})).toBeVisible();
  await radar.getByRole('button',{name:'Select Luma Hair Studio'}).click();
  const [website] = await Promise.all([context.waitForEvent('page'),radar.getByRole('link',{name:'View website'}).click()]);
  await website.waitForLoadState();
  await expect(website.getByRole('heading',{name:/Good hair/})).toBeVisible();
  await website.close();
  await radar.getByRole('button',{name:'View audit'}).click();
  await expect(page.getByRole('heading',{name:'Luma Hair Studio'})).toBeVisible();
  await expect(page.getByText('Improve search result description', { exact: true })).toBeVisible();
  await expect(page.getByText('No visual evidence captured for this finding. Verify it before sharing.').first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Expand screenshot for Improve search result description'})).toHaveCount(0);
});

test('current location is sent to discovery only after permission', async ({ page, context, request }) => {
  let searched='';
  await page.route('**/api/discover**', route => {searched=route.request().url();return route.fulfill({json:{results:[]}})});
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({latitude:3.145,longitude:101.701});
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button',{name:'Use my location'}).click();
  await expect(page.getByLabel('Search area')).toHaveValue('Current location');
  await page.getByRole('button',{name:'Find businesses'}).click();
  await expect(page.getByRole('heading',{name:'Explore Current location.'})).toBeVisible();
  const url=new URL(searched);
  expect(url.searchParams.get('lat')).toBe('3.145');
  expect(url.searchParams.get('lon')).toBe('101.701');
  const bad=await request.get('/api/discover?lat=200&lon=101');
  expect(bad.status()).toBe(400);
});

test('business branding links to the correct sample website and general area', async ({ page, context }) => {
  await page.goto('/');
  const row=page.locator('article.business-result').filter({hasText:'Luma Hair Studio'});
  await expect(row.locator('img')).toHaveAttribute('src','/businesses/luma.svg');
  const business=row.getByRole('link',{name:'Luma Hair Studio'});
  await expect(business).toHaveAttribute('href','/demo/luma');
  const area=row.getByRole('link',{name:/Petaling Jaya.*general area on Google Maps/});
  const map=new URL(await area.getAttribute('href'));
  expect(map.hostname).toBe('www.google.com');
  expect(map.searchParams.get('query')).toBe('Petaling Jaya, Selangor');
  const [website]=await Promise.all([context.waitForEvent('page'),business.click()]);
  await website.waitForLoadState();
  await expect(website.locator('.sample-logo img')).toHaveAttribute('src','/businesses/luma.svg');
  await website.getByRole('link',{name:'Visit us'}).click();
  await expect(website.getByRole('heading',{name:'Come find us.'})).toBeVisible();
  await expect(website.getByRole('link',{name:'Explore this area on Google Maps'})).toHaveAttribute('href',/Petaling%20Jaya/);
  await website.close();
});

test('real business links use the listed website and a labelled map search', async ({page})=>{
  await seedSavedProspect(page);
  await page.goto('/');
  await enterLive(page);
  await page.getByRole('button',{name:'Saved prospects'}).click();
  const row=page.locator('.business-result').filter({hasText:'Fixture Cafe'});
  await expect(row.getByRole('link',{name:'Fixture Cafe'})).toHaveAttribute('href','https://fixture.example/');
  const maps=row.getByRole('link',{name:/search Google Maps/});
  const url=new URL(await maps.getAttribute('href'));
  expect(url.searchParams.get('query')).toContain('Fixture Cafe');
});

test('review labels can be positioned and appear in the proposal PDF', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Audit report'}).click();
  const thumb=page.getByRole('button',{name:'Expand screenshot for Review mobile usability'});
  await expect(thumb.getByText('Heading clipped at right edge')).toBeVisible();
  await thumb.click();
  const dialog=page.getByRole('dialog',{name:'Review mobile usability'});
  const image=dialog.locator('.evidence-image');
  const bounds=await image.boundingBox();
  await page.mouse.move(bounds.x+bounds.width*.2,bounds.y+bounds.height*.2);
  await page.mouse.down();
  await page.mouse.move(bounds.x+bounds.width*.7,bounds.y+bounds.height*.65,{steps:6});
  await page.mouse.up();
  await expect(dialog.locator('.evidence-rectangle')).toHaveAttribute('style',/width: 50%/);
  await dialog.getByText('Adjust highlight using controls').click();
  await expect(dialog.getByLabel('Width (%)')).toHaveValue('50');
  await dialog.getByRole('button',{name:'Close screenshot'}).click();
  await expect(thumb.locator('.evidence-rectangle')).toHaveAttribute('style',/width: 50%/);
  await page.getByRole('button',{name:'Build proposal'}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download bilingual PDF'}).click()]);
  const pdf=(await readFile(await download.path())).toString('latin1');
  expect(pdf).toContain('REVIEW: Review mobile usability');
});

test('sample information PDF can be selected for a clearly simulated demo upload', async ({page})=>{
  let serviceCalls=0;page.on('request',req=>{if(req.url().includes('/api/documents'))serviceCalls++});
  await page.goto('/');
  await page.getByRole('button',{name:'Upload information'}).click();
  await expect(page.getByRole('link',{name:'Download sample company information'})).toHaveAttribute('href','/samples/bluebird-company-information.pdf');
  await page.locator('input[type=file]').first().setInputFiles('public/samples/bluebird-company-information.pdf');
  await expect(page.getByText('bluebird-company-information.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Analyze information'}).click();
  await expect(page.getByText('Sample document analysis: simulated results; selected files were not analyzed.')).toBeVisible();
  await expect(page.getByText('bluebird-company-information.pdf',{exact:false})).toBeVisible();
  expect(serviceCalls).toBe(0);
});

test('outreach starts with the latest proposal and removal applies across channels', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Proposal',exact:true}).click();
  await page.getByLabel('Indicative starting price (RM)').fill('2675');
  await page.getByRole('button',{name:'Continue to outreach'}).click();
  const composer=page.locator('.chat-composer-area');
  const attachment=composer.getByRole('link',{name:'bluebird-corner-cafe-proposal.pdf'});
  await expect(attachment).toBeVisible();
  const [download]=await Promise.all([page.waitForEvent('download'),attachment.click()]);
  expect((await readFile(await download.path())).toString('latin1')).toContain('RM 2675');
  await composer.getByRole('button',{name:'Remove proposal attachment'}).click();
  await page.getByLabel('Message',{exact:true}).fill('Message without a file');
  await page.getByRole('button',{name:'Preview send'}).click();
  await expect(page.locator('.bubble').filter({hasText:'Message without a file'}).locator('.message-attachment')).toHaveCount(0);
  await page.getByRole('button',{name:'Email',exact:true}).click();
  await expect(page.getByRole('button',{name:'Attach proposal'})).toBeVisible();
  await page.getByRole('button',{name:'Attach proposal'}).click();
  await expect(page.locator('.email-compose').getByRole('link',{name:'bluebird-corner-cafe-proposal.pdf'})).toBeVisible();
  await expect(page.locator('.app-brand')).not.toContainText('LOCAL OPPORTUNITIES, FOUND');
});


test('measured mobile evidence matches the demo page and is not reused for unrelated findings', async ({page,context})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Audit report'}).click();
  const row=page.locator('.finding-row').filter({hasText:'Review mobile usability'});
  await expect(row.getByText(/390 x 844 CSS pixels/)).toBeVisible();
  await expect(row.getByText(/heading is clipped/).first()).toBeVisible();
  const image=row.getByAltText('Screenshot context for Review mobile usability');
  await expect(image).toBeVisible();
  expect(await image.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight}))).toEqual({width:390,height:844});
  await expect(page.locator('.finding-row').filter({hasText:'Add a contact or booking path'}).getByRole('button',{name:/Expand screenshot/})).toHaveCount(0);
  const demo=await context.newPage();
  await demo.setViewportSize({width:390,height:844});
  await demo.goto('/demo/bluebird');
  const metrics=await demo.evaluate(()=>({viewport:document.documentElement.clientWidth,width:document.documentElement.scrollWidth,right:Math.ceil(document.querySelector('.bluebird-hero h1').getBoundingClientRect().right)}));
  expect(metrics.viewport).toBe(390);expect(metrics.width).toBeGreaterThan(metrics.viewport);expect(metrics.right).toBeGreaterThan(metrics.viewport);
  await demo.close();
  await page.getByRole('button',{name:'Build proposal'}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download bilingual PDF'}).click()]);
  const pdf=(await readFile(await download.path())).toString('latin1');
  expect(pdf).toContain('Mobile viewport: 390 x 844 CSS px');
  expect(pdf).toContain('heading is clipped');
  expect(pdf).toContain('Screenshot not supplied');
});

test('an interested reply unlocks a comparison only after a message with a proposal', async ({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Recent searches/})).toBeVisible();
  await expect(page.locator('.search-row').getByRole('button',{name:'Upload information'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Find businesses'})).toHaveCount(1);
  await page.getByRole('button',{name:'Outreach',exact:true}).click();
  const composer=page.locator('.chat-composer-area');
  await expect(composer.getByRole('link',{name:'bluebird-corner-cafe-proposal.pdf'})).toBeVisible();
  const [download]=await Promise.all([page.waitForEvent('download'),composer.getByRole('link',{name:'bluebird-corner-cafe-proposal.pdf'}).click()]);
  const pdf=(await readFile(await download.path())).toString('latin1');
  expect(pdf).not.toContain('Imagine what could improve');
  expect(pdf).not.toContain('02 / AFTER');
  await composer.getByRole('button',{name:'Remove proposal attachment'}).click();
  await page.getByLabel('Message',{exact:true}).fill('Hello, without a proposal');
  await page.getByRole('button',{name:'Preview send'}).click();
  await page.waitForTimeout(1100);
  await expect(page.getByText('Simulated customer reply')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Imagine what could improve.'})).toHaveCount(0);
  await composer.getByRole('button',{name:'Attach proposal'}).click();
  await expect(composer.getByRole('link',{name:'bluebird-corner-cafe-proposal.pdf'})).toBeVisible();
  await page.getByLabel('Message',{exact:true}).fill('Here is the proposal');
  await page.getByRole('button',{name:'Preview send'}).click();
  await expect(page.getByText('Simulated customer reply')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Imagine what could improve.'})).toBeVisible();
  await expect(page.getByAltText(/Current demo website on a mobile viewport/)).toBeVisible();
  await expect(page.getByAltText(/Proposed mobile concept with the full heading/)).toBeVisible();
  await expect(page.getByText('Both views: 390 × 844 CSS px')).toBeVisible();
  await page.getByRole('button',{name:'Discover',exact:true}).click();
  await page.locator('article.business-result').filter({hasText:'Luma Hair Studio'}).getByRole('button',{name:'Audit business'}).click();
  await page.getByRole('button',{name:'Outreach',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Imagine what could improve.'})).toHaveCount(0);
});

test('email preview receives a simulated interested reply after sending the attached proposal', async ({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Outreach',exact:true}).click();
  await page.getByRole('button',{name:'Email',exact:true}).click();
  await expect(page.locator('.email-compose').getByRole('link',{name:'bluebird-corner-cafe-proposal.pdf'})).toBeVisible();
  await page.getByRole('button',{name:'Preview send'}).click();
  await expect(page.locator('.email-reply').getByText('Simulated customer reply')).toBeVisible();
  await expect(page.getByRole('heading',{name:'Imagine what could improve.'})).toBeVisible();
});
