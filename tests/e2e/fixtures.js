export const prospect = {
  id: 'fixture-cafe', name: 'Fixture Cafe', category: 'cafe',
  location: 'Bangsar, Kuala Lumpur', url: 'https://fixture.example', source: 'OpenStreetMap',
};
export const website = { url: prospect.url, status: 200, https: true, viewport: true, whatsapp: false, booking: false };
export const googlePlace = {
  id: 'fixture-place', displayName: { text: 'Fixture Cafe Bangsar' },
  formattedAddress: 'Jalan Telawi, Bangsar', websiteUri: prospect.url,
  nationalPhoneNumber: '0123456789', regularOpeningHours: { openNow: true },
  googleMapsUri: 'https://maps.google.com/',
};

export async function mockServices(page) {
  await page.route('**/api/discover**', route => route.fulfill({ json: { results: [prospect] } }));
  await page.route('**/api/audit', route => route.fulfill({ json: website }));
  await page.route('**/api/google', route => route.fulfill({ json: { places: [googlePlace] } }));
}

export async function seedSavedProspect(page) {
  await page.addInitScript(({ prospect, website }) => {
    // Seed once per isolated test context, not again after a reload.
    if (!sessionStorage.getItem('localpulse-test-seeded')) {
      localStorage.setItem('localpulse-prospects-v1', JSON.stringify([{ ...prospect, audit: website }]));
      sessionStorage.setItem('localpulse-test-seeded', 'yes');
    }
  }, { prospect, website });
}
