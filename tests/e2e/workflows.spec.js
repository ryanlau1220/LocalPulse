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

  await page.getByRole('button', { name: 'Build proposal' }).click();
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
