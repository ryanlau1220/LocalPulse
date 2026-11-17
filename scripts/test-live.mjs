// Opt-in checks against the running app and real providers. Google is only
// called when --google is explicitly supplied, because it consumes quota.
const base = process.env.LOCALPULSE_URL || 'http://localhost:3001';
async function check(path, options = {}) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30_000), ...options });
  let result;
  try { result = await response.json(); } catch { throw new Error(`${path} did not return JSON`); }
  if (!response.ok) throw new Error(`${path}: ${result.error || `HTTP ${response.status}`}`);
  return result;
}
try {
  const discovery = await check('/api/discover?q=Alexis');
  if (!Array.isArray(discovery.results) || !discovery.results.length) throw new Error('Discovery returned no Alexis results; map data may have changed.');
  console.log(`PASS: live OpenStreetMap discovery returned ${discovery.results.length} matching listing(s)`);
  const audit = await check('/api/audit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'https://example.com' }) });
  if (audit.status !== 200 || !audit.https || !audit.viewport) throw new Error('Website check returned unexpected results for example.com.');
  console.log('PASS: live website audit');
  if (process.argv.includes('--google')) {
    const google = await check('/api/google', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Alexis Bistro' }) });
    if (!Array.isArray(google.places) || !google.places.length) throw new Error('Google returned no matching places.');
    console.log(`PASS: Google lookup returned ${google.places.length} candidate(s) (one request used)`);
  } else {
    console.log('SKIP: Google lookup (add --google to use one request)');
  }
} catch (error) {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
}
