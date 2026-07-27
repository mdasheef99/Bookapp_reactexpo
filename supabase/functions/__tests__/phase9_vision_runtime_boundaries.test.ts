import fs from 'node:fs';
import path from 'node:path';
import { handlePhase9VisionAnalysisWorker } from '../../../workers/phase9-vision-analysis-worker';

const rpc = jest.fn();
const dependencies: any = {
  workerId: 'vision-worker-0000000001',
  workerAuthToken: 'valid-vision-worker-secret-A7z.49_xYp-001',
  serviceClient: { rpc },
  analyzer: { analyze: jest.fn() },
};
const claim = {
  id: '94000000-0000-4000-8000-000000000001',
  attempt_count: 1,
  lease_token: 'a'.repeat(64),
};
const context = {
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-vision-v2',
  pipeline_version: 'phase9-v1',
  prompt_version: 'fixture-prompt-v2',
  adapter_key: 'fixture_adapter',
  adapter_version: '1.0.0',
  job_reference: 'job_fixture_reference_0001',
  correlation_id: '93000000-0000-4000-8000-000000000001',
  expected_language: 'en',
  sanitized_media_reference: 'media_fixture_reference_0001',
};

beforeEach(() => jest.resetAllMocks());

describe('Phase 9 vision runtime boundaries', () => {
  it('authenticates the dedicated worker before any claim', async () => {
    const denied = await handlePhase9VisionAnalysisWorker(
      new Request('http://worker/run', {
        method: 'POST',
        body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
      }),
      dependencies,
    );
    expect(denied.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ data: [], error: null });
    const accepted = await handlePhase9VisionAnalysisWorker(
      new Request('http://worker/run', {
        method: 'POST',
        headers: { authorization: `Bearer ${dependencies.workerAuthToken}` },
        body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
      }),
      dependencies,
    );
    expect(accepted.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('claim_phase9_vision_jobs', {
      p_batch_size: 1,
      p_worker: dependencies.workerId,
    });
  });

  it('keeps an unknown resolved claim error bounded and permanent', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'private upstream connection detail' },
    });
    const failed = await handlePhase9VisionAnalysisWorker(
      new Request('http://worker/run', {
        method: 'POST',
        headers: { authorization: `Bearer ${dependencies.workerAuthToken}` },
        body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
      }),
      dependencies,
    );
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({
      error: 'P9_VISION_INTERNAL_PERMANENT',
    });
  });

  it('returns a retryable bounded response when the claim promise rejects', async () => {
    rpc.mockRejectedValueOnce(new Error('private rejected transport detail'));
    const failed = await handlePhase9VisionAnalysisWorker(
      new Request('http://worker/run', {
        method: 'POST',
        headers: { authorization: `Bearer ${dependencies.workerAuthToken}` },
        body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
      }),
      dependencies,
    );
    expect(failed.status).toBe(503);
    await expect(failed.json()).resolves.toEqual({
      error: 'P9_VISION_DATABASE_RETRYABLE',
    });
  });

  it.each([
    ['P9_STATE_CONFLICT', 409],
    ['P9_OWNER_NOT_AUTHORIZED', 403],
    ['P9_MEDIA_NOT_APPROVED', 409],
    ['P9_VISION_SCHEMA_INVALID', 422],
    ['P9_VISION_PERSISTENCE_CONFLICT', 409],
    ['private unknown database detail', 500],
  ])('keeps endpoint RPC error %s bounded with HTTP %i', async (message, status) => {
    rpc.mockResolvedValueOnce({ data: null, error: { message } });
    const failed = await handlePhase9VisionAnalysisWorker(
      new Request('http://worker/run', {
        method: 'POST',
        headers: { authorization: `Bearer ${dependencies.workerAuthToken}` },
        body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
      }),
      dependencies,
    );
    expect(failed.status).toBe(status);
    const body = await failed.json();
    expect(body.error).toMatch(/^P9_[A-Z0-9_]+$/);
    expect(JSON.stringify(body)).not.toContain('private unknown database detail');
  });

  it('returns bounded endpoint results for relationship and malformed-analyzer failures', async () => {
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({
        data: {
          outcome: 'relationship_reconciliation_required',
          safe_error_code: 'P9_VISION_RELATIONSHIP_RECONCILIATION_REQUIRED',
        },
        error: null,
      });
    let handled = await handlePhase9VisionAnalysisWorker(
      new Request('http://worker/run', {
        method: 'POST',
        headers: { authorization: `Bearer ${dependencies.workerAuthToken}` },
        body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
      }),
      dependencies,
    );
    expect(handled.status).toBe(200);
    expect(await handled.json()).toEqual({
      claimed: 1,
      results: [{ outcome: 'relationship_reconciliation_required' }],
    });

    rpc.mockReset();
    dependencies.analyzer.analyze.mockResolvedValueOnce({ observations: null });
    rpc
      .mockResolvedValueOnce({ data: [claim], error: null })
      .mockResolvedValueOnce({ data: context, error: null })
      .mockResolvedValueOnce({ data: 'resolved', error: null });
    handled = await handlePhase9VisionAnalysisWorker(
      new Request('http://worker/run', {
        method: 'POST',
        headers: { authorization: `Bearer ${dependencies.workerAuthToken}` },
        body: JSON.stringify({ contractVersion: 'phase9-v1', batchSize: 1 }),
      }),
      dependencies,
    );
    expect(handled.status).toBe(200);
    expect(await handled.json()).toEqual({
      claimed: 1,
      results: [{ jobId: claim.id, outcome: 'resolved' }],
    });
  });

  it('V4-Q01 keeps fixture and real-provider boundaries free of metadata/product effects', () => {
    const fixtureFiles = [
      'supabase/functions/_shared/imageInventory/analysis/fixtureSpineImageAnalyzer.ts',
      'supabase/functions/_shared/imageInventory/domain/visionPolicy.ts',
      'supabase/functions/_shared/imageInventory/runtime/visionAnalysisWorker.ts',
      'workers/phase9-vision-analysis-worker/index.ts',
    ];
    const fixtureSource = fixtureFiles
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')).join('\n');
    expect(fixtureSource).not.toMatch(
      /google_books|open_library|gemini|openai|fetch\s*\(|metadata_enrichment/i,
    );
    const geminiFiles = [
      'supabase/functions/_shared/imageInventory/analysis/geminiSpineImageAnalyzer.ts',
      'workers/phase9-vision-analysis-worker/bootstrap.ts',
      'workers/phase9-vision-analysis-worker/supabaseVisionMediaResolver.ts',
    ];
    const geminiSource = geminiFiles
      .map((file) => fs.readFileSync(path.join(process.cwd(), file), 'utf8')).join('\n');
    expect(geminiSource).not.toMatch(/google_books|open_library|openai|metadata_enrichment/i);
    expect(`${fixtureSource}\n${geminiSource}`).not.toMatch(
      /store_inventory|marketplace_book_listings|publish(?:ing|_listing)/i,
    );
  });

  it('V4-S03 does not expose private media or provider payload fields in runtime DTOs', () => {
    const source = fs.readFileSync(path.join(
      process.cwd(),
      'supabase/functions/_shared/imageInventory/runtime/visionAnalysisWorker.ts',
    ), 'utf8');
    expect(source).not.toMatch(/signed_url|storage_path|object_path|raw_response|raw_provider|lease_token_hash/i);
    expect(source).not.toMatch(/image_bytes|base64|exif|gps/i);
  });
});
