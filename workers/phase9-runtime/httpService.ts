import { createServer, IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from 'node:http';
import { readBoundedBody, validWorkerCredential } from './requestSecurity';

export type SafeOperationalEvent = Readonly<{
  event: 'service_started' | 'service_stopping' | 'service_stopped'
    | 'readiness_result' | 'invocation_accepted' | 'invocation_denied'
    | 'invocation_completed';
  service: string;
  status?: number | 'ready' | 'not_ready';
  batchSize?: number;
  claimed?: number;
  outcomes?: readonly string[];
  durationMs?: number;
  category?: 'unauthorized' | 'busy' | 'body_too_large' | 'body_read_timeout'
    | 'invalid_route';
}>;

export type SafeLog = (event: SafeOperationalEvent) => void;

export type WorkerHttpServiceOptions = Readonly<{
  serviceName: string;
  host: string;
  port: number;
  concurrency: 1;
  workerAuthToken: string;
  handler: (request: Request) => Promise<Response>;
  readiness: () => boolean | Promise<boolean>;
  log?: SafeLog;
  maxBodyBytes?: number;
  bodyReadTimeoutMs?: number;
}>;

export type StartedWorkerAddress = Readonly<{
  host: string;
  port: number;
  url: string;
}>;

const jsonHeaders = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
  pragma: 'no-cache',
};
const safeOutcome = /^[a-z][a-z0-9_]{0,63}$/u;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, jsonHeaders);
  response.end(JSON.stringify(body));
}

function requestHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) value.forEach((item) => result.append(name, item));
    else if (value !== undefined) result.set(name, value);
  }
  return result;
}

function requestBatchSize(body: Uint8Array): number | undefined {
  try {
    const value = JSON.parse(new TextDecoder().decode(body));
    return Number.isInteger(value?.batchSize) && value.batchSize >= 1 && value.batchSize <= 10
      ? value.batchSize : undefined;
  } catch {
    return undefined;
  }
}

async function responseSummary(response: Response): Promise<{
  claimed?: number;
  outcomes?: readonly string[];
}> {
  try {
    const value = await response.clone().json();
    const claimed = Number.isInteger(value?.claimed) && value.claimed >= 0 && value.claimed <= 10
      ? value.claimed : undefined;
    const outcomes = Array.isArray(value?.results)
      ? value.results.map((entry: unknown) => (
        typeof entry === 'object' && entry !== null && 'outcome' in entry
          ? (entry as { outcome?: unknown }).outcome : undefined
      )).filter((entry: unknown): entry is string => (
        typeof entry === 'string' && safeOutcome.test(entry)
      )).slice(0, 10)
      : undefined;
    return { claimed, outcomes };
  } catch {
    return {};
  }
}

async function relay(webResponse: Response, nodeResponse: ServerResponse): Promise<void> {
  const headers: Record<string, string> = {};
  webResponse.headers.forEach((value, name) => { headers[name] = value; });
  nodeResponse.writeHead(webResponse.status, headers);
  nodeResponse.end(new Uint8Array(await webResponse.arrayBuffer()));
}

export function createJsonOperationalLogger<TEvent extends object = SafeOperationalEvent>(
  write: (line: string) => void = (line) => console.log(line),
): (event: TEvent) => void {
  return (event) => write(JSON.stringify(event));
}

