import {
  parseAutomatedAliasResult,
  parseRetainedAliasRows,
  parseMetadataAdapterResult,
  parseMetadataEdition,
  metadataSelectionOutcome,
  selectCoherentEdition,
} from '../_shared/imageInventory/contracts';
import { hindiAliasResult, retainedAliasRows } from './fixtures/phase9/aliasFixtures';
import { coherentEnglishEdition, conflictingHindiEdition, providerNoMatch } from './fixtures/phase9/metadataFixtures';

describe('Phase 9 metadata and alias contracts', () => {
  it('keeps one coherent metadata edition with validated ISBN-10 and ISBN-13', () => {
    const english = parseMetadataEdition(coherentEnglishEdition);
    const hindi = parseMetadataEdition(conflictingHindiEdition);
    const selected = selectCoherentEdition([english, hindi], 1);
    expect(selected.title).toBe('गोदान');
    expect(selected.publisher).toBe('दूसरा परीक्षण प्रकाशक');
    expect(selected.isbn13).toBeNull();
  });

  it('rejects inconsistent ISBN pairs', () => {
    expect(() => parseMetadataEdition({ ...coherentEnglishEdition, isbn13: '9781861972712' })).toThrow(/different editions/i);
  });

  it('accepts HTTPS cover references but rejects insecure or credential-bearing URLs', () => {
    const hostPolicy = { adapterKey: 'recorded_metadata', policyVersion: '1', approvedCoverHosts: ['covers.example.invalid'] };
    expect(parseMetadataEdition({ ...coherentEnglishEdition, cover_reference: 'https://covers.example.invalid/book.jpg' }, hostPolicy).coverReference).toMatch(/^https:/u);
    expect(() => parseMetadataEdition({ ...coherentEnglishEdition, cover_reference: 'https://covers.example.invalid/book.jpg' })).toThrow(/provider-host policy/i);
    expect(() => parseMetadataEdition({ ...coherentEnglishEdition, cover_reference: 'https://unapproved.example.invalid/book.jpg' }, hostPolicy)).toThrow(/host is not approved/i);
    expect(() => parseMetadataEdition({ ...coherentEnglishEdition, cover_reference: 'http://covers.example.invalid/book.jpg' })).toThrow(/cover_reference/i);
    expect(() => parseMetadataEdition({ ...coherentEnglishEdition, cover_reference: 'https://user:secret@covers.example.invalid/book.jpg' }, hostPolicy)).toThrow(/credentials/i);
  });

  it('accepts three provenance-bearing search-only automated aliases', () => {
    const parsed = parseAutomatedAliasResult(hindiAliasResult);
    expect(parsed.aliases).toHaveLength(3);
    expect(parsed.aliases.every((alias) => alias.searchOnly)).toBe(true);
  });

  it('rejects a fourth automated alias and unknown authority keys', () => {
    const fourth = { ...hindiAliasResult.aliases[0], text: 'Fourth Alias' };
    expect(() => parseAutomatedAliasResult({ ...hindiAliasResult, aliases: [...hindiAliasResult.aliases, fourth] })).toThrow(/at most three/i);
    expect(() => parseAutomatedAliasResult({ ...hindiAliasResult, canonical_edition_id: 'forged' })).toThrow(/unknown keys/i);
    expect(() => parseAutomatedAliasResult({
      ...hindiAliasResult,
      aliases: [{ ...hindiAliasResult.aliases[0], language: 'hi-Deva' }],
    })).toThrow(/English\/Latin-script/i);
  });

  it('allows bounded official and Owner-verified aliases to coexist as search-only provenance', () => {
    const retained = parseRetainedAliasRows(retainedAliasRows);
    expect(retained.map((alias) => alias.sourceType)).toEqual(['automated', 'provider_official', 'owner_verified']);
    expect(retained.every((alias) => alias.searchOnly)).toBe(true);
  });

  it('represents provider no-match without canonical pollution', () => {
    expect(parseMetadataAdapterResult(providerNoMatch)).toMatchObject({ outcome: 'provider_no_match', candidates: [] });
    expect(metadataSelectionOutcome([], null)).toEqual({ outcome: 'provider_no_match', edition: null, canonicalEditionId: null });
  });
});
