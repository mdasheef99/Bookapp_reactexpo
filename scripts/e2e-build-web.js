const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const workspaceDir = path.resolve(__dirname, '..');
const env = { ...process.env };
const envPath = path.join(workspaceDir, '.env');
const originalEnvContents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

const nextEnvContents = originalEnvContents.includes('EXPO_PUBLIC_DEV_SKIP_AUTH=')
  ? originalEnvContents.replace(/EXPO_PUBLIC_DEV_SKIP_AUTH=.*/g, 'EXPO_PUBLIC_DEV_SKIP_AUTH=true')
  : `${originalEnvContents.trim()}\nEXPO_PUBLIC_DEV_SKIP_AUTH=true\n`;

fs.writeFileSync(envPath, `${nextEnvContents.trim()}\n`, 'utf8');

let result;

try {
  result = process.platform === 'win32'
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
} finally {
  fs.writeFileSync(envPath, originalEnvContents, 'utf8');
}

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
