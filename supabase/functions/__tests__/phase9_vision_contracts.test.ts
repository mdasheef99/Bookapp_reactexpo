import { createVisionRequest, parseVisionResult, shouldUseVisionFallback } from '../_shared/imageInventory/contracts';
import {
  visionAcceptedWrongLanguage,
  visionActiveContent,
  visionFifteen,
  visionInvalidIsbnClue,
  visionMalformedGeometry,
  visionNoBooks,
  visionOne,
  visionOversizedAuthors,
  visionOversizedTitle,
  visionPromptInjection,
  visionRepeatedSpines,
  visionSixteen,
  visionUnknownAuthorityField,
  visionWrongLanguage,
} from './fixtures/phase9/visionFixtures';

describe('Phase 9 vision contract', () => {
  it('accepts one and fifteen ordered spine candidates', () => {
    expect(parseVisionResult(visionOne).candidates).toHaveLength(1);
    expect(parseVisionResult(visionFifteen).candidates).toHaveLength(15);
  });

  it('builds a server-owned spine-stack request with English default and no authority fields', () => {
    const request = createVisionRequest({
      adapterKey: 'fixture_adapter',
      adapterVersion: '1.0.0',
      correlationId: 'fixture-correlation-0001',
      attemptId: 'fixture-attempt-0001',
      requestedAt: '2026-07-19T00:00:00.000Z',
      sanitizedMediaReference: 'media_fixture_reference_0001',
      taskVersion: 'fixture-task-v1',
    });
    expect(request).toMatchObject({ selectedLanguage: 'en', batchType: 'spine_stack', maxCandidates: 15 });
    expect(request).not.toHaveProperty('store_id');
    expect(request).not.toHaveProperty('actor_id');
    expect(request).not.toHaveProperty('storage_path');
  });

  it('rejects the entire 16-candidate result without truncation', () => {
    expect(() => parseVisionResult(visionSixteen)).toThrow(/over candidate limit/i);
  });

  it('keeps repeated observed spines as separate candidates', () => {
    const parsed = parseVisionResult(visionRepeatedSpines);
    expect(parsed.candidates).toHaveLength(2);
    expect(parsed.candidates[0].title).toBe(parsed.candidates[1].title);
  });

  it('treats no-books as terminal and never fallback eligible', () => {
    expect(parseVisionResult(visionNoBooks).outcome).toBe('no_books');
    expect(shouldUseVisionFallback('no_books', 0)).toBe(false);
  });

  it('represents wrong selected language as terminal and rejects mixed accepted output', () => {
    expect(parseVisionResult(visionWrongLanguage).outcome).toBe('wrong_language');
    expect(() => parseVisionResult(visionAcceptedWrongLanguage)).toThrow(/selected language batch/i);
  });

  it('allows only one whole-image fallback for typed technical outcomes', () => {
    expect(shouldUseVisionFallback('technical_failure', 0)).toBe(true);
    expect(shouldUseVisionFallback('schema_invalid', 1)).toBe(false);
    expect(shouldUseVisionFallback('wrong_language', 0)).toBe(false);
  });

  it('rejects image-borne active instructions and authority fields', () => {
    expect(() => parseVisionResult(visionPromptInjection)).toThrow(/active or operational content/i);
    expect(() => parseVisionResult(visionUnknownAuthorityField)).toThrow(/unknown keys: store_id/i);
  });

  it.each(visionActiveContent)('rejects URL, Markdown, SQL, HTML, path, or command-shaped active content', (fixture) => {
    expect(() => parseVisionResult(fixture)).toThrow(/active or operational content/i);
  });

  it('rejects oversized arrays/strings, malformed geometry, and invalid ISBN clues', () => {
    expect(() => parseVisionResult(visionOversizedTitle)).toThrow(/exceeds 512/i);
    expect(() => parseVisionResult(visionOversizedAuthors)).toThrow(/at most 20/i);
    expect(() => parseVisionResult(visionMalformedGeometry)).toThrow(/outside the normalized image/i);
    expect(() => parseVisionResult(visionInvalidIsbnClue)).toThrow(/non-ISBN clue/i);
  });

  it('rejects nested tool/command authority keys and oversized raw output', () => {
    const withTool = { ...visionOne, candidates: [{ ...visionOne.candidates[0], tool_call: { name: 'write_inventory' } }] };
    expect(() => parseVisionResult(withTool)).toThrow(/unknown keys: tool_call/i);
    expect(() => parseVisionResult({ ...visionOne, warnings: ['x'.repeat(262145)] })).toThrow(/exceeds 262144 bytes/i);
  });
});
