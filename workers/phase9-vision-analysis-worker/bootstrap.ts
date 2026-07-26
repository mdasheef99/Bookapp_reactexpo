import { createClient } from '@supabase/supabase-js';
import { handlePhase9VisionAnalysisWorker } from './index';
import {
  createDeploymentFixtureAnalyzer,
  DeploymentFixtureCase,
  parseDeploymentFixtureCase,
} from './deploymentFixtures';

export type VisionWorkerConfiguration = Readonly<{
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  workerId: string;
  workerAuthToken: string;
  privilegedSecrets?: readonly string[];
  fixtureCase: DeploymentFixtureCase;
}>;

export function assertVisionWorkerConfiguration(
  configuration: VisionWorkerConfiguration,
): void {
  const token = configuration.workerAuthToken;
  const privileged = [
    configuration.supabaseServiceRoleKey,
    ...(configuration.privilegedSecrets ?? []),
  ];
  const valid = Boolean(configuration.supabaseUrl && configuration.supabaseServiceRoleKey)
    && /^[A-Za-z0-9._~+/=-]{32,256}$/u.test(token)
    && new Set(token).size >= 12
    && privileged.every((secret) => token !== secret)
    && /^[A-Za-z0-9._:-]{16,128}$/u.test(configuration.workerId);
  if (!valid) throw new Error('P9_WORKER_CONFIGURATION_INVALID');
  parseDeploymentFixtureCase(configuration.fixtureCase);
}

export function createPhase9VisionAnalysisService(
  configuration: VisionWorkerConfiguration,
) {
  assertVisionWorkerConfiguration(configuration);
  const serviceClient = createClient(
    configuration.supabaseUrl,
    configuration.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const analyzer = createDeploymentFixtureAnalyzer(configuration.fixtureCase);
  return (request: Request) => handlePhase9VisionAnalysisWorker(request, {
    workerId: configuration.workerId,
    workerAuthToken: configuration.workerAuthToken,
    serviceClient,
    analyzer,
  });
}
