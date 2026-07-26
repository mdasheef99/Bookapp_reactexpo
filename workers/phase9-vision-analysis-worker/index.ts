import {
  assertSafeIngestionResponse,
  parseDedicatedWorkerRequest,
} from '../../supabase/functions/_shared/imageInventory/contracts/ingestion';
import { SpineImageAnalyzer } from '../../supabase/functions/_shared/imageInventory/contracts/vision';
import {
  runVisionAnalysisWorker,
  VisionRuntimeError,
} from '../../supabase/functions/_shared/imageInventory/runtime/visionAnalysisWorker';

export type VisionWorkerDependencies = Readonly<{
  workerId: string;
  workerAuthToken: string;
  serviceClient: any;
  analyzer: SpineImageAnalyzer;
}>;

const headers = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
  pragma: 'no-cache',
};
const response = (body: unknown, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers },
);

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  );
}

async function validCredential(request: Request, expected: string): Promise<boolean> {
  const supplied = request.headers.get('authorization') ?? '';
  const expectedHeader = `Bearer ${expected}`;
  const [left, right] = await Promise.all([digest(supplied), digest(expectedHeader)]);
  let different = supplied.length ^ expectedHeader.length;
  for (let index = 0; index < left.length; index += 1) {
    different |= left[index] ^ right[index];
  }
  return different === 0;
}

/** Dedicated fixture-backed worker boundary; no provider or metadata client is accepted. */
export async function handlePhase9VisionAnalysisWorker(
  request: Request,
  dependencies: VisionWorkerDependencies,
): Promise<Response> {
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  if (!await validCredential(request, dependencies.workerAuthToken)) {
    return response({ error: 'forbidden' }, 403);
  }
  try {
    const body = parseDedicatedWorkerRequest(await request.json());
    const result = await runVisionAnalysisWorker(
      { ...body, leaseOwner: dependencies.workerId },
      dependencies.serviceClient,
      dependencies.analyzer,
    );
    assertSafeIngestionResponse(result);
    return response(result);
  } catch (error) {
    if (error instanceof VisionRuntimeError) {
      return response({ error: error.code }, error.httpStatus);
    }
    return response({ error: 'P9_WORKER_REQUEST_INVALID' }, 400);
  }
}
