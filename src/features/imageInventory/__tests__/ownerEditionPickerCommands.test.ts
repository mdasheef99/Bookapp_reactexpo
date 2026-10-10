import { createCaptureAttempt } from '../capture/captureIds';
import { createEditionLookupCommand, createEditionSelectionCommand } from '../api/ownerEditionPickerCommands';
import { parseOwnerEditionPickerRequest } from '../contracts/ownerEditionPicker';
import { pickerChoices, selectedChoices } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';
jest.mock('../capture/captureIds', () => ({ createCaptureAttempt: jest.fn(() => ({
  key: 'edition:stable-command-0001', commandId: '00000000-0000-4000-8000-000000000009',
})) }));
it('creates one strict lookup command with the existing identity helper and generation', () => {
  const command = createEditionLookupCommand(pickerChoices());
  expect(parseOwnerEditionPickerRequest(command)).toEqual(command);
  expect(command).toMatchObject({ action: 'request_candidate_edition_options', expectedRequestGeneration: 1,
    idempotencyKey: 'edition:stable-command-0001', commandId: testUuid(9) });
  expect(createCaptureAttempt).toHaveBeenCalledWith('edition-lookup');
});
it.each(['edition_option', 'current_suggestion'] as const)('freezes %s with only server-held IDs and corresponding versions', source => {
  const choices = selectedChoices();
  const target = source === 'edition_option' ? { source, optionId: testUuid(20) }
    : { source, selectionId: testUuid(30) };
  const command = createEditionSelectionCommand(choices, target);
  expect(parseOwnerEditionPickerRequest(command)).toEqual(command);
  expect(command).toMatchObject({ expectedCandidateVersion: 5, expectedMetadataRevision: 8,
    expectedReviewVersion: null, ...target });
  expect(command).not.toHaveProperty('metadata');
  if (source === 'current_suggestion') expect(command).not.toHaveProperty('optionsVersion');
});
