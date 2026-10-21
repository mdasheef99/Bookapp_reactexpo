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
const port = 8086;

if (path.resolve(expectedBuild.checkout) !== root) throw new Error('BUILD-MANIFEST checkout does not match fixture root');
if (expectedBuild.authBypass !== false || expectedBuild.temporaryNativeProofRouteRemoved !== true) throw new Error('Unsafe or stale build manifest');
if (hash(fs.readFileSync(bundleManifestPath)) !== expectedBuild.sourceManifestSha256) throw new Error('Bundle source-manifest hash mismatch');
if (bundleManifest.root !== root || bundleManifest.branch !== expectedBuild.branch || bundleManifest.head !== expectedBuild.head) throw new Error('Bundle manifest identity mismatch');

const gateway = fs.readFileSync(path.join(root, 'src', 'features', 'books', 'notes', 'manualNotesGateway.ts'), 'utf8');
for (const gate of ['ownedBookWrites', 'stableCreateReconciliation', 'optionalFiveCategories', 'serverManagedEditVersion']) {
  const line = gateway.split(/\r?\n/).find(value => value.includes(`${gate}:`));
  if (!line || !/:\s*false\b/.test(line)) throw new Error(`Write gate ${gate} is not visibly false`);
}

const entry = expectedBuild.bundles.find(bundle => bundle.path.includes('/entry-'));
if (!entry) throw new Error('Expected web entry bundle is missing');
const entryRelative = entry.path.replaceAll('\\', '/').replace(/^\.tmp\/sdd06-capture-web\//, '');
const entryPath = '/' + entryRelative;
const localEntry = fs.readFileSync(path.join(exportRoot, entryRelative.replaceAll('/', path.sep)));
if (localEntry.length !== entry.bytes || hash(localEntry) !== entry.sha256) throw new Error('Local entry bytes/hash differ from BUILD-MANIFEST');

const marker = '\n},2137,[456,125,574,2136,1396,2101,1362,2098]);';
const fixturePatch = `
  // TEMP QA ONLY: adapter availability and recognizer result are synthetic; all composer/session/form/history/write code is the frozen build.
  const __qaBaseCreateCaptureAdapter = createCaptureAdapter;
  exports.onDeviceAvailability = function () {
    return { available: true, message: 'Isolated QA fixture: synthetic OCR result; browser OCR support is unavailable.' };
  };
  exports.createCaptureAdapter = function () {
    const adapter = __qaBaseCreateCaptureAdapter();
    let __qaRecognitionCalls = 0;
    adapter.recognize = async function (_uri, signal) {
      if (signal && signal.aborted) { const error = new Error('Recognition canceled.'); error.code = 'CANCELED'; throw error; }
      const configuredMode = window.__bookconnectQAFixtureNativeMode;
      const mode = configuredMode === 'sequence' ? (__qaRecognitionCalls++ === 0 ? 'partial' : 'complete') : configuredMode;
      if (window.__bookconnectQAFixture) window.__bookconnectQAFixture.record('synthetic-recognition', 'LOCAL', '/__qa/native-result/' + (mode || 'missing'));
      if (document.documentElement) document.documentElement.setAttribute('data-qa-native-result-calls', String(Number(document.documentElement.getAttribute('data-qa-native-result-calls') || '0') + 1));
      const partial = mode === 'partial';
      return { version: 1, provider: 'on-device', languageHint: 'en', reviewText: partial ? 'Partial synthetic OCR result for isolated browser QA.' : 'Complete synthetic OCR result for isolated browser QA.', reviewOverflow: partial };
    };
    return adapter;
  };
`;
const entryText = localEntry.toString('utf8');
if (entryText.split(marker).length !== 2) throw new Error('Native-result fixture marker not unique; refusing patch');
const variantBytes = Buffer.from(entryText.replace(marker, fixturePatch + marker));
const variantHash = hash(variantBytes);
const guardBase = fs.readFileSync(path.join(__dirname, 'guard.js'), 'utf8');
const guard = Buffer.from(`window.__bookconnectQAFixtureNativeMode = new URLSearchParams(window.location.search).get('__qa_native_result');\n${guardBase}`);

async function verifyParentBuild() {
  const verification = await fetch('http://127.0.0.1:8084/__verification/build.json', { cache: 'no-store' });
  if (!verification.ok) throw new Error(`Parent server build route returned ${verification.status}`);
  const servedBuild = await verification.json();
  if (JSON.stringify(servedBuild) !== JSON.stringify(expectedBuild)) throw new Error('Served build manifest differs from checkout manifest');
  const response = await fetch(`http://127.0.0.1:8084/${entryRelative}`);
  if (!response.ok) throw new Error(`Served entry returned ${response.status}`);
  const servedBytes = Buffer.from(await response.arrayBuffer());
  if (servedBytes.length !== entry.bytes || hash(servedBytes) !== entry.sha256) throw new Error('Parent served entry bytes/hash differ from build manifest');
}

const mime = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf']
]);
const csp = "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; frame-src 'none'; form-action 'self'; base-uri 'self'";
let localRequests = 0;
const identity = {
  fixture: 'Luna isolated synthetic native-result UI fixture; no product code changed',
  url: `http://127.0.0.1:${port}/login?__qa_native_result=partial`, parentServer: 'http://127.0.0.1:8084', pid: process.pid,
  checkout: root, branch: expectedBuild.branch, head: expectedBuild.head,
  servedEntryPath: entryPath, originalEntryBytes: localEntry.length, originalEntrySha256: hash(localEntry),
  transformedEntryBytes: variantBytes.length, transformedEntrySha256: variantHash,
  patchSha256: hash(Buffer.from(fixturePatch)), guardSha256: hash(guard),
  transformation: 'On-the-fly in memory, replacing only exported adapter availability and recognize result; real pick/rotate/transform/release remain frozen bundle functions. NoteCaptureSession, NoteForm, validation, history, and write gates are untouched.',
  modes: ['partial', 'complete', 'sequence (partial first, complete on replacement)'],
  authBypass: false, temporaryNativeProofRouteRemoved: true,
  gates: ['ownedBookWrites', 'stableCreateReconciliation', 'optionalFiveCategories', 'serverManagedEditVersion'].map(name => ({ name, value: false })),
  network: 'GET/HEAD-only local static server with CSP connect-src self; app-level guard is injected before production entry and rejects all unlisted or non-read-only external requests.'
};

