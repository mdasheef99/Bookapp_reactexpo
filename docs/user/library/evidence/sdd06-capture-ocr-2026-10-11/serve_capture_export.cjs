// Local verification server only. No proxy, mutation, production bypass or publication.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../../../..');
const output = path.join(root, '.tmp/sdd06-capture-web');
const port = Number(process.argv[2] || 8084);
if (!Number.isInteger(port) || port < 8083 || port > 65535) throw new Error('Use a Library verification port >=8083');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname); } catch { res.writeHead(400); res.end(); return; }
  if (pathname === '/__verification/build.json') {
    const manifest = fs.readFileSync(path.join(__dirname, 'BUILD-MANIFEST.json'));
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(req.method === 'HEAD' ? undefined : manifest); return;
  }
  let file = path.resolve(output, '.' + pathname);
  if (!file.startsWith(output + path.sep) && file !== output) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    if (path.extname(pathname)) { res.writeHead(404); res.end(); return; }
    file = path.join(output, 'index.html');
  }
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => console.log(JSON.stringify({ url: `http://localhost:${port}`, pid: process.pid, root, output, kind: 'session-owned-static-verification' })));
