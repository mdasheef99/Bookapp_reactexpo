// 02c §§4.3/9; 02c-1 §2; Unit C K2-K6/P2: real automatic worker, RPC receipts only.
import { automaticDependencies, JOB_ID } from './support/automaticWorker';

const deferRpc = 'phase9_defer_paused_metadata_admission_v1';
const paused = { data: null, error: { message: 'P9_EXTERNAL_ADMISSION_PAUSED', code: 'P0001' } };
const ok = (data: unknown) => ({ data, error: null });
const names = (subject: ReturnType<typeof automaticDependencies>) => subject.fixture.calls.map(c => c.name);
function noTerminal(subject: ReturnType<typeof automaticDependencies>) {
  expect(names(subject)).not.toContain('phase9_fail_metadata_job');
  expect(names(subject)).not.toContain('phase9_complete_automatic_metadata_v1');
  expect(subject.gets()).toBe(0);
}

describe('8c pause deferral through the installed automatic worker (index.ts)', () => {
  // Mutation: remove pause branch or omit/cross the existing claim fence.
  it('W1 defers a pause before begin exactly once, with the prepared fence', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_prepare_automatic_metadata_v1'
      ? paused : name === deferRpc ? ok({ status: 'deferred', blockedEpoch: 3 }) : undefined });
    expect((await subject.run()).results).toEqual([{ outcome: 'retry_scheduled' }]);
    const calls = subject.fixture.calls;
    expect(calls.filter(c => c.name === deferRpc)).toHaveLength(1);
    expect(calls.find(c => c.name === deferRpc)!.parameters).toEqual({
      f: calls.find(c => c.name === 'phase9_prepare_automatic_metadata_v1')!.parameters.f,
    });
    expect(calls.find(c => c.name === deferRpc)!.parameters.f.jobId).toBe(JOB_ID);
    noTerminal(subject);
  });
  // Mutation: decide eligibility from runStarted in TypeScript instead of asking SQL.
  it('W2 asks SQL after begin committed and reserve/registration meets the pause', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_register_metadata_provider_call'
      ? paused : name === deferRpc ? ok({ status: 'drain_required' }) : undefined });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(names(subject).filter(n => n === deferRpc)).toHaveLength(1);
    expect(subject.fixture.calls.find(c => c.name === 'phase9_fail_metadata_job')!.parameters)
      .toMatchObject({ p_failure_kind: 'policy_denied', p_retryable: false });
    expect(names(subject)).not.toContain('phase9_complete_automatic_metadata_v1');
    expect(subject.gets()).toBe(0);
  });
  // Mutation: return stale_claim on reopen conflict; index.ts then terminalizes a valid lease.
  it('W3 reopen conflict returns manual through the real batch without fail/complete', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_prepare_automatic_metadata_v1'
      ? paused : name === deferRpc ? { data: null, error: { message: 'P9_STATE_CONFLICT', code: 'P0001' } } : undefined });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(names(subject).filter(n => n === deferRpc)).toHaveLength(1);
    noTerminal(subject);
  });
  // Mutation: trust a message without SQLSTATE; unknown rollback must remain recovery-only.
  it('W4 message-only pause is uncertain and makes no defer or terminal call', async () => {
    const subject = automaticDependencies({ rpc: async name => name === 'phase9_prepare_automatic_metadata_v1'
      ? { data: null, error: { message: 'P9_EXTERNAL_ADMISSION_PAUSED' } } : undefined });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(names(subject)).not.toContain(deferRpc);
    noTerminal(subject);
  });
  // Mutation: fail/requeue on a lost response or malformed receipt after SQL may have committed.
  it.each(['lost', 'thrown', 'malformed', 'unknown refusal'])('W5/6 %s defer stays uncertain', async mode => {
    const subject = automaticDependencies({ rpc: async name => {
      if (name === 'phase9_prepare_automatic_metadata_v1') return paused;
      if (name !== deferRpc) return undefined;
      if (mode === 'thrown') throw new Error('lost');
      if (mode === 'lost') return { data: null, error: { message: 'lost' } };
      if (mode === 'unknown refusal') return { data: null, error: { message: 'P9_REQUEST_INVALID', code: 'P0001' } };
      return ok({ status: 'deferred' });
    } });
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    expect(names(subject).filter(n => n === deferRpc)).toHaveLength(1);
    noTerminal(subject);
  });
  // Mutation: stop at finalized instead of completing R3's no-retry technical result.
  it('W7 beyond-bound Retry-After continues from finalized to automatic completion', async () => {
    const subject = automaticDependencies({ fetcher: async () => new Response('', {
      status: 429, headers: { 'retry-after': '120' },
    }), rpc: async name => name === 'phase9_finish_automatic_provider_run_v1'
      ? ok({ status: 'finalized', round: 0 }) : undefined });
    const before = Date.now();
    expect((await subject.run()).results).toEqual([{ outcome: 'manual_metadata_required' }]);
    const calls = subject.fixture.calls;
    const finish = calls.find(c => c.name === 'phase9_finish_automatic_provider_run_v1')!;
    expect(Date.parse(finish.parameters.p_not_before)).toBeGreaterThanOrEqual(before + 120000);
    expect(names(subject).indexOf('phase9_complete_automatic_metadata_v1')).toBeGreaterThan(calls.indexOf(finish));
    expect(subject.command()!.result.outcome).toMatchObject({ outcome: 'rate_limited', retryable: true });
    expect(names(subject)).not.toContain('phase9_fail_metadata_job');
    expect(subject.gets()).toBe(1);
  });
});