const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method || '')) { res.writeHead(405, { allow: 'GET, HEAD', 'cache-control': 'no-store' }); return res.end(); }
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
  const mode = url.searchParams.get('__qa_native_result');
  if (mode && !['partial', 'complete', 'sequence'].includes(mode)) { res.writeHead(400, { 'cache-control': 'no-store' }); return res.end(); }
  if (url.pathname === '/__qa/status.json') {
    const payload = Buffer.from(JSON.stringify({ ...identity, localRequestCount: localRequests, cspHeader: csp, guard: 'mode setter and fail-closed guard execute through first same-origin script before production entry' }));
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
  const relative = pathname.replace(/^\/+/, '');
  let filename = path.resolve(exportRoot, relative || 'index.html');
  if (!filename.startsWith(exportRoot + path.sep) && filename !== path.join(exportRoot, 'index.html')) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(filename) || !fs.statSync(filename).isFile()) filename = path.join(exportRoot, 'index.html');
  let body;
  try { body = fs.readFileSync(filename); } catch { res.writeHead(404); return res.end(); }
  if (path.basename(filename).toLowerCase() === 'index.html') {
    let html = body.toString('utf8');
    const injection = '<script src="/__qa/guard.js"></script>';
    if (!html.includes(injection)) html = html.replace(/<body[^>]*>/i, match => `${match}\n    ${injection}`);
    const entryUrlLiteral = `"${entryPath}"`;
    if (!html.includes(entryUrlLiteral)) throw new Error('Index does not reference expected entry script');
    html = html.replace(entryUrlLiteral, `"${entryPath}${mode ? `?__qa_native_result=${mode}` : ''}"`);
    body = Buffer.from(html);
  } else if (pathname === entryPath && mode) {
    if (hash(body) !== entry.sha256) throw new Error('Static entry changed after fixture startup');
    body = variantBytes;
  }
  res.writeHead(200, { 'content-type': mime.get(path.extname(filename).toLowerCase()) || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': body.length, 'content-security-policy': csp, 'x-content-type-options': 'nosniff' });
  return req.method === 'HEAD' ? res.end() : res.end(body);
});

verifyParentBuild().then(() => {
  fs.writeFileSync(path.join(__dirname, 'native-result-fixture-manifest.json'), JSON.stringify(identity, null, 2));
  server.listen(port, '127.0.0.1', () => process.stdout.write(JSON.stringify({ ...identity, listening: `127.0.0.1:${port}` }) + '\n'));
}).catch(error => {
  process.stderr.write(`Native-result fixture startup failed: ${error.message}\n`);
  process.exitCode = 1;
});
process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
