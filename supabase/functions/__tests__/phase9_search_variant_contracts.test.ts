import {
  decodeVisionSearchVariantCompanion,
  parseSearchVariantProposalSidecar,
} from '../_shared/imageInventory/contracts';
import {
  authorField,
  kannadaVariantSidecar,
  languageScriptCases,
  proposal,
  searchVariantProvenance,
  sidecarForLanguageCase,
  titleField,
} from './fixtures/phase9/searchVariantFixtures';
import {
  observation,
  visionEnvelope,
  visionOne,
} from './fixtures/phase9/visionFixtures';

const decode = (sidecar: unknown) => decodeVisionSearchVariantCompanion(
  visionOne,
  sidecar,
);

describe('Phase 9 Unit 5C-1 companion isolation', () => {
  it('keeps the legacy p9-vision-v2 result valid when the sidecar is missing', () => {
    const decoded = decode(undefined);
    expect(decoded.vision).toMatchObject({
      schemaVersion: 'p9-vision-v2',
      observations: [{ ordinal: 1 }],
    });
    expect(decoded.searchVariantProposals).toEqual({
      status: 'missing',
      value: null,
    });
  });

  it.each([
    ['malformed', { ...kannadaVariantSidecar, titles: 'not-an-array' }],
    ['unsupported version', {
      ...kannadaVariantSidecar,
      schema_version: 'search_variant_proposals_v2',
    }],
    ['unknown fields', { ...kannadaVariantSidecar, inventory_id: 'forged' }],
    ['oversized', {
      ...kannadaVariantSidecar,
      titles: [titleField('ಅ'.repeat(70_000), 'kn', 'Knda', [])],
    }],
  ])('rejects a %s sidecar without invalidating ordinary vision', (_case, sidecar) => {
    const decoded = decode(sidecar);
    expect(decoded.vision.schemaVersion).toBe('p9-vision-v2');
    expect(decoded.searchVariantProposals).toEqual({
      status: 'rejected',
      value: null,
      reason: 'schema_invalid',
    });
  });

  it('accepts an empty proposal sidecar and does not force Romanization', () => {
    const decoded = decode({
      ...searchVariantProvenance,
      titles: [],
      authors: [],
    });
    expect(decoded.searchVariantProposals).toMatchObject({
      status: 'accepted',
      value: { titles: [], authors: [] },
    });
  });

  it('accepts a valid sidecar while preserving the independently parsed vision result', () => {
    const vision = visionEnvelope([observation(1, {
      title_guess: 'ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು',
      author_guesses: ['ಕೆ. ಶಿವರಾಮ ಕಾರಂತ', 'R. K. Narayan'],
      detected_language: 'kn',
    })]);
    const decoded = decodeVisionSearchVariantCompanion(
      vision,
      kannadaVariantSidecar,
    );
    expect(decoded.vision).toMatchObject({
      schemaVersion: 'p9-vision-v2',
      observations: [{ ordinal: 1 }],
    });
    expect(decoded.searchVariantProposals).toMatchObject({
      status: 'accepted',
      value: {
        schemaVersion: 'search_variant_proposals_v1',
        titles: [{ source: { field: 'observation:1:title' } }],
        authors: [
          { source: { field: 'observation:1:author:1' } },
          { source: { field: 'observation:1:author:2' } },
        ],
      },
    });
  });

  it('rejects mismatched analysis/model/prompt provenance independently', () => {
    for (const mismatch of [
      { analysis_reference: '93000000-0000-4000-8000-000000000099' },
      { model_key: 'different_model' },
      { prompt_version: 'different-prompt-v1' },
    ]) {
      expect(decode({ ...kannadaVariantSidecar, ...mismatch })
        .searchVariantProposals.status).toBe('rejected');
    }
  });
});

