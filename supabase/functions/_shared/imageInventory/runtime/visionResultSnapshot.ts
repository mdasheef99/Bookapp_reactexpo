import {
  asRecord,
  assertKnownKeys,
  Phase9ContractError,
} from '../contracts';

const RESULT_KEYS = [
  'contractVersion', 'schemaVersion', 'pipelineVersion', 'promptVersion',
  'adapterKey', 'adapterVersion', 'jobReference', 'attemptNumber',
  'correlationId', 'expectedLanguage', 'providerKey', 'modelKey',
  'modelVersion', 'receivedAt', 'imageOutcome', 'detectedVisibleBookCount',
  'observations', 'warningCodes',
] as const;
const OBSERVATION_KEYS = [
  'ordinal', 'titleGuess', 'authorGuesses', 'publisherClue', 'isbnClue',
  'detectedLanguage', 'confidence', 'geometry', 'warningCodes',
] as const;

export function analyzerResultSnapshot(value: unknown) {
  const result = asRecord(value, 'analyzer_result');
  assertKnownKeys(result, RESULT_KEYS, 'analyzer_result');
  if (!Array.isArray(result.observations)) {
    throw new Phase9ContractError('analyzer_result.observations', 'must be an array');
  }
  return {
    contract_version: result.contractVersion,
    schema_version: result.schemaVersion,
    pipeline_version: result.pipelineVersion,
    prompt_version: result.promptVersion,
    adapter_key: result.adapterKey,
    adapter_version: result.adapterVersion,
    job_reference: result.jobReference,
    attempt_number: result.attemptNumber,
    correlation_id: result.correlationId,
    expected_language: result.expectedLanguage,
    provider_key: result.providerKey,
    model_key: result.modelKey,
    model_version: result.modelVersion,
    received_at: result.receivedAt,
    image_outcome: result.imageOutcome,
    detected_visible_book_count: result.detectedVisibleBookCount,
    observations: result.observations.map((entry, index) => {
      const field = `analyzer_result.observations[${index}]`;
      const observation = asRecord(entry, field);
      assertKnownKeys(observation, OBSERVATION_KEYS, field);
      return {
        ordinal: observation.ordinal,
        title_guess: observation.titleGuess,
        author_guesses: observation.authorGuesses,
        publisher_clue: observation.publisherClue,
        isbn_clue: observation.isbnClue,
        detected_language: observation.detectedLanguage,
        confidence: observation.confidence,
        geometry: observation.geometry,
        warning_codes: observation.warningCodes,
      };
    }),
    warning_codes: result.warningCodes,
  };
}
