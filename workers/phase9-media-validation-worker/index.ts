import { assertSafeIngestionResponse, parseDedicatedWorkerRequest } from '../../supabase/functions/_shared/imageInventory/contracts/ingestion';
import { MediaProcessor } from '../../supabase/functions/_shared/imageInventory/media/imageMagickMediaProcessor';
import { runMediaValidationWorker } from '../../supabase/functions/_shared/imageInventory/runtime/mediaValidationWorker';

export type DedicatedWorkerDependencies = Readonly<{
  workerId: string;
  workerAuthToken: string;
  serviceClient: any;
  mediaProcessor: MediaProcessor;
}>;

const jsonHeaders = { 'content-type': 'application/json', 'cache-control': 'no-store', pragma: 'no-cache' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: jsonHeaders });

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

async function validWorkerCredential(request: Request, expected: string): Promise<boolean> {
  const supplied = request.headers.get('authorization') ?? '';
  const expectedHeader = `Bearer ${expected}`;
  const [left, right] = await Promise.all([digest(supplied), digest(expectedHeader)]);
  let different = supplied.length ^ expectedHeader.length;
  for (let index = 0; index < left.length; index += 1) different |= left[index] ^ right[index];
  return different === 0;
}

/** Dedicated, non-Edge entry point. The host injects a worker-only ingress token,
 * stable worker identity, service-role database client, and pinned processor. */
export async function handlePhase9MediaValidationWorker(
  request: Request,
  dependencies: DedicatedWorkerDependencies,
): Promise<Response> {
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  if (!await validWorkerCredential(request, dependencies.workerAuthToken)) return response({ error: 'forbidden' }, 403);
  try {
    const body = parseDedicatedWorkerRequest(await request.json());
    const result = await runMediaValidationWorker(
      { ...body, leaseOwner: dependencies.workerId },
      dependencies.serviceClient,
      dependencies.mediaProcessor,
    );
    assertSafeIngestionResponse(result);
    return response(result);
  } catch {
    return response({ error: 'P9_WORKER_REQUEST_INVALID' }, 400);
  }
}
