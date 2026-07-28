export const searchVariantProvenance = {
  contract_version: 'p9-contract-v1',
  schema_version: 'search_variant_proposals_v1',
  analysis_reference: '93000000-0000-4000-8000-000000000001',
  generation_source: 'recorded_fixture',
  provider_key: 'recorded_fixture',
  model_key: 'fixture_multimodal',
  model_version: '2026-07-26',
  prompt_version: 'fixture-prompt-v2',
} as const;

export const proposal = (
  variantType: 'primary_roman' | 'roman_alternative' | 'translation_candidate',
  variantText: string,
  overrides: Record<string, unknown> = {},
) => ({
  variant_text: variantText,
  variant_language: variantType === 'translation_candidate' ? 'en' : 'kn',
  variant_script: 'Latn',
  variant_type: variantType,
  ...overrides,
});

export const titleField = (
  sourceText: string,
  sourceLanguage: string,
  sourceScript: string,
  proposals: readonly unknown[],
  overrides: Record<string, unknown> = {},
) => ({
  source_field: 'observation:1:title',
  source_text: sourceText,
  source_language: sourceLanguage,
  source_script: sourceScript,
  proposals,
  ...overrides,
});

export const authorField = (
  ordinal: number,
  sourceText: string,
  sourceLanguage: string,
  sourceScript: string,
  proposals: readonly unknown[],
  overrides: Record<string, unknown> = {},
) => ({
  source_field: `observation:1:author:${ordinal}`,
  source_text: sourceText,
  source_language: sourceLanguage,
  source_script: sourceScript,
  proposals,
  ...overrides,
});

export const kannadaVariantSidecar = {
  ...searchVariantProvenance,
  titles: [
    titleField('ಮೂಕಜ್ಜಿಯ ಕನಸುಗಳು', 'kn', 'Knda', [
      proposal('primary_roman', 'Mookajjiya Kanasugalu'),
      proposal('roman_alternative', 'Mookajjiya Kanasugalu', {
        variant_language: 'kn-Latn',
      }),
      proposal('translation_candidate', "Mookajji's Dreams"),
    ]),
  ],
  authors: [
    authorField(1, 'ಕೆ. ಶಿವರಾಮ ಕಾರಂತ', 'kn', 'Knda', [
      proposal('primary_roman', 'K. Shivaram Karanth', {
        variant_language: 'kn-Latn',
      }),
    ]),
    authorField(2, 'R. K. Narayan', 'en', 'Latn', [
      proposal('primary_roman', 'r k narayan', { variant_language: 'en' }),
      proposal('roman_alternative', 'Rasipuram Krishnaswami Narayan', {
        variant_language: 'en',
      }),
    ]),
  ],
};

export const languageScriptCases = [
  {
    language: 'ta',
    script: 'Taml',
    source: 'பொன்னியின் செல்வன்',
    roman: 'Ponniyin Selvan',
  },
  {
    language: 'te',
    script: 'Telu',
    source: 'మహాప్రస్థానం',
    roman: 'Mahaprasthanam',
  },
  {
    language: 'ml',
    script: 'Mlym',
    source: 'രണ്ടാമൂഴം',
    roman: 'Randamoozham',
  },
  {
    language: 'hi',
    script: 'Deva',
    source: 'गोदान',
    roman: 'Godaan',
  },
  {
    language: 'ur',
    script: 'Arab',
    source: 'آگ کا دریا',
    roman: 'Aag Ka Darya',
  },
  {
    language: 'mni',
    script: 'Mtei',
    source: 'ꯃꯩꯇꯩ ꯂꯣꯟ',
    roman: 'Meitei Lon',
  },
] as const;

export function sidecarForLanguageCase(
  entry: typeof languageScriptCases[number],
) {
  return {
    ...searchVariantProvenance,
    titles: [
      titleField(entry.source, entry.language, entry.script, [
        proposal('primary_roman', entry.roman, {
          variant_language: `${entry.language}-Latn`,
        }),
      ]),
    ],
    authors: [],
  };
}
