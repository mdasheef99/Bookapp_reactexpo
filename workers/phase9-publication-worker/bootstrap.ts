import { createClient } from '@supabase/supabase-js';
import type { PublicationWorkerEnvironment } from '../phase9-runtime/environment';
import { handlePhase9PublicationWorker } from './index';

export function createPhase9PublicationService(environment: PublicationWorkerEnvironment) {
  const serviceClient = createClient(environment.supabaseUrl, environment.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return (request: Request) => handlePhase9PublicationWorker(request, {
    workerId: environment.workerId, workerAuthToken: environment.workerAuthToken, serviceClient,
  });
}
