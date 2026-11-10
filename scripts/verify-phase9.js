#!/usr/bin/env node
/*
 * One-command Phase 9 gate. Run before every commit and before any deploy:
 *
 *   node scripts/verify-phase9.js           fast gate (builds, typecheck, Jest, migration set)
 *   node scripts/verify-phase9.js --full    fast gate + database suites + continuity validator
 *
 * It runs no network call, no Supabase call and no deploy. Exit code 0 means
 * every step passed. The worker builds are the same `tsc -p` commands the
 * worker Dockerfiles run, so a pass here means the Render build step compiles.
 *
 * KNOWN_FAILING lists Jest suites that fail for a recorded, pre-existing reason.
 * They are reported but do not fail the gate. Any other failing suite does.
 * Remove an entry as soon as its suite is fixed; never add one to hide a new failure.
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const full = process.argv.includes('--full');
const node = process.execPath;
const tsc = path.join('node_modules', 'typescript', 'bin', 'tsc');
const jest = path.join('node_modules', 'jest', 'bin', 'jest.js');
const phase9Scripts = path.join(
  'docs', 'multi-tenant-bookstore-marketplace', 'implementation',
  'phase-9-image-inventory', 'scripts',
);

// Suite path fragments (forward slashes) -> reason. Keep this list short.
const KNOWN_FAILING = {};

const workers = [
  'phase9-metadata-worker',
  'phase9-vision-analysis-worker',
  'phase9-media-validation-worker',
  'phase9-publication-worker',
];

const results = [];

function run(name, command, args, options = {}) {
  const started = Date.now();
  process.stdout.write(`\n=== ${name} ===\n`);
  const child = spawnSync(command, args, {
    cwd: root,
    stdio: options.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  const ok = child.status === 0;
  if (options.quiet && !ok) {
    process.stdout.write(`${child.stdout || ''}${child.stderr || ''}`);
  }
  if (!options.defer) results.push({ name, ok, seconds });
  return { ok, seconds, child };
}

for (const worker of workers) {
  run(`build ${worker}`, node, [tsc, '-p', path.join('workers', worker, 'tsconfig.json')]);
}

run('app typecheck', node, [tsc, '--noEmit']);

// Jest: parse the JSON report so known failures can be told apart from new ones.
const report = path.join(os.tmpdir(), `verify-phase9-jest-${process.pid}.json`);
const jestRun = run(
  'phase9 Jest',
  node,
  [jest, '--testPathPattern', '(phase9|marketplacePhase9|imageInventory)', '--json', `--outputFile=${report}`, '--silent'],
  { quiet: true, defer: true },
);
let jestOk = jestRun.ok;
let jestNote = '';
try {
  const data = JSON.parse(fs.readFileSync(report, 'utf8'));
  const failed = data.testResults
    .filter((suite) => suite.status === 'failed')
    .map((suite) => path.relative(root, suite.name).split(path.sep).join('/'));
  const known = failed.filter((suite) => Object.keys(KNOWN_FAILING).some((key) => suite.includes(key)));
  const fresh = failed.filter((suite) => !known.includes(suite));
  jestNote = `suites ${data.numPassedTestSuites}/${data.numTotalTestSuites} passed, tests ${data.numPassedTests}/${data.numTotalTests} passed`;
  for (const suite of known) process.stdout.write(`KNOWN_FAILING ${suite}\n`);
  for (const suite of fresh) process.stdout.write(`FAILED ${suite}\n`);
  jestOk = fresh.length === 0 && data.numTotalTestSuites > 0;
  if (known.length > 0) jestNote += `, ${known.length} known failing`;
} catch (error) {
  jestOk = false;
  jestNote = `no Jest report (${error.message})`;
} finally {
  fs.rmSync(report, { force: true });
}
process.stdout.write(`${jestNote}\n`);
results.push({ name: `phase9 Jest (${jestNote})`, ok: jestOk, seconds: jestRun.seconds });

const powershell = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File'];
// The test wrapper supplies the validator's parameters and runs its refusal cases.
run('migration set', 'powershell.exe', [...powershell, path.join(phase9Scripts, 'test-phase9-migration-set.ps1')]);

if (full) {
  run('phase9 database suites', 'npm', ['run', 'test:phase9:db'], {});
  // The continuity validator needs a clean tree (it diffs the repository).
  run('continuity validator', 'powershell.exe', [...powershell, path.join(phase9Scripts, 'validate-phase9-continuity.ps1')]);
}

process.stdout.write('\n=== verify-phase9 summary ===\n');
for (const result of results) {
  process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'}  ${String(result.seconds).padStart(4)}s  ${result.name}\n`);
}
const failedSteps = results.filter((result) => !result.ok);
process.stdout.write(failedSteps.length === 0 ? 'VERIFY_PHASE9=PASS\n' : `VERIFY_PHASE9=FAIL steps=${failedSteps.length}\n`);
process.exit(failedSteps.length === 0 ? 0 : 1);