export function createPhase9WorkerHttpService(
  options: WorkerHttpServiceOptions,
) {
  if (options.concurrency !== 1) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
  if (!options.workerAuthToken) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
  const log = options.log ?? createJsonOperationalLogger();
  const maxBodyBytes = options.maxBodyBytes ?? 16_384;
  const bodyReadTimeoutMs = options.bodyReadTimeoutMs ?? 10_000;
  if (!Number.isInteger(maxBodyBytes) || maxBodyBytes < 1
    || !Number.isInteger(bodyReadTimeoutMs) || bodyReadTimeoutMs < 100
    || bodyReadTimeoutMs > 60_000) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
  let server: Server | undefined;
  let active = 0;
  let stopping = false;
  let stopPromise: Promise<void> | undefined;

  const listener = async (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://worker.local');

    if (request.method === 'GET' && url.pathname === '/health') {
      sendJson(response, 200, { status: 'alive' });
      return;
    }
    if (request.method === 'GET' && url.pathname === '/ready') {
      const ready = !stopping
        && await Promise.resolve().then(options.readiness).catch(() => false);
      log({
        event: 'readiness_result',
        service: options.serviceName,
        status: ready ? 'ready' : 'not_ready',
      });
      sendJson(response, ready ? 200 : 503, { status: ready ? 'ready' : 'not_ready' });
      return;
    }
    if (request.method !== 'POST' || url.pathname !== '/run') {
      log({
        event: 'invocation_denied',
        service: options.serviceName,
        status: 404,
        category: 'invalid_route',
      });
      sendJson(response, 404, { error: 'not_found' });
      return;
    }
    if (!validWorkerCredential(request.headers, options.workerAuthToken)) {
      log({
        event: 'invocation_denied',
        service: options.serviceName,
        status: 403,
        category: 'unauthorized',
      });
      sendJson(response, 403, { error: 'forbidden' });
      return;
    }

    const declared = Number(request.headers['content-length'] ?? 0);
    if (Number.isFinite(declared) && declared > maxBodyBytes) {
      log({
        event: 'invocation_denied',
        service: options.serviceName,
        status: 413,
        category: 'body_too_large',
      });
      sendJson(response, 413, { error: 'request_body_too_large' });
      return;
    }
    if (stopping || active >= options.concurrency) {
      log({
        event: 'invocation_denied',
        service: options.serviceName,
        status: 409,
        category: 'busy',
      });
      sendJson(response, 409, { error: 'worker_busy' });
      return;
    }

    active += 1;
    const started = performance.now();
    try {
      const body = await readBoundedBody(request, maxBodyBytes, bodyReadTimeoutMs);
      const batchSize = requestBatchSize(body);
      log({
        event: 'invocation_accepted',
        service: options.serviceName,
        batchSize,
      });
      const webRequest = new Request(`http://worker.local${url.pathname}`, {
        method: 'POST',
        headers: requestHeaders(request.headers),
        body: body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
      });
      const handled = await options.handler(webRequest);
      const summary = await responseSummary(handled);
      log({
        event: handled.status === 403 ? 'invocation_denied' : 'invocation_completed',
        service: options.serviceName,
        status: handled.status,
        batchSize,
        claimed: summary.claimed,
        outcomes: summary.outcomes,
        durationMs: Math.max(0, Math.round(performance.now() - started)),
        ...(handled.status === 403 ? { category: 'unauthorized' as const } : {}),
      });
      await relay(handled, response);
    } catch (error) {
      if (error instanceof Error && error.message === 'body_too_large') {
        log({
          event: 'invocation_denied',
          service: options.serviceName,
          status: 413,
          category: 'body_too_large',
        });
        sendJson(response, 413, { error: 'request_body_too_large' });
      } else if (error instanceof Error && error.message === 'body_read_timeout') {
        log({
          event: 'invocation_denied',
          service: options.serviceName,
          status: 408,
          category: 'body_read_timeout',
        });
        response.setHeader('connection', 'close');
        response.once('finish', () => request.destroy());
        sendJson(response, 408, { error: 'request_timeout' });
      } else {
        sendJson(response, 400, { error: 'P9_WORKER_REQUEST_INVALID' });
      }
    } finally {
      active -= 1;
      if (stopping && active === 0) server?.closeAllConnections();
    }
  };

  return {
    async start(): Promise<StartedWorkerAddress> {
      if (server) throw new Error('P9_WORKER_ALREADY_STARTED');
      server = createServer((request, response) => {
        void listener(request, response);
      });
      await new Promise<void>((resolve, reject) => {
        server!.once('error', reject);
        server!.listen(options.port, options.host, () => {
          server!.off('error', reject);
          resolve();
        });
      });
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('P9_WORKER_START_FAILED');
      const visibleHost = options.host === '0.0.0.0' || options.host === '::'
        ? '127.0.0.1' : options.host;
      log({ event: 'service_started', service: options.serviceName });
      return {
        host: options.host,
        port: address.port,
        url: `http://${visibleHost}:${address.port}`,
      };
    },
    stop(): Promise<void> {
      if (stopPromise) return stopPromise;
      if (!server) return Promise.resolve();
      stopping = true;
      log({ event: 'service_stopping', service: options.serviceName });
      stopPromise = new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) reject(error);
          else {
            log({ event: 'service_stopped', service: options.serviceName });
            resolve();
          }
        });
        server!.closeIdleConnections();
        if (active === 0) server!.closeAllConnections();
      });
      return stopPromise;
    },
  };
}

export function installGracefulShutdown(
  stop: () => Promise<void>,
  signals: readonly NodeJS.Signals[] = ['SIGINT', 'SIGTERM'],
): void {
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    void stop().then(() => {
      process.exitCode = 0;
    }, () => {
      process.exitCode = 1;
    });
  };
  signals.forEach((signal) => process.once(signal, shutdown));
}
