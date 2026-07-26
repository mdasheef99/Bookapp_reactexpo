const SAFE_OUTCOME = /^[a-z][a-z0-9_]{0,63}$/u;

function invalid() {
  throw new Error('P9_WORKER_INVOCATION_CONFIGURATION_INVALID');
}

function parseInteger(value, minimum, maximum) {
  if (!/^[0-9]+$/u.test(String(value))) invalid();
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) invalid();
  return parsed;
}

function parseWorkerUrl(value) {
  try {
    const parsed = new URL(value);
    const local = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    if ((!local && parsed.protocol !== 'https:') || (local && !['http:', 'https:'].includes(parsed.protocol))
      || parsed.username || parsed.password || parsed.search || parsed.hash) invalid();
    parsed.pathname = '/run';
    return parsed.toString();
  } catch {
    return invalid();
  }
}

function summarizeWorkerResponse(service, status, value) {
  const claimed = Number.isInteger(value?.claimed) && value.claimed >= 0 && value.claimed <= 10
    ? value.claimed : 0;
  const outcomes = Array.isArray(value?.results)
    ? value.results.map((entry) => entry?.outcome)
      .filter((outcome) => typeof outcome === 'string' && SAFE_OUTCOME.test(outcome))
      .slice(0, 10)
    : [];
  return { service, status, claimed, outcomes };
}

async function readBoundedJsonResponse(response, limit) {
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new Error('P9_WORKER_INVOCATION_RESPONSE_TOO_LARGE');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return {};
    }
  } finally {
    reader.releaseLock();
  }
}

async function invokePhase9Worker({
  service,
  url,
  token,
  batchSize = 1,
  timeoutMs = 30_000,
  maxResponseBytes = 16_384,
  fetchImpl = fetch,
}) {
  if (!['media', 'vision'].includes(service)
    || typeof token !== 'string' || token.length < 32) invalid();
  const endpoint = parseWorkerUrl(url);
  const safeBatchSize = parseInteger(batchSize, 1, 10);
  const safeTimeout = parseInteger(timeoutMs, 100, 300_000);
  const safeResponseLimit = parseInteger(maxResponseBytes, 64, 65_536);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), safeTimeout);
  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: safeBatchSize }),
      signal: controller.signal,
    });
    const body = await readBoundedJsonResponse(response, safeResponseLimit);
    return summarizeWorkerResponse(service, response.status, body);
  } catch (error) {
    if (controller.signal.aborted) throw new Error('P9_WORKER_INVOCATION_TIMEOUT');
    if (error instanceof Error
      && error.message === 'P9_WORKER_INVOCATION_RESPONSE_TOO_LARGE') throw error;
    throw new Error('P9_WORKER_INVOCATION_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

function selectedConfiguration(environment, service) {
  const prefix = service === 'media' ? 'MEDIA' : service === 'vision' ? 'VISION' : invalid();
  return {
    service,
    url: environment[`PHASE9_${prefix}_WORKER_URL`] ?? '',
    token: environment[`PHASE9_${prefix}_WORKER_INGRESS_TOKEN`] ?? '',
    batchSize: environment.PHASE9_WORKER_BATCH_SIZE ?? '1',
    timeoutMs: environment.PHASE9_WORKER_INVOKE_TIMEOUT_MS ?? '30000',
  };
}

async function main() {
  const service = process.argv[2];
  try {
    const summary = await invokePhase9Worker(selectedConfiguration(process.env, service));
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    if (summary.status < 200 || summary.status >= 300) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({
      service: ['media', 'vision'].includes(service) ? service : 'invalid',
      error: error instanceof Error && /^P9_[A-Z_]+$/u.test(error.message)
        ? error.message : 'P9_WORKER_INVOCATION_FAILED',
    })}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  invokePhase9Worker,
  summarizeWorkerResponse,
  selectedConfiguration,
};