describe('Phase 9 Unit 5C-1 field contracts and limits', () => {
  it('keeps title and multiple author proposals independently source-scoped', () => {
    const parsed = parseSearchVariantProposalSidecar(kannadaVariantSidecar);
    expect(parsed.titles[0].source).toMatchObject({
      field: 'observation:1:title',
      text: 'ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು',
      language: 'kn',
      script: 'Knda',
    });
    expect(parsed.authors.map((entry) => entry.source.field)).toEqual([
      'observation:1:author:1',
      'observation:1:author:2',
    ]);
    expect(parsed.authors[0].proposals[0].text).toBe('K. Shivaram Karanth');
  });

  it('rejects mixed target fields, duplicate author sources, and wrong source ordinals', () => {
    const invalidSidecars = [
      {
        ...kannadaVariantSidecar,
        titles: [titleField('ಗೋದಾನ', 'kn', 'Knda', [], {
          source_field: 'observation:1:author:1',
        })],
      },
      {
        ...kannadaVariantSidecar,
        authors: [
          authorField(1, 'ಲೇಖಕ', 'kn', 'Knda', []),
          authorField(1, 'ಇನ್ನೊಬ್ಬ ಲೇಖಕ', 'kn', 'Knda', []),
        ],
      },
      {
        ...kannadaVariantSidecar,
        authors: [authorField(21, 'ಲೇಖಕ', 'kn', 'Knda', [])],
      },
    ];
    invalidSidecars.forEach((sidecar) => {
      expect(() => parseSearchVariantProposalSidecar(sidecar)).toThrow();
    });
  });

  it('supports independently scoped title/author fields across multiple observations', () => {
    const parsed = parseSearchVariantProposalSidecar({
      ...searchVariantProvenance,
      titles: [
        titleField('ಗೋದಾನ', 'kn', 'Knda', [proposal('primary_roman', 'Godaan')]),
        titleField('ಪರ್ವ', 'kn', 'Knda', [proposal('primary_roman', 'Parva')], {
          source_field: 'observation:2:title',
        }),
      ],
      authors: [
        authorField(1, 'ಪ್ರೇಮಚಂದ್', 'kn', 'Knda', [
          proposal('primary_roman', 'Premchand'),
        ]),
        authorField(1, 'ಎಸ್. ಎಲ್. ಭೈರಪ್ಪ', 'kn', 'Knda', [
          proposal('primary_roman', 'S. L. Bhyrappa'),
        ], { source_field: 'observation:2:author:1' }),
      ],
    });
    expect(parsed.titles.map(({ source }) => source.field)).toEqual([
      'observation:1:title',
      'observation:2:title',
    ]);
    expect(parsed.authors.map(({ source }) => source.field)).toEqual([
      'observation:1:author:1',
      'observation:2:author:1',
    ]);
  });

  it('rejects sidecars whose source association does not match vision evidence', () => {
    const decoded = decode({
      ...kannadaVariantSidecar,
      titles: [
        titleField('Unrelated source', 'en', 'Latn', [
          proposal('roman_alternative', 'Different title', { variant_language: 'en' }),
        ]),
      ],
      authors: [],
    });
    expect(decoded.searchVariantProposals.status).toBe('rejected');
  });

  it('enforces one primary, two alternatives, one translation, and bounded fields', () => {
    const field = titleField('ಗೋದಾನ', 'kn', 'Knda', [
      proposal('primary_roman', 'Godaan'),
      proposal('roman_alternative', 'Godan'),
      proposal('roman_alternative', 'Go Daan'),
      proposal('translation_candidate', 'The Gift of a Cow'),
    ]);
    expect(parseSearchVariantProposalSidecar({
      ...searchVariantProvenance,
      titles: [field],
      authors: [],
    }).titles[0].proposals).toHaveLength(4);

    for (const extra of [
      proposal('primary_roman', 'Godana'),
      proposal('roman_alternative', 'Godaana'),
      proposal('translation_candidate', 'Cow Gift'),
    ]) {
      expect(() => parseSearchVariantProposalSidecar({
        ...searchVariantProvenance,
        titles: [{ ...field, proposals: [...field.proposals, extra] }],
        authors: [],
      })).toThrow();
    }
  });

  it.each([
    ['', /empty/i],
    ['safe\u0007unsafe', /control/i],
    ['x'.repeat(257), /exceeds/i],
  ])('rejects unsafe or unbounded variant text %#', (variantText, error) => {
    expect(() => parseSearchVariantProposalSidecar({
      ...searchVariantProvenance,
      titles: [titleField('ಗೋದಾನ', 'kn', 'Knda', [
        proposal('primary_roman', variantText),
      ])],
      authors: [],
    })).toThrow(error);
  });
});

