const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const harness = spawnSync(process.execPath, [
  path.join(root, 'supabase/tests/phase9/unit7bCrossLayerDatabaseHarness.mjs'), 'all',
], { cwd: root, encoding: 'utf8', timeout: 120000 });
if (harness.status !== 0 || !harness.stdout) {
  process.stderr.write(harness.stderr || 'Unit 7B database harness failed.\n');
  process.exit(harness.status || 1);
}
JSON.parse(harness.stdout);
const jest = spawnSync(process.execPath, [
  path.join(root, 'node_modules/jest/bin/jest.js'), '--runInBand',
  '--forceExit', 'src/features/imageInventory/__tests__/publicationContractIntegration.test.tsx',
], {
  cwd: root, stdio: 'inherit', timeout: 120000,
  env: { ...process.env, UNIT7B_RUNTIME_PAYLOAD: harness.stdout },
});
process.exit(jest.status ?? 1);
