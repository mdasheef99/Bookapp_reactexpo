export type SpineAnalyzerErrorCode =
  | 'P9_VISION_ANALYZER_TIMEOUT'
  | 'P9_VISION_ANALYZER_UNAVAILABLE'
  | 'P9_VISION_MEDIA_UNAVAILABLE'
  | 'P9_VISION_SCHEMA_INVALID';

export type SpineAnalyzerFailureClassification =
  | 'timeout'
  | 'rate_limited'
  | 'provider_error'
  | 'media_unavailable'
  | 'malformed_response'
  | 'schema_invalid';

export class SpineAnalyzerError extends Error {
  constructor(
    readonly code: SpineAnalyzerErrorCode,
    readonly retryable: boolean,
    readonly classification: SpineAnalyzerFailureClassification,
  ) {
    super(code);
    this.name = 'SpineAnalyzerError';
  }
}
