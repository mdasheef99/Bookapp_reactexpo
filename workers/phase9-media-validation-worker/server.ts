import {
  loadMediaWorkerEnvironment,
} from '../phase9-runtime/environment';
import {
  createJsonOperationalLogger,
  createPhase9WorkerHttpService,
  installGracefulShutdown,
} from '../phase9-runtime/httpService';
import { createPhase9MediaValidationService } from './bootstrap';

export async function startPhase9MediaValidationWorker(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const configuration = loadMediaWorkerEnvironment(environment);
  const handler = await createPhase9MediaValidationService({
    supabaseUrl: configuration.supabaseUrl,
    supabaseServiceRoleKey: configuration.supabaseServiceRoleKey,
    workerId: configuration.workerId,
    workerAuthToken: configuration.workerAuthToken,
    magickWasmPath: configuration.magickWasmPath,
  });
  const service = createPhase9WorkerHttpService({
    serviceName: 'phase9-media-validation-worker',
    host: configuration.host,
    port: configuration.port,
    concurrency: configuration.concurrency,
    workerAuthToken: configuration.workerAuthToken,
    handler,
    readiness: () => true,
    log: createJsonOperationalLogger(),
  });
  const address = await service.start();
  installGracefulShutdown(() => service.stop());
  return { service, address };
}

if (require.main === module) {
  void startPhase9MediaValidationWorker().catch(() => {
    process.stderr.write('{"event":"startup_failed","service":"phase9-media-validation-worker"}\n');
    process.exitCode = 1;
  });
}
