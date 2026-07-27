import {
  loadVisionWorkerEnvironment,
} from '../phase9-runtime/environment';
import {
  createJsonOperationalLogger,
  createPhase9WorkerHttpService,
  installGracefulShutdown,
} from '../phase9-runtime/httpService';
import { createPhase9VisionAnalysisService } from './bootstrap';
import { parseDeploymentFixtureCase } from './deploymentFixtures';

export async function startPhase9VisionAnalysisWorker(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const configuration = loadVisionWorkerEnvironment(environment);
  const base = {
    supabaseUrl: configuration.supabaseUrl,
    supabaseServiceRoleKey: configuration.supabaseServiceRoleKey,
    workerId: configuration.workerId,
    workerAuthToken: configuration.workerAuthToken,
  };
  const handler = createPhase9VisionAnalysisService(
    configuration.analyzerMode === 'gemini'
      ? {
        ...base,
        analyzerMode: 'gemini',
        apiKey: configuration.apiKey,
        modelId: configuration.modelId,
        timeoutMs: configuration.timeoutMs,
      }
      : {
        ...base,
        analyzerMode: 'fixture',
        fixtureCase: parseDeploymentFixtureCase(configuration.fixtureCase),
      },
  );
  const service = createPhase9WorkerHttpService({
    serviceName: 'phase9-vision-analysis-worker',
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
  void startPhase9VisionAnalysisWorker().catch(() => {
    process.stderr.write('{"event":"startup_failed","service":"phase9-vision-analysis-worker"}\n');
    process.exitCode = 1;
  });
}
