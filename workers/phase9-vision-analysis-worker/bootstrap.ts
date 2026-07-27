import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { handlePhase9VisionAnalysisWorker } from './index';
import {
  GeminiSpineImageAnalyzer,
} from '../../supabase/functions/_shared/imageInventory/analysis/geminiSpineImageAnalyzer';
import {
  createDeploymentFixtureAnalyzer,
  DeploymentFixtureCase,
  parseDeploymentFixtureCase,
} from './deploymentFixtures';
import { createSupabaseVisionMediaResolver } from './supabaseVisionMediaResolver';
import {
  createSupabaseVisionProviderAttempts,
} from './supabaseVisionProviderAttempts';

type BaseVisionWorkerConfiguration = Readonly<{
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  workerId: string;
  workerAuthToken: string;
  privilegedSecrets?: readonly string[];
}>;
export type VisionWorkerConfiguration = BaseVisionWorkerConfiguration & (
  | Readonly<{ analyzerMode?: 'fixture'; fixtureCase: DeploymentFixtureCase }>
  | Readonly<{
    analyzerMode: 'gemini';
    apiKey: string;
    modelId: string;
    timeoutMs: number;
  }>
);

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
  if (configuration.analyzerMode === 'gemini') {
    if (!/^[A-Za-z0-9._~+/=-]{32,256}$/u.test(configuration.apiKey)
      || !/^[a-z][a-z0-9._-]{1,63}$/u.test(configuration.modelId)
      || !Number.isInteger(configuration.timeoutMs)
      || configuration.timeoutMs < 100
      || configuration.timeoutMs > 300_000
      || token === configuration.apiKey
      || privileged.includes(configuration.apiKey)) {
      throw new Error('P9_WORKER_CONFIGURATION_INVALID');
    }
  } else {
    parseDeploymentFixtureCase(configuration.fixtureCase);
  }
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
  const providerAttempts = createSupabaseVisionProviderAttempts(serviceClient as any);
  const analyzer = configuration.analyzerMode === 'gemini'
    ? new GeminiSpineImageAnalyzer({
      client: new GoogleGenAI({ apiKey: configuration.apiKey }),
      modelId: configuration.modelId,
      timeoutMs: configuration.timeoutMs,
      resolveMedia: createSupabaseVisionMediaResolver(serviceClient as any),
      providerAttempts,
      privilegedValues: [
        configuration.apiKey,
        configuration.supabaseServiceRoleKey,
        configuration.workerAuthToken,
      ],
    })
    : createDeploymentFixtureAnalyzer(configuration.fixtureCase);
  return (request: Request) => handlePhase9VisionAnalysisWorker(request, {
    workerId: configuration.workerId,
    workerAuthToken: configuration.workerAuthToken,
    serviceClient,
    analyzer,
  });
}
