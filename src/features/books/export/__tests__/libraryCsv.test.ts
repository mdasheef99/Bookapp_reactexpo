import { buildLibraryCsv } from '../libraryCsv';
import type { ExportLibraryRow } from '../types';

const options = { timeZone: 'UTC' };
const header = 'Title,Authors,ISBN-13,ISBN-10,Publisher,Published date,Pages,Status,Ownership,Condition,Rating,Review,Review visibility,Date added,Date finished';
const emptyRow: ExportLibraryRow = {
  reading_status: null, ownership: null, condition: null, rating: null,
  review: null, review_is_public: null, created_at: null, completed_at: null,
  book: {
    title: null, authors: null, isbn_13: null, isbn_10: null, publisher: null,
    published_date: null, page_count: null,
  },
};

describe('buildLibraryCsv', () => {
  it('writes the ordered header only with a BOM for no rows', () => {
    expect(buildLibraryCsv([], options)).toEqual({ text: '\uFEFF' + header, rowCount: 0, skipped: 0 });
  });

  it('writes all columns, joined authors, labels, stored publication date and CRLF records', () => {
    const row: ExportLibraryRow = {
      ...emptyRow, reading_status: 'completed', ownership: 'owned', condition: 'acceptable',
      rating: 4, review: 'A good read', review_is_public: true,
      created_at: '2026-10-03T20:00:00Z', completed_at: '2026-10-06T12:00:00Z',
      book: {
        title: 'Book', authors: ['One', 'Two'], isbn_13: '978-1-23456-789-0', isbn_10: '0-306-40615-2',
        publisher: 'Press', published_date: '1999-02', page_count: 123,
      },
    };
    expect(buildLibraryCsv([row, row], options)).toEqual({
      text: '\uFEFF' + header + '\r\n' +
        'Book,One; Two,9781234567890,0306406152,Press,1999-02,123,Finished,Owned,Fair,4,A good read,Public,2026-10-03,2026-10-06\r\n' +
        'Book,One; Two,9781234567890,0306406152,Press,1999-02,123,Finished,Owned,Fair,4,A good read,Public,2026-10-03,2026-10-06',
      rowCount: 2, skipped: 0,
    });
  });

  it.each([
    ['comma,title', '"comma,title"'],
    ['a "title"', '"a ""title"""'],
    ['line\rtitle', '"line\rtitle"'],
    ['line\ntitle', '"line\ntitle"'],
    ['line\r\ntitle', '"line\r\ntitle"'],
  ])('quotes and preserves the field %j', (title, expected) => {
    const row = { ...emptyRow, book: { ...emptyRow.book!, title } };
    expect(buildLibraryCsv([row], options).text).toBe('\uFEFF' + header + '\r\n' + expected + ','.repeat(14));
  });

  it.each(['=', '+', '-', '@', '\t', '\r'])('guards prefix %j in every text column', prefix => {
    const row = {
      ...emptyRow, reading_status: prefix + 'value', ownership: prefix + 'value',
      condition: prefix + 'value', review: prefix + 'value', review_is_public: false,
      book: { ...emptyRow.book!, title: prefix + 'value', authors: [prefix + 'value'], publisher: prefix + 'value' },
    };
    const guarded = prefix === '\r' ? '"\'\rvalue"' : "'" + prefix + 'value';
    const fields = [guarded, guarded, '', '', guarded, '', '', guarded, guarded, guarded, '', guarded, 'Private', '', ''];
    expect(buildLibraryCsv([row], options).text).toBe('\uFEFF' + header + '\r\n' + fields.join(','));
  });

  it.each(['=', '+', '-', '@'])('guards rendered unknown labels starting with %s', prefix => {
    const text = buildLibraryCsv([{
      ...emptyRow, reading_status: prefix + 'custom_status', ownership: prefix + 'on_hold',
      condition: prefix + 'very_worn',
    }], options).text;
    expect(text.split('\r\n')[1].split(',').slice(7, 10)).toEqual([
      "'" + prefix + 'custom status', "'" + prefix + 'on hold', "'" + prefix + 'very worn',
    ]);
  });

  it('guards publication text but not numeric, ISBN or generated date columns or a space before a formula', () => {
    const row = {
      ...emptyRow, rating: -1, created_at: '2026-10-03T20:00:00Z', completed_at: '2026-10-03T20:00:00Z',
      book: {
        ...emptyRow.book!, title: ' =formula', page_count: -2,
        isbn_13: '=978-1-23456-789-0', isbn_10: '+0-8044-2957-X', published_date: '-0044',
      },
    };
    expect(buildLibraryCsv([row], { timeZone: 'Asia/Kolkata' }).text).toBe(
      '\uFEFF' + header + '\r\n =formula,,9781234567890,080442957X,,\'-0044,-2,,,,-1,,,2026-10-04,2026-10-04',
    );
  });

  it.each(['=', '+', '-', '@', '\t', '\r'])('guards publication text starting with %j while leaving ISBNs unguarded', prefix => {
    const row = {
      ...emptyRow,
      book: { ...emptyRow.book!, isbn_13: prefix + '9781234567890', isbn_10: prefix + '012345678X', published_date: prefix + '2026' },
    };
    const publishedDate = prefix === '\r' ? '"\'\r2026"' : "'" + prefix + '2026';
    expect(buildLibraryCsv([row], options).text).toBe('\uFEFF' + header + '\r\n' + [
      '', '', '9781234567890', '012345678X', '', publishedDate, '', '', '', '', '', '', '', '', '',
    ].join(','));
  });

  it.each([
    ['=HYPERLINK("x")', '"\'=HYPERLINK(""x"")"'],
    ['2005-03', '2005-03'],
    [null, ''],
  ])('guards a free-text Published date %j and preserves safe or empty values', (published_date, expected) => {
    const row = { ...emptyRow, book: { ...emptyRow.book!, published_date } };
    expect(buildLibraryCsv([row], options).text).toBe('\uFEFF' + header + '\r\n' + [
      '', '', '', '', '', expected, '', '', '', '', '', '', '', '', '',
    ].join(','));
  });

  it.each([
    ['=0X-8044x2957X', '080442957X'],
    ['080442957x', '080442957X'],
    [' 0-8044-2957-X ', '080442957X'],
    ['0-306-40615-2', '0306406152'],
    ['978-1-23456-789-0', '9781234567890'],
  ])('trims ISBN punctuation and normalizes a trailing X or x in %s', (isbn, expected) => {
    const row = { ...emptyRow, book: { ...emptyRow.book!, isbn_13: isbn, isbn_10: isbn } };
    expect(buildLibraryCsv([row], options).text.split('\r\n')[1].split(',').slice(2, 4)).toEqual([expected, expected]);
  });

  it.each([
    ['want_to_read', 'borrowed', 'like_new', 'Want to read,Borrowed,Like new'],
    ['reading', 'lent_out', 'poor', 'Reading,Lent out,Poor'],
    ['custom_status', 'on_hold', 'very_worn', 'Custom status,On hold,Very worn'],
    [null, null, null, ',,'],
  ])('uses existing labels and null handling for %s / %s / %s', (reading_status, ownership, condition, expected) => {
    const text = buildLibraryCsv([{ ...emptyRow, reading_status, ownership, condition }], options).text;
    expect(text.split('\r\n')[1].split(',').slice(7, 10).join(',')).toBe(expected);
  });

  it('writes empty optional fields without passing null to the label functions', () => {
    expect(buildLibraryCsv([emptyRow], options)).toEqual({
      text: '\uFEFF' + header + '\r\n' + ','.repeat(14), rowCount: 1, skipped: 0,
    });
  });

  it.each([
    [null, true, ''], ['', false, ''], ['Review', true, 'Public'],
    ['Review', false, 'Private'], ['Review', null, 'Private'],
  ])('sets visibility for review %j and public %s', (review, review_is_public, expected) => {
    const text = buildLibraryCsv([{ ...emptyRow, review, review_is_public }], options).text;
    expect(text.split('\r\n')[1].split(',')[12]).toBe(expected);
  });

  it('omits invalid dates and empty authors, preserves zero numbers', () => {
    const row = {
      ...emptyRow, rating: 0, created_at: 'invalid', completed_at: 'invalid',
      book: { ...emptyRow.book!, authors: [], page_count: 0 },
    };
    expect(buildLibraryCsv([row], options).text.split('\r\n')[1].split(',')).toEqual([
      '', '', '', '', '', '', '0', '', '', '', '0', '', '', '', '',
    ]);
  });

  it('skips null joins, counts written rows, preserves UTF-8 titles and includes wishlist', () => {
    const row = { ...emptyRow, ownership: 'wishlist', book: { ...emptyRow.book!, title: 'हिंदी ಪುಸ್ತಕ' } };
    const result = buildLibraryCsv([{ ...emptyRow, book: null }, row], options);
    expect(result.rowCount).toBe(1);
    expect(result.skipped).toBe(1);
    expect(Buffer.from(result.text, 'utf8').toString('utf8')).toBe('\uFEFF' + header + '\r\nहिंदी ಪುಸ್ತಕ,,,,,,,,Wishlist,,,,,,');
    expect(buildLibraryCsv([{ ...emptyRow, book: null }], options)).toEqual({
      text: '\uFEFF' + header, rowCount: 0, skipped: 1,
    });
  });
});
