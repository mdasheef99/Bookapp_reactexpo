import { automaticDependencies, completedReceipt } from './support/automaticWorker';
import { GOLDEN_ATTEMPT_ID, GOLDEN_LOOKUP_ID } from './fixtures/phase9/providerReplacementGoldens';

describe('U5 original-fence recovery (02c §4.3)', () => {
  // Mutation caught: a lost committed completion triggers another GET or generic fail RPC.
  it('recovers the original command before any context reload', async () => {
    let command: Record<string, any>;
    const subject = automaticDependencies({ rpc: async (name, p) => {
      if (name === 'phase9_complete_automatic_metadata_v1') {
        command = p.p_command;
        return { data: null, error: { message: 'lost response' } };
      }
      if (name === 'phase9_recover_automatic_metadata_v1' && command!) {
        return { data: { ...completedReceipt(command), status: 'replayed' }, error: null };
      }
      return undefined;
    } });
    expect((await subject.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(subject.gets()).toBe(1);
    const calls = subject.fixture.calls;
    const complete = calls.findIndex(call => call.name === 'phase9_complete_automatic_metadata_v1');
    expect(complete).toBeGreaterThan(0);
    expect(calls[complete + 1].name).toBe('phase9_recover_automatic_metadata_v1');
    expect(calls[complete + 1].parameters.p_fence).toEqual(command!.fence);
    expect(calls.map(call => call.name)).not.toContain('phase9_fail_metadata_job');
  });
  // Mutation caught: finish replay regenerates Retry-After or issues another GET after losing its response.
  it('replays an uncertain finish with exactly the original arguments', async () => {
    let finishes = 0;
    const subject = automaticDependencies({ fetcher: async () => new Response('', { status: 429,
      headers: { 'retry-after': '120' } }), rpc: async name => {
      if (name !== 'phase9_finish_automatic_provider_run_v1') return undefined;
      finishes += 1;
      return finishes === 1 ? { data: null, error: { message: 'lost finish' } }
        : { data: { status: 'retry_scheduled', round: 0, dueAt: new Date().toISOString() }, error: null };
    } });
    expect((await subject.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    expect(subject.gets()).toBe(1);
    const calls = subject.fixture.calls.filter(call => call.name === 'phase9_finish_automatic_provider_run_v1');
    expect(calls).toHaveLength(2);
    expect(calls[0].parameters.p_not_before).not.toBeNull();
    expect(calls[1].parameters).toEqual(calls[0].parameters);
    expect(subject.command()).toBeNull();
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_fail_metadata_job');
  });
  // Mutation caught: a sibling receipt is adopted as this job's completion.
  it('refuses another job receipt and a malformed receipt without another GET', async () => {
    let command: Record<string, any>;
    const sibling = automaticDependencies({ rpc: async (name, p) => {
      if (name === 'phase9_complete_automatic_metadata_v1') {
        command = p.p_command;
        return { data: null, error: { message: 'lost response' } };
      }
      if (name === 'phase9_recover_automatic_metadata_v1') {
        return { data: { ...completedReceipt(command),
          lookupId: '00000000-0000-4000-8000-000000000099', status: 'replayed' }, error: null };
      }
      return undefined;
    } });
    expect((await sibling.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(sibling.gets()).toBe(1);
    expect(sibling.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_cache');
    const malformed = automaticDependencies({ rpc: async name =>
      name === 'phase9_complete_automatic_metadata_v1'
        ? { data: null, error: { message: 'lost response' } }
        : name === 'phase9_recover_automatic_metadata_v1'
          ? { data: { status: 'replayed' }, error: null } : undefined });
    expect((await malformed.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(malformed.gets()).toBe(1);
    expect(malformed.fixture.calls.map(call => call.name)).not.toContain('phase9_store_metadata_cache');
  });
  // H1: evidence without a run-row lineage must terminalize, never re-claim forever.
  it('terminalizes persisted evidence with no run lineage and sends no GET', async () => {
    const subject = automaticDependencies({ context: {
      currentLookupId: GOLDEN_LOOKUP_ID, currentLookupAdapterKey: 'google_books',
      currentLookupAdapterVersion: '1.0.0', currentAttemptId: GOLDEN_ATTEMPT_ID,
      currentAttemptAdapterKey: 'google_books', currentAttemptDisposition: 'unresolved',
    } });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    const names = subject.fixture.calls.map(call => call.name);
    expect(names).toContain('phase9_recover_automatic_metadata_v1');
    expect(names).not.toContain('phase9_prepare_automatic_metadata_v1');
    expect(names).not.toContain('phase9_complete_automatic_metadata_v1');
    expect(subject.fixture.calls.some(call => call.name === 'phase9_fail_metadata_job'
      && call.parameters.p_failure_kind === 'policy_denied')).toBe(true);
  });
  // Mutation caught: restarted partial lineage manufactures a fresh route or reconstructs a lost retained list.
  it('refuses partial historical evidence while a fresh claim still executes', async () => {
    const subject = automaticDependencies({ context: { currentLookupId: '00000000-0000-4000-8000-000000000099' } });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(subject.gets()).toBe(0);
    expect(subject.fixture.calls.map(call => call.name)).toContain('phase9_recover_automatic_metadata_v1');
    expect(subject.fixture.calls.map(call => call.name)).not.toContain('phase9_prepare_automatic_metadata_v1');
    expect(subject.fixture.calls.some(call => call.name === 'phase9_fail_metadata_job'
      && call.parameters.p_failure_kind === 'policy_denied')).toBe(true);
    const positive = automaticDependencies();
    expect((await positive.run()).results).toEqual([{ outcome: 'accepted_metadata_match' }]);
    expect(positive.gets()).toBe(1);
  });
});
