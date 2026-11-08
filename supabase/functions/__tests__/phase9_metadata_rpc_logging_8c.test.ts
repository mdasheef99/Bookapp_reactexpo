import { observeMetadataRpc } from '../../../workers/phase9-runtime/metadataRpcLogging';
import { createJsonOperationalLogger } from '../../../workers/phase9-runtime/httpService';
import { metadataGatewayRpc } from '../_shared/imageInventory/runtime/metadataGatewayContext';
import { automaticRpc } from '../_shared/imageInventory/runtime/metadataAutomaticEditionFence';
import { createMetadataEditionOptionsBoundary } from '../_shared/imageInventory/runtime/metadataEditionOptionsRpc';
import { editionOptionsFence } from '../_shared/imageInventory/runtime/metadataEditionOptionsBoundary';
import { decodeMetadataJobContext } from '../_shared/imageInventory/runtime/metadataJobContext';
import { explicitContext, UUID_LINEAGE, worker, editionWorkerFixture } from './fixtures/phase9/editionOptionsWorker';
import { executeEditionOptionsLookup } from '../_shared/imageInventory/runtime/metadataEditionOptions';

describe('8c sanitized RPC failure events', () => {
  it.each(['returned', 'thrown'] as const)('logs each %s submission once without changing its error', async kind => {
    for (const error of [
      { code: '57014', message: 'cancelled sensitive text', details: 'body-secret' },
      { code: 'P0001', message: 'P9_PROVIDER_RUN_NOT_ADMITTED', hint: 'lease-secret' },
    ]) {
      const lines: string[] = [];
      const result = { data: null, error };
      const client = observeMetadataRpc({ rpc: async () => {
        if (kind === 'thrown') throw error;
        return result;
      } }, { jobId: UUID_LINEAGE.jobId, attempt: 2 }, createJsonOperationalLogger(line => lines.push(line)));
      const submission = client.rpc('phase9_register_metadata_provider_call', {
        p_lease_token: 'lease-secret', p_body: 'body-secret', email: 'private@example.invalid',
      });
      if (kind === 'thrown') await expect(submission).rejects.toBe(error);
      else expect(await submission).toBe(result);
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toMatchObject({ event: 'metadata_rpc_failed',
        rpc: 'phase9_register_metadata_provider_call', sqlstate: error.code,
        jobId: UUID_LINEAGE.jobId, attempt: 2, stage: 'registration', submissionKind: kind });
      for (const secret of ['lease-secret', 'body-secret', 'private@example.invalid',
        'p_lease_token', 'cancelled sensitive text']) expect(lines.join('')).not.toContain(secret);
    }
  });
  it('allows only exact safe identifiers, never arbitrary P9-prefixed messages', async () => {
    const events: any[] = [];
    const client = observeMetadataRpc({ rpc: async () => ({ data: null,
      error: { code: 'P0001', message: 'P9_PROVIDER_RUN_NOT_ADMITTED user text secret' } }) },
    { jobId: null, attempt: null }, event => events.push(event));
    await client.rpc('claim_phase9_metadata_jobs', {});
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ safeErrorCode: null, jobId: null, attempt: null, stage: 'claim' });
    expect(JSON.stringify(events)).not.toContain('secret');
  });
  it('observes gateway, automatic and direct completion submissions at the same boundary', async () => {
    const events: any[] = [];
    const error = { code: '57014', message: 'secret' };
    const client = observeMetadataRpc({ rpc: async () => ({ data: null, error }) },
      { jobId: UUID_LINEAGE.jobId, attempt: 1 }, event => events.push(event));
    await expect(metadataGatewayRpc(client, 'phase9_provider_configuration_v1', {})).rejects.toThrow();
    await expect(automaticRpc(client, 'phase9_recover_automatic_metadata_v1', {})).rejects.toThrow();
    const context = decodeMetadataJobContext({ ...explicitContext, ...UUID_LINEAGE });
    await expect(createMetadataEditionOptionsBoundary(client).complete({ ...editionOptionsFence(context, worker),
      lookupId: UUID_LINEAGE.inputId, attemptId: UUID_LINEAGE.observationId,
      sourceFetchedAt: new Date().toISOString(), optionsExpiresAt: new Date(Date.now() + 60000).toISOString(),
      storagePermissionVerified: true, rows: [] })).rejects.toThrow();
    expect(events.map(event => event.rpc)).toEqual(['phase9_provider_configuration_v1',
      'phase9_recover_automatic_metadata_v1', 'phase9_complete_candidate_edition_options_v2']);
  });
  it('keeps three concurrent claims correlated and logs every failed replay submission', async () => {
    const events: any[] = [];
    const error = { code: '57014' };
    await Promise.all([1, 2, 3].map(async attempt => {
      const jobId = UUID_LINEAGE.jobId.slice(0, -1) + attempt;
      const client = observeMetadataRpc({ rpc: async () => ({ data: null, error }) },
        { jobId, attempt }, event => events.push(event));
      for (let replay = 0; replay < 2; replay++) await client.rpc('phase9_finalize_metadata_provider_call', {});
    }));
    expect(events).toHaveLength(6);
    for (const attempt of [1, 2, 3]) expect(events.filter(event => event.attempt === attempt))
      .toEqual([expect.objectContaining({ jobId: UUID_LINEAGE.jobId.slice(0, -1) + attempt }),
        expect.objectContaining({ jobId: UUID_LINEAGE.jobId.slice(0, -1) + attempt })]);
  });
  it('ignores a failing logger and preserves transport error identity', async () => {
    const error = new Error('transport secret');
    const client = observeMetadataRpc({ rpc: async () => { throw error; } },
      { jobId: null, attempt: null }, () => { throw new Error('logger failure'); });
    await expect(client.rpc('phase9_metadata_job_context', {})).rejects.toBe(error);
  });
  it('allowlists exact explicit SQL refusals and rejects invalid SQLSTATE', async () => {
    for (const message of ['P9_PROVIDER_CAPACITY_WAIT', 'P9_METADATA_PROVIDER_DISABLED',
      'P9_METADATA_SECONDARY_NOT_ELIGIBLE', 'P9_METADATA_USAGE_RESERVATION_REQUIRED']) {
      const events: any[] = [];
      const client = observeMetadataRpc({ rpc: async () => ({ data: null,
        error: { code: 'P0001', message } }) }, { jobId: null, attempt: null }, event => events.push(event));
      await client.rpc('phase9_release_metadata_provider_round_v1', {});
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ safeErrorCode: message, stage: 'release', sqlstate: 'P0001' });
    }
    const events: any[] = [];
    const client = observeMetadataRpc({ rpc: async () => ({ data: null,
      error: { code: 'abc', message: 'P9_PROVIDER_RUN_NOT_ADMITTED' } }) },
    { jobId: null, attempt: null }, event => events.push(event));
    await client.rpc('phase9_metadata_job_context', {});
    expect(events[0]).toMatchObject({ sqlstate: null,
      safeErrorCode: 'P9_PROVIDER_RUN_NOT_ADMITTED', stage: 'context' });
  });
  it('observes claim, context, failure and cleanup boundaries with nullable correlation', async () => {
    const events: any[] = [];
    const error = { code: '57014', message: 'secret' };
    const client = observeMetadataRpc({ rpc: async () => ({ data: null, error }) },
      { jobId: null, attempt: null }, event => events.push(event));
    for (const name of ['claim_phase9_metadata_jobs', 'phase9_metadata_job_context',
      'phase9_fail_candidate_edition_options_v1', 'phase9_resolve_superseded_edition_job_v1']) {
      await client.rpc(name, {});
    }
    expect(events.map(event => [event.rpc, event.stage, event.jobId, event.attempt])).toEqual([
      ['claim_phase9_metadata_jobs', 'claim', null, null],
      ['phase9_metadata_job_context', 'context', null, null],
      ['phase9_fail_candidate_edition_options_v1', 'failure', null, null],
      ['phase9_resolve_superseded_edition_job_v1', 'cleanup', null, null],
    ]);
    expect(JSON.stringify(events)).not.toContain('secret');
  });
  it('keeps explicit results and GET counts identical with and without observation', async () => {
    const run = async (observed: boolean) => {
      const fixture = editionWorkerFixture();
      fixture.useUuidLineage();
      if (observed) {
        const base = fixture.dependencies.serviceClient.rpc;
        const logged = observeMetadataRpc({ rpc: base },
          { jobId: UUID_LINEAGE.jobId, attempt: 1 }, () => {});
        // The fixture setter expects a function; never pass the client object itself.
        fixture.dependencies.serviceClient.rpc = (name: string, p: Record<string, unknown>) =>
          logged.rpc(name, p);
      }
      const { context, gateway } = fixture.direct();
      const result = await executeEditionOptionsLookup(context, gateway, fixture.adapter,
        new AbortController().signal);
      return { result, gets: fixture.stats().providerRequests };
    };
    expect(await run(true)).toEqual(await run(false));
  });
});
