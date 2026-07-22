const { spawnSync } = require('child_process');
const path = require('path');

const workspaceDir = path.resolve(__dirname, '..');
const env = { ...process.env, EXPO_PUBLIC_DEV_SKIP_AUTH: 'false' };

const result = process.platform === 'win32'
  ? spawnSync(
      'cmd.exe',
      ['/c', path.join(workspaceDir, 'node_modules', '.bin', 'expo.cmd'), 'export', '--platform', 'web', '--clear'],
      {
        cwd: workspaceDir,
        env,
        stdio: 'inherit',
      }
    )
  : spawnSync(path.join(workspaceDir, 'node_modules', '.bin', 'expo'), ['export', '--platform', 'web', '--clear'], {
      cwd: workspaceDir,
      env,
      stdio: 'inherit',
    });

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
