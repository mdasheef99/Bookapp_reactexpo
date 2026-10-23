import { buildMissedBookRequest, createEmptyMissedBookDraft, missedBookFingerprint } from '../review/missedBookForm';
import { ISBN_CHECK_ERROR_TEXT } from '../review/isbn';

// SDD 01a §§15.3/15.5: ISBN is separate from the strict three-field add payload.
const draft = (isbn = '') => ({ ...createEmptyMissedBookDraft(), title: 'A book', isbn });
it.each(['', '   '])('builds the unchanged add payload without ISBN: %j', isbn => {
  expect(buildMissedBookRequest(draft(isbn))).toEqual({ success: true,
    value: { title: 'A book', authors: [], language: 'en' }, isbn13: null });
});
it.each([['0-8044-2957-X', '9780804429573'], ['9780140449136', '9780140449136']])(
  'builds the add payload separately from normalized ISBN %s', (isbn, isbn13) => {
    expect(buildMissedBookRequest(draft(isbn))).toEqual({ success: true,
      value: { title: 'A book', authors: [], language: 'en' }, isbn13 });
  },
);
it.each(['9780140449137', '1000000000009'])('rejects invalid ISBN %s with shared copy', isbn => {
  expect(ISBN_CHECK_ERROR_TEXT).toBe("Check the ISBN; the last digit doesn't match");
  expect(buildMissedBookRequest(draft(isbn))).toEqual({ success: false, errors: { isbn: ISBN_CHECK_ERROR_TEXT } });
});
it('starts empty and includes ISBN in the dirty fingerprint', () => {
  expect(createEmptyMissedBookDraft().isbn).toBe('');
  expect(missedBookFingerprint(draft())).not.toBe(missedBookFingerprint(draft('9780140449136')));
});
