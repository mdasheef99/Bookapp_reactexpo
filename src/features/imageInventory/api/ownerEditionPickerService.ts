import { invokeOwnerUx, registeredOwnerUxError } from './ownerUxTransport';
import { parseOwnerEditionPickerRequest, type ReadEditionChoicesRequest,
  type RequestEditionOptionsRequest, type SelectEditionRequest, type OwnerEditionPickerAction,
  type OwnerEditionPickerRequest } from '../contracts/ownerEditionPicker';

function checked(action: OwnerEditionPickerAction, value: OwnerEditionPickerRequest) {
  try {
    const request = parseOwnerEditionPickerRequest(value);
    if (request.action !== action) throw new Error();
    return request;
  } catch { throw registeredOwnerUxError('P9_REQUEST_INVALID'); }
}
export const ownerEditionPickerService = {
  async readEditionChoices(request: ReadEditionChoicesRequest, signal: AbortSignal) {
    return invokeOwnerUx('read_candidate_edition_choices',
      checked('read_candidate_edition_choices', request), signal);
  },
  async requestEditionOptions(request: RequestEditionOptionsRequest, signal: AbortSignal) {
    return invokeOwnerUx('request_candidate_edition_options',
      checked('request_candidate_edition_options', request), signal);
  },
  async selectEdition(request: SelectEditionRequest, signal: AbortSignal) {
    const canonical = await invokeOwnerUx('select_candidate_edition',
      checked('select_candidate_edition', request), signal);
    if (!canonical.selection || canonical.selection.source !== request.source
      || (request.source === 'edition_option' && canonical.selection.optionId !== request.optionId)
      || canonical.candidateVersion < request.expectedCandidateVersion
      || canonical.metadataRevision < request.expectedMetadataRevision
      || (canonical.reviewVersion ?? 0) < (request.expectedReviewVersion ?? 0)) {
      throw registeredOwnerUxError('P9_INTERNAL_ERROR');
    }
    return canonical;
  },
};
export const { readEditionChoices, requestEditionOptions, selectEdition } = ownerEditionPickerService;