import { loadPublicationWorkerEnvironment } from '../phase9-runtime/environment';
import { createJsonOperationalLogger, createPhase9WorkerHttpService, installGracefulShutdown } from '../phase9-runtime/httpService';
import { createPhase9PublicationService } from './bootstrap';

export async function startPhase9PublicationWorker(environment = process.env) {
  const configuration = loadPublicationWorkerEnvironment(environment);
  const service = createPhase9WorkerHttpService({
    serviceName: 'phase9-publication-worker', host: configuration.host, port: configuration.port,
    concurrency: configuration.concurrency, workerAuthToken: configuration.workerAuthToken,
    handler: createPhase9PublicationService(configuration), readiness: () => true,
    log: createJsonOperationalLogger(),
  });
  const address = await service.start(); installGracefulShutdown(() => service.stop());
  return { service, address };
}
if (require.main === module) void startPhase9PublicationWorker().catch(() => { process.exitCode = 1; });
