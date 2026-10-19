export type BookLoadErrorKind = 'offline' | 'notFound' | 'server';

export function classifyBookLoadError(error: unknown, isOffline: boolean): BookLoadErrorKind {
  if (isOffline) return 'offline';
  if (error !== null && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === 'PGRST116' || code === '22P02') return 'notFound';
  }
  return 'server';
}
