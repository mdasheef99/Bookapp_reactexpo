const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');

const mediaToken = 'media-container-smoke-A7z.49_xYp-001-strong';
const visionToken = 'vision-container-smoke-B8y.50_zXp-002-strong';
const metadataToken = 'metadata-container-smoke-D0w.62_vUr-004-strong';
const serviceKey = 'service-container-smoke-C9x.51_wVq-003-strong';
const hash = (value) => createHash('sha256').update(value).digest('hex');

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    stdio: options.capture === false ? 'inherit' : 'pipe',
  });
  if (result.error?.code === 'ENOENT') throw new Error('P9_DOCKER_UNAVAILABLE');
  if (result.status !== 0) throw new Error('P9_DOCKER_COMMAND_FAILED');
  return result.stdout?.trim() ?? '';
}

async function waitForHttp(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status === 200) return;
    } catch {
      // The container is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('P9_CONTAINER_SMOKE_TIMEOUT');
}

function publishedPort(name, containerPort) {
  const output = docker(['port', name, `${containerPort}/tcp`]);
  const match = output.match(/127\.0\.0\.1:(\d+)/u);
  if (!match) throw new Error('P9_CONTAINER_SMOKE_PORT_FAILED');
  return Number(match[1]);
}

async function smokeContainer(specification, root) {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const image = `bookconnect-phase9-${specification.service}:${suffix}`;
  const container = `bookconnect-phase9-${specification.service}-${suffix}`;
  docker([
    'build',
    '--file', specification.dockerfile,
    '--tag', image,
    '.',
  ], { cwd: root, capture: false });
  try {
    docker([
      'run', '--detach', '--rm',
      '--name', container,
      '--publish', `127.0.0.1::${specification.port}`,
      ...Object.entries(specification.environment).flatMap(
        ([name, value]) => ['--env', `${name}=${value}`],
      ),
      image,
    ]);
    try {
      const hostPort = publishedPort(container, specification.port);
      const baseUrl = `http://127.0.0.1:${hostPort}`;
      await waitForHttp(`${baseUrl}/health`);
      const ready = await fetch(`${baseUrl}/ready`);
      const denied = await fetch(`${baseUrl}/run`, { method: 'POST', body: '{}' });
      if (ready.status !== 200 || denied.status !== 403) {
        throw new Error('P9_CONTAINER_SMOKE_HTTP_FAILED');
      }
      if (specification.service === 'media') {
        docker(['exec', container, 'test', '-s', '/app/runtime/magick.wasm']);
      }
    } finally {
      spawnSync('docker', ['stop', '--time', '10', container], { stdio: 'ignore' });
    }
  } finally {
    spawnSync('docker', ['image', 'rm', '--force', image], { stdio: 'ignore' });
  }
}

async function smokePhase9WorkerContainers(root = process.cwd()) {
  docker(['version']);
  const shared = {
    SUPABASE_URL: 'https://ahntbtktjjmvfosgkmgn.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
    PHASE9_WORKER_HOST: '0.0.0.0',
    PHASE9_WORKER_CONCURRENCY: '1',
  };
  await smokeContainer({
    service: 'media',
    dockerfile: 'workers/phase9-media-validation-worker/Dockerfile',
    port: 8091,
    environment: {
      ...shared,
      PHASE9_WORKER_PORT: '8091',
      PHASE9_MEDIA_WORKER_ID: 'media-container-000000001',
      PHASE9_MEDIA_WORKER_INGRESS_TOKEN: mediaToken,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: hash(visionToken),
    },
  }, root);
  await smokeContainer({
    service: 'vision',
    dockerfile: 'workers/phase9-vision-analysis-worker/Dockerfile',
    port: 8092,
    environment: {
      ...shared,
      PHASE9_WORKER_PORT: '8092',
      PHASE9_VISION_WORKER_ID: 'vision-container-00000001',
      PHASE9_VISION_WORKER_INGRESS_TOKEN: visionToken,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: hash(mediaToken),
      PHASE9_VISION_FIXTURE_CASE: 'one_book',
    },
  }, root);
  await smokeContainer({
    service: 'metadata',
    dockerfile: 'workers/phase9-metadata-worker/Dockerfile',
    port: 8093,
    environment: {
      ...shared,
      PHASE9_WORKER_PORT: '8093',
      PHASE9_METADATA_WORKER_ID: 'metadata-container-000001',
      PHASE9_METADATA_WORKER_INGRESS_TOKEN: metadataToken,
      PHASE9_METADATA_PROVIDER_MODE: 'fixture',
    },
  }, root);
}

if (require.main === module) {
  void smokePhase9WorkerContainers().then(
    () => process.stdout.write('Phase 9 worker container smoke passed.\n'),
    (error) => {
      const code = error instanceof Error && error.message === 'P9_DOCKER_UNAVAILABLE'
        ? error.message : 'P9_CONTAINER_SMOKE_FAILED';
      process.stderr.write(`${code}\n`);
      process.exitCode = 1;
    },
  );
}

module.exports = { smokePhase9WorkerContainers };
