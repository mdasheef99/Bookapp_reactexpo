import { normalizeIsbnClue } from '../review/isbn';
import { normalizeIsbnClue as sharedNormalize } from '../../../../supabase/functions/_shared/imageInventory/domain/isbn';
import { parseOwnerEditionPickerRequest, parseOwnerEditionPickerResponse } from '../contracts/ownerEditionPicker';
import { decodeOwnerUxRequest } from '../contracts/ownerUxRequestContracts';
import { decodeOwnerUxResponse, OWNER_UX_CONTRACT_VERSION } from '../contracts/ownerUxContracts';
import { createCandidateIsbnCommand } from '../api/ownerEditionPickerCommands';
import { pickerChoices } from '../testing/editionPickerClientFixtures';
import { testUuid } from '../testing/ownerUxTestFixtures';
import * as Crypto from 'expo-crypto';

// Slice 5 SDD §§7–8 / AC5a-2,4,18,22: app rules mirror the shared checksum table.
it.each(['9780140449136', '978-0-140-44913-6', '0-14-044913-2', '0 8044 2957 x',
  '9791234567896', '9780140449137', '0804429570', '978014044913', '', '  ', '978.0140449136', '978014044913X'])
('normalizes ISBN %j exactly like the shared validator', value => {
  expect(normalizeIsbnClue(value)).toEqual(sharedNormalize(value));
});
it('refuses a checksum-valid non-ISBN prefix only in the app validator', () => {
  expect(sharedNormalize('1000000000009').status).toBe('valid');
  expect(normalizeIsbnClue('1000000000009').status).toBe('invalid');
  expect(normalizeIsbnClue('9791234567896')).toMatchObject({ status: 'valid', isbn13: '9791234567896' });
});

const command = { contractVersion: OWNER_UX_CONTRACT_VERSION, action: 'set_candidate_isbn' as const,
  sessionId: testUuid(1), candidateId: testUuid(2), commandId: testUuid(3),
  idempotencyKey: 'isbn:fixed-command-0001', expectedCandidateVersion: 4, isbn13: '9780140449136' };
const result = { sessionId: testUuid(1), candidateId: testUuid(2), candidateVersion: 5,
  metadataRevision: 8, requestGeneration: 2, ownerIsbn13: '9780140449136' };
it.each(['9780140449136', null])('registers and strictly decodes set/clear %j through Owner contracts', isbn13 => {
  const request = { ...command, isbn13 };
  expect(parseOwnerEditionPickerRequest(request)).toEqual(request);
  expect(decodeOwnerUxRequest('set_candidate_isbn', request)).toEqual(request);
  expect(parseOwnerEditionPickerResponse('set_candidate_isbn', result)).toEqual(result);
  expect(decodeOwnerUxResponse('set_candidate_isbn', { contractVersion: OWNER_UX_CONTRACT_VERSION, data: result })).toEqual(result);
});
it.each([{ ...command, isbn13: '0140449132' }, { ...command, isbn13: '9780140449136', storeId: testUuid(8) }])
('rejects malformed or untrusted ISBN commands', request => {
  expect(() => parseOwnerEditionPickerRequest(request)).toThrow();
});
it.each([undefined, null, '9780140449136'])('decodes both old choices and v2 owner ISBN %j', ownerIsbn13 => {
  const choices = { ...pickerChoices(), ...(ownerIsbn13 === undefined ? {} : { ownerIsbn13 }) };
  expect(parseOwnerEditionPickerResponse('read_candidate_edition_choices', choices)).toEqual(choices);
});
it('creates a set command once from authoritative candidate versions', () => {
  const uuid = jest.spyOn(Crypto, 'randomUUID').mockReturnValue(testUuid(9) as ReturnType<typeof Crypto.randomUUID>);
  const request = createCandidateIsbnCommand(pickerChoices({ candidateVersion: 19 }), '9780140449136');
  expect(request).toMatchObject({ action: 'set_candidate_isbn', expectedCandidateVersion: 19,
    sessionId: testUuid(1), candidateId: testUuid(2), isbn13: '9780140449136' });
  expect(parseOwnerEditionPickerRequest(request)).toEqual(request);
  uuid.mockRestore();
});
