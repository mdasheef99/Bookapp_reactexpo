const exactSensitiveKeys = new Set([
  'authorization',
  'authheader',
  'bearer',
  'signedurl',
  'signeduploadurl',
  'objectpath',
  'storagepath',
  'capability',
  'capabilities',
  'capabilityid',
  'uploadtoken',
  'accesstoken',
  'refreshtoken',
  'providersecret',
  'servicerolekey',
  'supabaseservicerolekey',
  'credentials',
  'clientsecret',
  'apisecret',
  'exif',
  'gps',
  'rawmedia',
  'imagebytes',
  'base64',
]);

export function normalizePrivacyKey(key: string): string {
  return key.normalize('NFKC').replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
}

export function isPrivacySensitiveKey(key: string): boolean {
  const normalized = normalizePrivacyKey(key);
  return exactSensitiveKeys.has(normalized)
    || normalized.startsWith('capabilit')
    || normalized.endsWith('token')
    || normalized.endsWith('secret')
    || normalized.includes('servicerole');
}

export function assertNoPrivacySensitiveKeys(value: unknown, label: string): void {
  const inspect = (entry: unknown): void => {
    if (Array.isArray(entry)) return entry.forEach(inspect);
    if (!entry || typeof entry !== 'object') return;
    for (const [key, child] of Object.entries(entry as Record<string, unknown>)) {
      if (isPrivacySensitiveKey(key)) throw new Error(`${label}: ${key}`);
      inspect(child);
    }
  };
  inspect(value);
}
