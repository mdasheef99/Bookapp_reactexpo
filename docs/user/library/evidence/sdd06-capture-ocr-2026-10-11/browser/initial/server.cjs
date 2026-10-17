const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..', '..');
const evidence = path.join(root, 'docs', 'user', 'library', 'evidence', 'sdd06-capture-ocr-2026-10-11');
const exportRoot = path.join(root, '.tmp', 'sdd06-capture-web');
const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
const expectedBuild = readJson(path.join(evidence, 'BUILD-MANIFEST.json'));
const bundleManifestPath = path.join(evidence, 'BUNDLE-SOURCE-MANIFEST.json');
const bundleManifest = readJson(bundleManifestPath);
const hash = data => crypto.createHash('sha256').update(data).digest('hex').toUpperCase();

if (path.resolve(expectedBuild.checkout) !== root) throw new Error('BUILD-MANIFEST checkout does not match fixture root');
if (expectedBuild.authBypass !== false || expectedBuild.temporaryNativeProofRouteRemoved !== true) throw new Error('Unsafe or stale build manifest');
if (hash(fs.readFileSync(bundleManifestPath)) !== expectedBuild.sourceManifestSha256) throw new Error('Bundle source-manifest hash mismatch');
if (bundleManifest.root !== root || bundleManifest.branch !== expectedBuild.branch || bundleManifest.head !== expectedBuild.head) throw new Error('Bundle manifest identity mismatch');
const gateway = fs.readFileSync(path.join(root, 'src', 'features', 'books', 'notes', 'manualNotesGateway.ts'), 'utf8');
for (const gate of ['ownedBookWrites', 'stableCreateReconciliation', 'optionalFiveCategories', 'serverManagedEditVersion']) {
  const line = gateway.split(/\r?\n/).find(value => value.includes(`${gate}:`));
  if (!line || !/:\s*false\b/.test(line)) throw new Error(`Write gate ${gate} is not visibly false`);
}

const build = async () => {
  const verification = await fetch('http://127.0.0.1:8084/__verification/build.json', { cache: 'no-store' });
  if (!verification.ok) throw new Error(`Parent server build route returned ${verification.status}`);
  const servedBuild = await verification.json();
  if (JSON.stringify(servedBuild) !== JSON.stringify(expectedBuild)) throw new Error('Served build manifest differs from checkout manifest');
  const htmlResponse = await fetch('http://127.0.0.1:8084/');
  if (!htmlResponse.ok) throw new Error(`Parent server index returned ${htmlResponse.status}`);
  const html = await htmlResponse.text();
  const entry = expectedBuild.bundles.find(bundle => bundle.path.includes('/entry-'));
  if (!entry || !html.includes('/' + entry.path.replaceAll('\\', '/').replace(/^\.tmp\/sdd06-capture-web\//, ''))) throw new Error('Served HTML does not reference the expected entry bundle');
  const entryPath = '/' + entry.path.replaceAll('\\', '/').replace(/^\.tmp\/sdd06-capture-web\//, '');
  const response = await fetch(`http://127.0.0.1:8084${entryPath}`);
  if (!response.ok) throw new Error(`Served entry bundle returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error('Served entry bundle bytes/hash differ from build manifest');
  const localBytes = fs.readFileSync(path.join(exportRoot, entry.path.replaceAll('/', path.sep).replace(/^\.tmp[\\/]sdd06-capture-web[\\/]/, '')));
  if (localBytes.length !== entry.bytes || hash(localBytes) !== entry.sha256) throw new Error('Local export entry bundle bytes/hash differ from build manifest');
  const identity = {
    fixture: 'Luna isolated web fixture; no production code changed',
    url: 'http://127.0.0.1:8085/login',
    parentServer: 'http://127.0.0.1:8084',
    pid: process.pid,
    checkout: root,
    branch: expectedBuild.branch,
    head: expectedBuild.head,
    servedIndexTitle: (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || null,
    servedEntryPath: entryPath,
    servedEntryBytes: bytes.length,
    servedEntrySha256: hash(bytes),
    sourceManifestSha256: hash(fs.readFileSync(bundleManifestPath)),
    authBypass: expectedBuild.authBypass,
    temporaryNativeProofRouteRemoved: expectedBuild.temporaryNativeProofRouteRemoved,
    gates: ['ownedBookWrites', 'stableCreateReconciliation', 'optionalFiveCategories', 'serverManagedEditVersion'].map(name => ({ name, value: false })),
    verification: 'Independent GET of parent build.json, served HTML and complete served entry bundle; bytes and SHA-256 match immutable build manifest.'
  };
  fs.writeFileSync(path.join(__dirname, 'fixture-identity.json'), JSON.stringify(identity, null, 2));
  return identity;
};

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf']
]);
const csp = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; form-action 'self'; base-uri 'self'";
const guardPath = path.join(__dirname, 'guard.js');
const guard = fs.readFileSync(guardPath);
let localRequests = 0;
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || '')) {
    res.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' }); return res.end();
  }
  const url = new URL(req.url || '/', 'http://127.0.0.1:8085');
  if (url.pathname === '/__qa/status.json') {
    const identity = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture-identity.json'), 'utf8'));
    const payload = Buffer.from(JSON.stringify({ ...identity, localRequestCount: localRequests, cspHeader: csp, guard: 'installed through a same-origin script before the production entry script' }));
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'content-length': payload.length, 'content-security-policy': csp });
    return req.method === 'HEAD' ? res.end() : res.end(payload);
  }
  if (url.pathname === '/__qa/guard.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store', 'content-length': guard.length, 'content-security-policy': csp });
    return req.method === 'HEAD' ? res.end() : res.end(guard);
  }
  localRequests += 1;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end(); }
  if (pathname.includes('\0') || pathname.split('/').includes('..')) { res.writeHead(400); return res.end(); }
  let relative = pathname.replace(/^\/+/, '');
  let filename = path.resolve(exportRoot, relative || 'index.html');
  if (!filename.startsWith(exportRoot + path.sep) && filename !== path.join(exportRoot, 'index.html')) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) filename = path.join(exportRoot, 'index.html');
  let body;
  try { body = fs.readFileSync(filename); } catch { res.writeHead(404); return res.end(); }
  if (path.basename(filename).toLowerCase() === 'index.html') {
    let html = body.toString('utf8');
    const injection = '<script src="/__qa/guard.js"></script>';
    if (!html.includes(injection)) html = html.replace(/<body[^>]*>/i, match => `${match}\n    ${injection}`);
    body = Buffer.from(html);
  }
  res.writeHead(200, { 'content-type': mime.get(path.extname(filename).toLowerCase()) || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': body.length, 'content-security-policy': csp, 'x-content-type-options': 'nosniff' });
  return req.method === 'HEAD' ? res.end() : res.end(body);
});

build().then(identity => {
  server.listen(8085, '127.0.0.1', () => {
    process.stdout.write(JSON.stringify({ ...identity, listening: '127.0.0.1:8085', isolatedFixtureOnly: true }) + '\n');
  });
}).catch(error => {
  process.stderr.write(`Fixture startup failed: ${error.message}\n`);
  process.exitCode = 1;
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
