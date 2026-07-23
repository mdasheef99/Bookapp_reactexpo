import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createImageMagickMediaProcessor } from '../../supabase/functions/_shared/imageInventory/media/imageMagickMediaProcessor';
import { handlePhase9MediaValidationWorker } from './index';

export type DedicatedWorkerConfiguration = Readonly<{
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  workerId: string;
  workerAuthToken: string;
  privilegedSecrets?: readonly string[];
  magickWasmPath: string;
}>;

export function assertDedicatedWorkerConfiguration(configuration: DedicatedWorkerConfiguration): void {
  const token = configuration.workerAuthToken;
  const privileged = [configuration.supabaseServiceRoleKey, ...(configuration.privilegedSecrets ?? [])];
  const valid = Boolean(configuration.supabaseUrl && configuration.supabaseServiceRoleKey && configuration.magickWasmPath)
    && /^[A-Za-z0-9._~+/=-]{32,256}$/u.test(token)
    && new Set(token).size >= 12
    && privileged.every((secret) => token !== secret)
    && /^[A-Za-z0-9._:-]{16,128}$/u.test(configuration.workerId);
  if (!valid) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
}

/** Production composition boundary for a dedicated Node-compatible host. */
export async function createPhase9MediaValidationService(configuration: DedicatedWorkerConfiguration) {
  assertDedicatedWorkerConfiguration(configuration);
  const wasmBytes = await readFile(configuration.magickWasmPath);
  const mediaProcessor = await createImageMagickMediaProcessor(wasmBytes);
  const serviceClient = createClient(configuration.supabaseUrl, configuration.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return (request: Request) => handlePhase9MediaValidationWorker(request, {
    workerId: configuration.workerId,
    workerAuthToken: configuration.workerAuthToken,
    serviceClient,
    mediaProcessor,
  });
}
