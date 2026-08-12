const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_FILES = [
  '.dockerignore',
  'workers/phase9-runtime/environment.ts',
  'workers/phase9-runtime/httpService.ts',
  'workers/phase9-media-validation-worker/server.ts',
  'workers/phase9-media-validation-worker/tsconfig.json',
  'workers/phase9-media-validation-worker/Dockerfile',
  'workers/phase9-vision-analysis-worker/server.ts',
  'workers/phase9-vision-analysis-worker/deploymentFixtures.ts',
  'workers/phase9-vision-analysis-worker/tsconfig.json',
  'workers/phase9-vision-analysis-worker/Dockerfile',
  'workers/phase9-metadata-worker/server.ts',
  'workers/phase9-metadata-worker/tsconfig.json',
  'workers/phase9-metadata-worker/Dockerfile',
  'workers/phase9-publication-worker/server.ts',
  'workers/phase9-publication-worker/tsconfig.json',
  'workers/phase9-publication-worker/Dockerfile',
  'scripts/invoke-phase9-worker.js',
  'scripts/smoke-phase9-worker-entrypoints.js',
  'scripts/smoke-phase9-worker-containers.js',
  '.github/workflows/phase9-worker-container-smoke.yml',
  'supabase/functions/phase9-owner-ingestion/deno.json',
  'docs/multi-tenant-bookstore-marketplace/implementation/phase-9-image-inventory/work-units/04a-deployment-runtime-scaffolding-sdd.md',
];

const REQUIRED_SCRIPTS = {
  'build:phase9:media-worker': 'tsc -p workers/phase9-media-validation-worker/tsconfig.json',
  'start:phase9:media-worker': 'node .phase9-dist/workers/phase9-media-validation-worker/server.js',
  'build:phase9:vision-worker': 'tsc -p workers/phase9-vision-analysis-worker/tsconfig.json',
  'start:phase9:vision-worker': 'node .phase9-dist/workers/phase9-vision-analysis-worker/server.js',
  'build:phase9:metadata-worker': 'tsc -p workers/phase9-metadata-worker/tsconfig.json',
  'start:phase9:metadata-worker': 'node .phase9-dist/workers/phase9-metadata-worker/server.js',
  'build:phase9:publication-worker': 'tsc -p workers/phase9-publication-worker/tsconfig.json',
  'start:phase9:publication-worker': 'node .phase9-dist/workers/phase9-publication-worker/server.js',
  'invoke:phase9:worker': 'node scripts/invoke-phase9-worker.js',
  'smoke:phase9:worker-entrypoints': 'node scripts/smoke-phase9-worker-entrypoints.js',
  'smoke:phase9:worker-containers': 'node scripts/smoke-phase9-worker-containers.js',
};

const REQUIRED_DOCKER_EXCLUSIONS = [
  '**',
  '.env*',
  '.git',
  'node_modules',
  '.phase9-dist',
  'dist',
  'coverage',
  '.codex',
  '.agents',
  '*.pem',
  '*.key',
  '*secret*',
];

function read(root, name) {
  return fs.readFileSync(path.join(root, name), 'utf8');
}

function validateContainerSmokeWorkflow(source) {
  const workflow = source.replace(/\r\n?/gu, '\n');
  return workflow.includes('permissions:\n  contents: read')
    && workflow.includes('npm run smoke:phase9:worker-containers')
    && !/secrets\./u.test(workflow)
    && !/docker\s+(?:push|login)/u.test(workflow);
}

