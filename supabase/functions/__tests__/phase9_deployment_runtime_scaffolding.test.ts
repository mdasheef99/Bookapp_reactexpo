import { createHash } from 'node:crypto';
import { Socket } from 'node:net';
import {
  loadMediaWorkerEnvironment,
  loadVisionWorkerEnvironment,
} from '../../../workers/phase9-runtime/environment';
import {
  createPhase9WorkerHttpService,
  SafeOperationalEvent,
} from '../../../workers/phase9-runtime/httpService';
import {
  invokePhase9Worker,
  summarizeWorkerResponse,
} from '../../../scripts/invoke-phase9-worker';
import {
  validateContainerSmokeWorkflow,
  validatePhase9DeploymentRuntime,
} from '../../../scripts/validate-phase9-deployment-runtime';

const mediaToken = 'media-worker-ingress-A7z.49_xYp-001-strong';
const visionToken = 'vision-worker-ingress-B8y.50_zXp-002-strong';
const serviceKey = 'service-role-secret-C9x.51_wVq-003-strong';
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const authorization = { authorization: `Bearer ${mediaToken}` };

async function stalledRequest(
  port: number,
  extraHeaders = '',
): Promise<{ socket: Socket; response: Promise<string> }> {
  const socket = new Socket();
  const response = new Promise<string>((resolve) => {
    let received = '';
    socket.on('data', (chunk) => { received += chunk.toString('utf8'); });
    socket.on('close', () => resolve(received));
  });
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.connect(port, '127.0.0.1', () => {
      socket.off('error', reject);
      socket.write(
        `POST /run HTTP/1.1\r\nHost: localhost\r\n${extraHeaders}`
        + 'Transfer-Encoding: chunked\r\n\r\n5\r\n{',
      );
      resolve();
    });
  });
  return { socket, response };
}

const shared = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: serviceKey,
};

