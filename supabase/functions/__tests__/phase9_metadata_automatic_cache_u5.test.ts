import { automaticDependencies, completedReceipt } from './support/automaticWorker';

describe('U5 selected-only cache (02c §4.3)', () => {
  // Mutation caught: optional cache persistence changes a confirmed terminal result.
  it('writes only after completion and isolates cache failures', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_store_metadata_cache'
      ? { data: null, error: { message: 'fixture cache unavailable' } } : undefined });
    expect((await subject.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).toContain('phase9_complete_automatic_metadata_v1');
    expect(names.indexOf('phase9_store_metadata_cache')).toBeGreaterThan(names.indexOf('phase9_complete_automatic_metadata_v1'));
    expect(subject.gets()).toBe(1);
    const cache = subject.fixture.calls.find(call => call.name === 'phase9_store_metadata_cache')!;
    expect(cache.parameters.p_normalized_snapshot).toEqual(subject.command()!.result.outcome.selected);
    expect(cache.parameters).not.toHaveProperty('rows');
    expect(names).not.toContain('phase9_fail_metadata_job');
  });
  // Mutation caught: caching a completion that was refused or never confirmed.
  it('writes no cache after a stale rejection or an uncertain completion', async () => {
    const stale = automaticDependencies({ rpc: async name => name === 'phase9_complete_automatic_metadata_v1'
      ? { data: { status: 'stale_rejected' }, error: null } : undefined });
    expect((await stale.run()).results).toEqual([{ outcome: 'stale_claim' }]);
    expect(stale.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_cache');
    const uncertain = automaticDependencies({ rpc: async name => name === 'phase9_complete_automatic_metadata_v1'
      ? { data: null, error: { message: 'lost completion' } } : undefined });
    expect((await uncertain.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(uncertain.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_cache');
    expect(uncertain.fixture.calls.map(call => call.name)).not.toContain('phase9_fail_metadata_job');
  });
  // Mutation caught: caching a retryable or otherwise non-cacheable outcome.
  it('skips retryable and non-cacheable outcomes', async () => {
    const retryable = automaticDependencies({ fetcher: async () => new Response('', { status: 503 }) });
    expect((await retryable.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(retryable.gets()).toBe(1);
    expect(retryable.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_cache');
    const malformed = automaticDependencies({ fetcher: async () => new Response('{', {
      headers: { 'content-type': 'application/json' } }) });
    expect((await malformed.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(malformed.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_cache');
  });
  // Mutation caught: recovery regenerates cache timestamps instead of using the frozen command.
  it('uses the frozen timestamps on a recovered completion', async () => {
    jest.useFakeTimers();
    const start = Date.parse('2026-11-02T12:00:00.000Z');
    jest.setSystemTime(start);
    let command: Record<string, any> | null = null;
    try {
      const subject = automaticDependencies({ rpc: async (name, p) => {
        if (name === 'phase9_complete_automatic_metadata_v1') {
          command = p.p_command;
          jest.setSystemTime(start + 60 * 60 * 1000);
          return { data: null, error: { message: 'lost completion' } };
        }
        if (name === 'phase9_recover_automatic_metadata_v1' && command !== null) {
          return { data: { ...completedReceipt(command), status: 'replayed' }, error: null };
        }
        return undefined;
      } });
      expect((await subject.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
      const cache = subject.fixture.calls.find(call => call.name === 'phase9_store_metadata_cache');
      expect(cache).toBeDefined();
      expect(Date.parse(cache!.parameters.p_source_fetched_at)).toBe(start);
      expect(Date.parse(cache!.parameters.p_expires_at)).toBe(start + 24 * 60 * 60 * 1000);
    } finally { jest.useRealTimers(); }
  });
});
