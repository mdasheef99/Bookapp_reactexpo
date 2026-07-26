const { createHash } = require('node:crypto');
const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const mediaToken = 'media-entrypoint-smoke-A7z.49_xYp-001-strong';
const visionToken = 'vision-entrypoint-smoke-B8y.50_zXp-002-strong';
const serviceKey = 'service-entrypoint-smoke-C9x.51_wVq-003-strong';
const hash = (value) => createHash('sha256').update(value).digest('hex');

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close(
    (error) => (error ? reject(error) : resolve()),
  ));
  if (!port) throw new Error('P9_ENTRYPOINT_SMOKE_PORT_FAILED');
  return port;
}

function cleanEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(
    ([name]) => !name.startsWith('PHASE9_') && !name.startsWith('SUPABASE_'),
  ));
}

function waitForStarted(child, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('P9_ENTRYPOINT_SMOKE_TIMEOUT')), timeoutMs);
    const finish = (callback) => {
      clearTimeout(timer);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
      callback();
    };
    const onStdout = (chunk) => {
      stdout += chunk.toString('utf8');
      if (stdout.includes('"event":"service_started"')) finish(resolve);
    };
    const onStderr = (chunk) => { stderr += chunk.toString('utf8'); };
    const onExit = () => finish(() => reject(new Error(
      stderr.includes('startup_failed')
        ? 'P9_ENTRYPOINT_SMOKE_START_FAILED'
        : 'P9_ENTRYPOINT_SMOKE_EXITED',
    )));
    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.once('exit', onExit);
  });
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('P9_ENTRYPOINT_SMOKE_STOP_TIMEOUT')),
      10_000,
    );
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function smokeEntrypoint(root, specification) {
  const port = await availablePort();
  const child = spawn(process.execPath, [path.join(root, specification.entrypoint)], {
    cwd: root,
    env: {
      ...cleanEnvironment(),
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: hash(specification.peerToken),
      PHASE9_WORKER_HOST: '127.0.0.1',
      PHASE9_WORKER_PORT: String(port),
      PHASE9_WORKER_CONCURRENCY: '1',
      ...specification.environment,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await waitForStarted(child);
    const baseUrl = `http://127.0.0.1:${port}`;
    const health = await fetch(`${baseUrl}/health`);
    const ready = await fetch(`${baseUrl}/ready`);
    const denied = await fetch(`${baseUrl}/run`, { method: 'POST', body: '{}' });
    if (health.status !== 200 || ready.status !== 200 || denied.status !== 403) {
      throw new Error('P9_ENTRYPOINT_SMOKE_HTTP_FAILED');
    }
  } finally {
    await stopChild(child);
  }
}

async function smokePhase9WorkerEntrypoints(root = process.cwd()) {
  await smokeEntrypoint(root, {
    entrypoint: '.phase9-dist/workers/phase9-media-validation-worker/server.js',
    peerToken: visionToken,
    environment: {
      PHASE9_MEDIA_WORKER_ID: 'media-entrypoint-00000001',
      PHASE9_MEDIA_WORKER_INGRESS_TOKEN: mediaToken,
      PHASE9_MEDIA_WORKER_MAGICK_WASM_PATH: path.join(
        root,
        'node_modules/@imagemagick/magick-wasm/dist/magick.wasm',
      ),
    },
  });
  await smokeEntrypoint(root, {
    entrypoint: '.phase9-dist/workers/phase9-vision-analysis-worker/server.js',
    peerToken: mediaToken,
    environment: {
      PHASE9_VISION_WORKER_ID: 'vision-entrypoint-0000001',
      PHASE9_VISION_WORKER_INGRESS_TOKEN: visionToken,
      PHASE9_VISION_FIXTURE_CASE: 'one_book',
    },
  });
}

if (require.main === module) {
  void smokePhase9WorkerEntrypoints().then(
    () => process.stdout.write('Phase 9 worker entrypoint smoke passed.\n'),
    () => {
      process.stderr.write('Phase 9 worker entrypoint smoke failed.\n');
      process.exitCode = 1;
    },
  );
}

module.exports = { smokePhase9WorkerEntrypoints };
