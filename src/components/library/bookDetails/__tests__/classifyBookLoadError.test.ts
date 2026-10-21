import { classifyBookLoadError } from '../classifyBookLoadError';

describe('classifyBookLoadError', () => {
  it('returns offline when offline regardless of error', () => {
    expect(classifyBookLoadError(null, true)).toBe('offline');
    expect(classifyBookLoadError({ code: 'PGRST116' }, true)).toBe('offline');
    expect(classifyBookLoadError(new Error('boom'), true)).toBe('offline');
  });

  it('returns notFound for PGRST116 single-row and RLS-hidden rows', () => {
    expect(classifyBookLoadError({ code: 'PGRST116' }, false)).toBe('notFound');
  });

  it('returns notFound for 22P02 invalid id', () => {
    expect(classifyBookLoadError({ code: '22P02' }, false)).toBe('notFound');
  });

  it('returns server for anything else', () => {
    expect(classifyBookLoadError(null, false)).toBe('server');
    expect(classifyBookLoadError(undefined, false)).toBe('server');
    expect(classifyBookLoadError(new Error('boom'), false)).toBe('server');
    expect(classifyBookLoadError({ code: '42501' }, false)).toBe('server');
    expect(classifyBookLoadError({ message: 'no code' }, false)).toBe('server');
  });
});