describe('Phase 9 Unit 5C-1 language and script validation', () => {
  it.each(languageScriptCases)(
    'accepts $language / $script source fields with provisional Roman forms',
    (entry) => {
      const parsed = parseSearchVariantProposalSidecar(sidecarForLanguageCase(entry));
      expect(parsed.titles[0].source).toMatchObject({
        language: entry.language,
        script: entry.script,
      });
    },
  );

  it('rejects malformed and conflicting language/script values safely', () => {
    for (const source of [
      titleField('ಗೋದಾನ', 'not_a_tag', 'Knda', []),
      titleField('ಗೋದಾನ', 'kn', 'knda', []),
      titleField('ಗೋದಾನ', 'kn', 'Taml', []),
      titleField('ಗೋದಾನ', 'kn-Taml', 'Knda', []),
      titleField('தமிழ்', 'ta', 'Knda', []),
    ]) {
      expect(() => parseSearchVariantProposalSidecar({
        ...searchVariantProvenance,
        titles: [source],
        authors: [],
      })).toThrow();
    }
  });

  it('rejects proposal language tags whose explicit script conflicts with the variant', () => {
    expect(() => parseSearchVariantProposalSidecar({
      ...searchVariantProvenance,
      titles: [titleField('ಗೋದಾನ', 'kn', 'Knda', [
        proposal('translation_candidate', 'The Gift of a Cow', {
          variant_language: 'en-Cyrl',
        }),
      ])],
      authors: [],
    })).toThrow();
  });

  it('keeps Urdu and Meitei Mayek proposals provisional with no activation fields', () => {
    for (const entry of languageScriptCases.filter(
      ({ language }) => language === 'ur' || language === 'mni',
    )) {
      const parsed = parseSearchVariantProposalSidecar(sidecarForLanguageCase(entry));
      expect(parsed.titles[0].proposals[0]).not.toHaveProperty('approvalStatus');
      expect(parsed.titles[0].proposals[0]).not.toHaveProperty('active');
    }
  });
});

describe('Phase 9 Unit 5C-1 normalization and deduplication', () => {
  it('removes source-identical and primary/alternate normalized duplicates', () => {
    const parsed = parseSearchVariantProposalSidecar(kannadaVariantSidecar);
    expect(parsed.titles[0].proposals.map(({ text }) => text)).toEqual([
      'Mookajjiya Kanasugalu',
      "Mookajji's Dreams",
    ]);
    expect(parsed.authors[1].proposals.map(({ text }) => text)).toEqual([
      'Rasipuram Krishnaswami Narayan',
    ]);
  });

  it('treats case, whitespace, punctuation, and initials as deterministic keys', () => {
    const sidecar = {
      ...searchVariantProvenance,
      titles: [],
      authors: [authorField(1, 'R. K. Narayan', 'en', 'Latn', [
        proposal('primary_roman', 'r k narayan', { variant_language: 'en' }),
        proposal('roman_alternative', 'R  K  Narayan', { variant_language: 'en' }),
        proposal('roman_alternative', 'Rasipuram Krishnaswami Narayan', {
          variant_language: 'en',
        }),
      ])],
    };
    const parsed = parseSearchVariantProposalSidecar(sidecar);
    expect(parsed.authors[0].source.deterministicSearchKey).toBe('r k narayan');
    expect(parsed.authors[0].proposals.map(({ text }) => text)).toEqual([
      'Rasipuram Krishnaswami Narayan',
    ]);
  });

  it('preserves source/variant script distinction and never deduplicates across fields', () => {
    const parsed = parseSearchVariantProposalSidecar({
      ...searchVariantProvenance,
      titles: [titleField('ಗೋದಾನ', 'kn', 'Knda', [
        proposal('primary_roman', 'Godaan', {
          variant_language: 'kn-Latn',
        }),
      ])],
      authors: [authorField(1, 'ಪ್ರೇಮಚಂದ್', 'kn', 'Knda', [
        proposal('roman_alternative', 'Godaan', { variant_language: 'kn-Latn' }),
      ])],
    });
    expect(parsed.titles[0].proposals[0]).toMatchObject({
      text: 'Godaan',
      script: 'Latn',
    });
    expect(parsed.authors[0].proposals[0].text).toBe('Godaan');
  });

  it('contains no persistence, inventory, publication, credential, or raw payload fields', () => {
    const serialized = JSON.stringify(parseSearchVariantProposalSidecar(
      kannadaVariantSidecar,
    ));
    for (const forbidden of [
      'inventory_id', 'listing_id', 'approval_status', 'approved_at',
      'credential', 'raw_payload', 'provider_response',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