describe('Phase 9 deployment runtime environment', () => {
  it('loads an exact media-worker allowlist and rejects missing, unknown, weak, or equal secrets', () => {
    const valid = {
      ...shared,
      PHASE9_MEDIA_WORKER_ID: 'media-worker-0000000001',
      PHASE9_MEDIA_WORKER_INGRESS_TOKEN: mediaToken,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: sha256(visionToken),
      PHASE9_WORKER_HOST: '0.0.0.0',
      PHASE9_WORKER_PORT: '8091',
      PHASE9_WORKER_CONCURRENCY: '1',
      PHASE9_MEDIA_WORKER_MAGICK_WASM_PATH: '/app/runtime/magick.wasm',
    };
    expect(loadMediaWorkerEnvironment(valid)).toMatchObject({
      host: '0.0.0.0',
      port: 8091,
      concurrency: 1,
      workerId: 'media-worker-0000000001',
    });
    expect(() => loadMediaWorkerEnvironment({ ...valid, PHASE9_WORKER_PORT: '' }))
      .toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMediaWorkerEnvironment({ ...valid, PHASE9_UNEXPECTED_SECRET: 'x' }))
      .toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMediaWorkerEnvironment({
      ...valid,
      SUPABASE_SERVICE_ROLE_KEY: 'weak',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMediaWorkerEnvironment({
      ...valid,
      PHASE9_MEDIA_WORKER_INGRESS_TOKEN: 'weak',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMediaWorkerEnvironment({
      ...valid,
      PHASE9_MEDIA_WORKER_INGRESS_TOKEN: serviceKey,
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadMediaWorkerEnvironment({
      ...valid,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: sha256(mediaToken),
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('loads the fixture worker with one allowlisted case and fixed initial concurrency', () => {
    const valid = {
      ...shared,
      PHASE9_VISION_WORKER_ID: 'vision-worker-000000001',
      PHASE9_VISION_WORKER_INGRESS_TOKEN: visionToken,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: sha256(mediaToken),
      PHASE9_WORKER_HOST: '127.0.0.1',
      PHASE9_WORKER_PORT: '8092',
      PHASE9_WORKER_CONCURRENCY: '1',
      PHASE9_VISION_FIXTURE_CASE: 'one_book',
    };
    expect(loadVisionWorkerEnvironment(valid)).toMatchObject({
      analyzerMode: 'fixture', fixtureCase: 'one_book',
    });
    expect(() => loadVisionWorkerEnvironment({
      ...valid,
      PHASE9_VISION_FIXTURE_CASE: 'tenant/path',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadVisionWorkerEnvironment({
      ...valid,
      PHASE9_WORKER_CONCURRENCY: '2',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });

  it('requires bounded Gemini configuration only when the primary adapter is selected', () => {
    const valid = {
      ...shared,
      PHASE9_VISION_WORKER_ID: 'vision-worker-000000001',
      PHASE9_VISION_WORKER_INGRESS_TOKEN: visionToken,
      PHASE9_PEER_WORKER_INGRESS_TOKEN_SHA256: sha256(mediaToken),
      PHASE9_WORKER_HOST: '127.0.0.1',
      PHASE9_WORKER_PORT: '8092',
      PHASE9_WORKER_CONCURRENCY: '1',
      PHASE9_VISION_ANALYZER_MODE: 'gemini',
      PHASE9_GEMINI_API_KEY: 'gemini-api-key-C9x.51_wVq-003-strong',
      PHASE9_GEMINI_MODEL_ID: 'gemini-3.5-flash-lite',
      PHASE9_GEMINI_TIMEOUT_MS: '30000',
    };
    expect(loadVisionWorkerEnvironment(valid)).toMatchObject({
      analyzerMode: 'gemini',
      modelId: 'gemini-3.5-flash-lite',
      timeoutMs: 30_000,
    });
    expect(() => loadVisionWorkerEnvironment({
      ...valid, PHASE9_GEMINI_API_KEY: '',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadVisionWorkerEnvironment({
      ...valid, PHASE9_GEMINI_MODEL_ID: '../private',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadVisionWorkerEnvironment({
      ...valid, PHASE9_GEMINI_TIMEOUT_MS: '0',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
    expect(() => loadVisionWorkerEnvironment({
      ...valid, PHASE9_VISION_FALLBACK_MODEL_ID: 'backup-model',
    })).toThrow('P9_WORKER_CONFIGURATION_INVALID');
  });
});

describe('Phase 9 worker HTTP service', () => {
  const started: Array<ReturnType<typeof createPhase9WorkerHttpService>> = [];
  afterEach(async () => {
    await Promise.all(started.splice(0).map((service) => service.stop()));
  });

  it('serves non-mutating health/readiness and never invokes the worker', async () => {
    const handler = jest.fn();
    const readiness = jest.fn(() => true);
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-test-worker',
      host: '127.0.0.1',
      port: 0,
      concurrency: 1,
      workerAuthToken: mediaToken,
      handler,
      readiness,
    });
    started.push(service);
    const address = await service.start();
    await expect(fetch(`${address.url}/health`).then((r) => r.json()))
      .resolves.toEqual({ status: 'alive' });
    await expect(fetch(`${address.url}/ready`).then((r) => r.json()))
      .resolves.toEqual({ status: 'ready' });
    expect(handler).not.toHaveBeenCalled();
    expect(readiness).toHaveBeenCalledTimes(1);
  });

  it('rejects a second processing request and bounds request bodies', async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const handler = jest.fn(async () => {
      await blocked;
      return new Response(JSON.stringify({ claimed: 0, results: [] }), {
        headers: { 'content-type': 'application/json' },
      });
    });
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-test-worker',
      host: '127.0.0.1',
      port: 0,
      concurrency: 1,
      workerAuthToken: mediaToken,
      handler,
      readiness: () => true,
      maxBodyBytes: 256,
    });
    started.push(service);
    const address = await service.start();
    const first = fetch(`${address.url}/run`, {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect((await fetch(`${address.url}/run`, {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    })).status).toBe(409);
    expect((await fetch(`${address.url}/run`, {
      method: 'POST',
      headers: authorization,
      body: 'x'.repeat(257),
    })).status).toBe(413);
    release();
    expect((await first).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('waits for an active request during graceful shutdown', async () => {
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });
    const handlerEntered = new Promise<void>((resolve) => { entered = resolve; });
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-test-worker',
      host: '127.0.0.1',
      port: 0,
      concurrency: 1,
      workerAuthToken: mediaToken,
      handler: async () => {
        entered();
        await blocked;
        return new Response('{}');
      },
      readiness: () => true,
    });
    started.push(service);
    const address = await service.start();
    const request = fetch(`${address.url}/run`, {
      method: 'POST',
      headers: authorization,
      body: '{}',
    });
    await handlerEntered;
    let stopped = false;
    const stopping = service.stop().then(() => { stopped = true; });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(stopped).toBe(false);
    release();
    await request;
    await stopping;
    expect(stopped).toBe(true);
  });

  it('rejects a stalled unauthenticated body before it occupies the processing slot', async () => {
    const handler = jest.fn(async () => new Response('{}'));
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-test-worker',
      host: '127.0.0.1',
      port: 0,
      concurrency: 1,
      workerAuthToken: mediaToken,
      handler,
      readiness: () => true,
      bodyReadTimeoutMs: 100,
      log: () => {},
    });
    started.push(service);
    const address = await service.start();
    const stalled = await stalledRequest(address.port);
    await expect(fetch(`${address.url}/run`, {
      method: 'POST',
      headers: authorization,
      body: '{}',
    })).resolves.toMatchObject({ status: 200 });
    stalled.socket.end();
    await expect(stalled.response).resolves.toContain('403');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('terminates an authenticated stalled body at the read deadline', async () => {
    const handler = jest.fn();
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-test-worker',
      host: '127.0.0.1',
      port: 0,
      concurrency: 1,
      workerAuthToken: mediaToken,
      handler,
      readiness: () => true,
      bodyReadTimeoutMs: 100,
      log: () => {},
    });
    started.push(service);
    const address = await service.start();
    const stalled = await stalledRequest(
      address.port,
      `Authorization: Bearer ${mediaToken}\r\n`,
    );
    await expect(stalled.response).resolves.toContain('408');
    expect(handler).not.toHaveBeenCalled();
  });

  it('logs only allowlisted operational fields', async () => {
    const events: SafeOperationalEvent[] = [];
    const service = createPhase9WorkerHttpService({
      serviceName: 'phase9-test-worker',
      host: '127.0.0.1',
      port: 0,
      concurrency: 1,
      workerAuthToken: mediaToken,
      handler: async () => new Response(JSON.stringify({
        claimed: 1,
        results: [{
          jobId: 'private-job-id',
          outcome: 'retry_scheduled',
          title: 'Private Fixture Clue',
          storagePath: 'store/private/path.webp',
          token: mediaToken,
        }],
      }), { headers: { 'content-type': 'application/json' } }),
      readiness: () => true,
      log: (event) => events.push(event),
    });
    started.push(service);
    const address = await service.start();
    await fetch(`${address.url}/run`, {
      method: 'POST',
      headers: authorization,
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
    });
    const serialized = JSON.stringify(events);
    expect(serialized).toContain('retry_scheduled');
    expect(serialized).not.toMatch(/private-job-id|Private Fixture Clue|private\/path|token|A7z/);
  });
});

describe('Phase 9 manual invocation and deployment validation', () => {
  it('times out explicitly and prints only bounded summaries', async () => {
    await expect(invokePhase9Worker({
      service: 'media',
      url: 'https://worker.invalid',
      token: mediaToken,
      batchSize: 1,
      timeoutMs: 100,
      fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('private timeout detail')));
      }),
    })).rejects.toThrow('P9_WORKER_INVOCATION_TIMEOUT');

    expect(summarizeWorkerResponse('vision', 200, {
      claimed: 1,
      results: [{
        jobId: 'private-job',
        outcome: 'resolved',
        storagePath: 'private/path',
        title: 'Private Clue',
      }],
    })).toEqual({
      service: 'vision',
      status: 200,
      claimed: 1,
      outcomes: ['resolved'],
    });
  });

  it('rejects an oversized worker response without exposing its body', async () => {
    await expect(invokePhase9Worker({
      service: 'vision',
      url: 'https://worker.invalid',
      token: visionToken,
      fetchImpl: async () => new Response(JSON.stringify({
        privateEvidence: 'private/path/'.repeat(2_000),
      })),
      maxResponseBytes: 256,
    })).rejects.toThrow('P9_WORKER_INVOCATION_RESPONSE_TOO_LARGE');
  });

  it('validates checked-in start commands, packaging, and Owner JWT configuration', () => {
    expect(validatePhase9DeploymentRuntime()).toEqual({ valid: true, errors: [] });
  });

  it.each([
    ['LF', 'permissions:\n  contents: read\n- run: npm run smoke:phase9:worker-containers\n'],
    ['CRLF', 'permissions:\r\n  contents: read\r\n- run: npm run smoke:phase9:worker-containers\r\n'],
  ])('validates the container workflow with %s line endings', (_label, workflow) => {
    expect(validateContainerSmokeWorkflow(workflow)).toBe(true);
  });
});
