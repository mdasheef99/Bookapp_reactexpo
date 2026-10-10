import { createCaptureAttempt } from '../capture/captureIds';
import { OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';
import type { EditionChoices, RequestEditionOptionsRequest, SelectEditionRequest } from '../contracts/ownerEditionPicker';

type SelectionTarget = Readonly<{ source: 'edition_option'; optionId: string }>
  | Readonly<{ source: 'current_suggestion'; selectionId: string }>;
const scope = (choices: EditionChoices) => ({ contractVersion: OWNER_UX_CONTRACT_VERSION,
  sessionId: choices.sessionId, candidateId: choices.candidateId });
const commandIdentity = (prefix: string) => {
  const attempt = createCaptureAttempt(prefix);
  return { idempotencyKey: attempt.key, commandId: attempt.commandId };
};
// Create once per explicit action. Hooks retain these exact DTOs for retries.
export function createEditionLookupCommand(choices: EditionChoices): RequestEditionOptionsRequest {
  return { ...scope(choices), ...commandIdentity('edition-lookup'),
    action: 'request_candidate_edition_options', expectedRequestGeneration: choices.requestGeneration };
}
export function createEditionSelectionCommand(choices: EditionChoices, target: SelectionTarget): SelectEditionRequest {
  const versions = { ...scope(choices), ...commandIdentity('edition-selection'),
    action: 'select_candidate_edition' as const, expectedCandidateVersion: choices.candidateVersion,
    expectedMetadataRevision: choices.metadataRevision, expectedReviewVersion: choices.reviewVersion };
  return target.source === 'edition_option'
    ? { ...versions, ...target, optionsVersion: choices.optionsVersion }
    : { ...versions, ...target };
}
