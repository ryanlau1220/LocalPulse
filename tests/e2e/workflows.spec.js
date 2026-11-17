import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mockServices, seedSavedProspect } from './fixtures.js';

test.beforeEach(async ({ page }) => {
  await mockServices(page);
});

test('discover, audit, select Google listing, make proposal and preview outreach', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
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

  await page.reload();
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
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await expect(page.getByRole('heading', { name: 'Fixture Cafe', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View report' }).click();
  await expect(page.getByText('Viewport tag found')).toBeVisible();
  await page.getByRole('button', { name: 'Saved prospects' }).click();
  await page.getByRole('button', { name: 'Remove Fixture Cafe' }).click();
  await expect(page.getByText('No saved prospects yet.')).toBeVisible();
  await page.reload();
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
  await page.getByRole('button', { name: 'Demo mode' }).click();
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await page.getByRole('button', { name: 'Audit report' }).click();
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await expect(page.getByText('This café, website and audit results are fictional.')).toBeVisible();
  await expect(page.getByText('Review mobile usability')).toBeVisible();
  await expect(page.getByText('Add a contact or booking path')).toBeVisible();
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
  await page.getByRole('button', { name: 'Demo mode' }).click();
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
  await page.getByRole('button', { name:'Demo mode' }).click();
  await expect(page.getByLabel('Business name, optional')).toHaveValue('Bluebird Corner Cafe');
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
  await expect(page.getByText('Review mobile usability')).toBeVisible();
  expect(calls).toEqual([]);
});

test('company information upload creates a document assessment', async ({ page }) => {
  let uploadBody = '';
  await page.route('**/api/documents', async route => {
    uploadBody = route.request().postDataBuffer()?.toString('utf8') || '';
    await route.fulfill({ json: { businessName:'Harbour Fixture Cafe', category:'Cafe', location:'Bangsar', summary:'A neighbourhood cafe.', fileNames:['company.txt'], cached:true, opportunities:[{title:'Add a menu',ms:'Tambah menu',detail:'Share the menu online.',msDetail:'Kongsi menu dalam talian.',priority:'High',effort:'2 hours'}] } });
  });
  await page.goto('/');
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
  await page.getByRole('button', { name:'Demo mode' }).click();
  await page.getByRole('button', { name:'Upload information' }).click();
  await expect(page.getByLabel('Company information', { exact:false })).toHaveValue(/Bluebird Corner Cafe/);
  await page.getByRole('button', { name:'Analyze information' }).click();
  await expect(page.getByText('SIMULATED ANALYSIS')).toBeVisible();
  await expect(page.getByText('Make the menu easy to find')).toBeVisible();
  expect(calls).toBe(0);
});

test('guided steps stack and remain available for going back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Audit report', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Demo mode' }).click();
  await page.getByRole('button', { name: 'Audit report', exact: true }).click();
  await expect(page.locator('.history-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await page.getByRole('button', { name: 'Build proposal' }).click();
  await expect(page.locator('.history-card')).toHaveCount(2);
  await page.locator('.history-card').filter({ hasText: 'Audit report' }).click();
  await expect(page.getByRole('heading', { name: 'Bluebird Corner Cafe' })).toBeVisible();
  await expect(page.locator('.history-card')).toHaveCount(1);
});