function validatePhase9DeploymentRuntime(root = process.cwd()) {
  const errors = [];
  for (const name of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(root, name))) errors.push(`missing:${name}`);
  }
  const packageJson = JSON.parse(read(root, 'package.json'));
  for (const [name, command] of Object.entries(REQUIRED_SCRIPTS)) {
    if (packageJson.scripts?.[name] !== command) errors.push(`script:${name}`);
  }
  const dockerIgnore = read(root, '.dockerignore')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  for (const exclusion of REQUIRED_DOCKER_EXCLUSIONS) {
    if (!dockerIgnore.includes(exclusion)) errors.push(`dockerignore:${exclusion}`);
  }

  const config = read(root, 'supabase/config.toml');
  if (!/\[functions\.phase9-owner-ingestion\][\s\S]*?enabled\s*=\s*true[\s\S]*?verify_jwt\s*=\s*true[\s\S]*?import_map\s*=\s*"\.\/functions\/phase9-owner-ingestion\/deno\.json"[\s\S]*?entrypoint\s*=\s*"\.\/functions\/phase9-owner-ingestion\/index\.ts"/u.test(config)) {
    errors.push('owner-ingestion-jwt-config');
  }
  const ownerImportMap = JSON.parse(read(
    root,
    'supabase/functions/phase9-owner-ingestion/deno.json',
  ));
  if (ownerImportMap.imports?.zod !== 'npm:zod@4.2.1') {
    errors.push('owner-ingestion-import-map');
  }

  for (const worker of [
    'phase9-media-validation-worker',
    'phase9-vision-analysis-worker',
    'phase9-metadata-worker',
    'phase9-publication-worker',
  ]) {
    const dockerfile = read(root, `workers/${worker}/Dockerfile`);
    if (!dockerfile.includes('RUN npm ci') || !dockerfile.includes('npm ci --omit=dev')
      || !dockerfile.includes('node:22.13.0-bookworm-slim')) {
      errors.push(`container:${worker}`);
    }
    if (/^COPY\s+\.\s+\.$/mu.test(dockerfile)
      || !dockerfile.includes('COPY workers/phase9-runtime ./workers/phase9-runtime')
      || !dockerfile.includes('COPY supabase/functions/_shared/imageInventory ./supabase/functions/_shared/imageInventory')) {
      errors.push(`container-context:${worker}`);
    }
    const server = read(root, `workers/${worker}/server.ts`);
    if (!server.includes('createPhase9WorkerHttpService')
      || !server.includes('installGracefulShutdown')
      || !server.includes('concurrency: configuration.concurrency')) {
      errors.push(`server:${worker}`);
    }
  }

  const runtimeSources = [
    'workers/phase9-runtime/environment.ts',
    'workers/phase9-runtime/httpService.ts',
    'workers/phase9-media-validation-worker/server.ts',
    'workers/phase9-vision-analysis-worker/server.ts',
    'workers/phase9-vision-analysis-worker/deploymentFixtures.ts',
    'workers/phase9-metadata-worker/server.ts',
    'workers/phase9-publication-worker/server.ts',
    'scripts/invoke-phase9-worker.js',
  ].map((name) => read(root, name)).join('\n');
  if (/OPENAI_API_KEY|OPEN_LIBRARY_API_KEY/u.test(runtimeSources)) {
    errors.push('provider-credential-variable');
  }
  const nonEnvironmentRuntimeSources = [
    'workers/phase9-runtime/httpService.ts',
    'workers/phase9-media-validation-worker/server.ts',
    'workers/phase9-vision-analysis-worker/server.ts',
    'workers/phase9-vision-analysis-worker/deploymentFixtures.ts',
    'workers/phase9-metadata-worker/server.ts',
    'workers/phase9-publication-worker/server.ts',
    'scripts/invoke-phase9-worker.js',
    '.github/workflows/phase9-worker-container-smoke.yml',
    'workers/phase9-media-validation-worker/Dockerfile',
    'workers/phase9-vision-analysis-worker/Dockerfile',
    'workers/phase9-metadata-worker/Dockerfile',
    'workers/phase9-publication-worker/Dockerfile',
  ].map((name) => read(root, name)).join('\n');
  if (/GEMINI_API_KEY/u.test(nonEnvironmentRuntimeSources)
    || !read(root, 'workers/phase9-runtime/environment.ts')
      .includes("'PHASE9_GEMINI_API_KEY'")) {
    errors.push('gemini-credential-boundary');
  }
  if (/PHASE9_GOOGLE_BOOKS_API_KEY/u.test(nonEnvironmentRuntimeSources)
    || !read(root, 'workers/phase9-runtime/environment.ts')
      .includes("'PHASE9_GOOGLE_BOOKS_API_KEY'")) {
    errors.push('google-books-credential-boundary');
  }
  if (!runtimeSources.includes('/health') || !runtimeSources.includes('/ready')) {
    errors.push('health-readiness');
  }
  if (!runtimeSources.includes('PHASE9_WORKER_CONCURRENCY')
    || !runtimeSources.includes("concurrency !== '1'")) {
    errors.push('initial-concurrency');
  }
  const workflow = read(root, '.github/workflows/phase9-worker-container-smoke.yml');
  if (!validateContainerSmokeWorkflow(workflow)) {
    errors.push('container-smoke-workflow');
  }
  return { valid: errors.length === 0, errors };
}

async function runExecutableDeploymentValidation(root = process.cwd()) {
  const result = validatePhase9DeploymentRuntime();
  if (!result.valid) {
    throw new Error(`P9_DEPLOYMENT_VALIDATION_FAILED:${result.errors.join(',')}`);
  }
  const { spawnSync } = require('node:child_process');
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('P9_DEPLOYMENT_NPM_UNAVAILABLE');
  for (const script of [
    'build:phase9:media-worker',
    'build:phase9:vision-worker',
    'build:phase9:metadata-worker',
    'build:phase9:publication-worker',
  ]) {
    const build = spawnSync(
      process.execPath,
      [npmCli, 'run', script],
      { cwd: root, stdio: 'inherit' },
    );
    if (build.status !== 0) throw new Error('P9_DEPLOYMENT_BUILD_FAILED');
  }
  const { smokePhase9WorkerEntrypoints } = require('./smoke-phase9-worker-entrypoints');
  await smokePhase9WorkerEntrypoints(root);
}

if (require.main === module) {
  void runExecutableDeploymentValidation().then(() => {
    process.stdout.write('Phase 9 executable deployment-runtime validation passed.\n');
  }, (error) => {
    const detail = error instanceof Error && /^P9_[A-Z_:,-]+$/u.test(error.message)
      ? error.message : 'P9_DEPLOYMENT_VALIDATION_FAILED';
    process.stderr.write(`${detail}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  runExecutableDeploymentValidation,
  validateContainerSmokeWorkflow,
  validatePhase9DeploymentRuntime,
};
