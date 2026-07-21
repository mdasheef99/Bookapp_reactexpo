export const hindiAliasResult = {
  contract_version: 'p9-contract-v1',
  schema_version: 'p9-alias-v1',
  adapter_key: 'recorded_alias',
  adapter_version: '1.0.0',
  correlation_id: 'fixture-correlation-0001',
  attempt_id: 'fixture-alias-attempt-0001',
  generated_at: '2026-07-19T00:00:00.000Z',
  aliases: [
    { text: 'Godaan', language: 'en-Latn', kind: 'transliteration', source: 'recorded_fixture', source_version: '1.0.0', confidence: 0.9, approval_status: 'proposed' },
    { text: 'The Gift of a Cow', language: 'en-Latn', kind: 'translation', source: 'recorded_fixture', source_version: '1.0.0', confidence: 0.7, approval_status: 'proposed' },
    { text: 'Godan', language: 'en-Latn', kind: 'common_spelling', source: 'recorded_fixture', source_version: '1.0.0', confidence: 0.85, approval_status: 'proposed' },
  ],
};

export const retainedAliasRows = [
  { ...hindiAliasResult.aliases[0], source_type: 'automated' },
  { text: 'Godan: Official English Title', language: 'en-Latn', kind: 'recognized_title', source: 'fixture_provider', source_version: '1.0.0', source_type: 'provider_official', confidence: null, approval_status: 'approved' },
  { text: 'Godaan Novel', language: 'en-Latn', kind: 'common_spelling', source: 'fixture_owner', source_version: '1.0.0', source_type: 'owner_verified', confidence: null, approval_status: 'approved' },
];
