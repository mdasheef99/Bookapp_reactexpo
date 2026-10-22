import { buildFileName } from '../fileName';

const options = { timeZone: 'UTC' };
const date = new Date('2026-10-03T20:00:00Z');

describe('buildFileName', () => {
  it.each([
    ['library-csv', { kind: 'all' }, 'bookconnect-library-2026-10-03.csv'],
    ['library-csv', { kind: 'book', title: 'Ignored' }, 'bookconnect-library-2026-10-03.csv'],
    ['notes-md', { kind: 'all' }, 'bookconnect-notes-all-2026-10-03.md'],
    ['notes-pdf', { kind: 'all' }, 'bookconnect-notes-all-2026-10-03.pdf'],
    ['notes-md', { kind: 'book', title: 'My Book' }, 'bookconnect-notes-my-book-2026-10-03.md'],
    ['notes-pdf', { kind: 'book', title: 'My Book' }, 'bookconnect-notes-my-book-2026-10-03.pdf'],
  ] as const)('names %s for scope %j', (kind, scope, expected) => {
    expect(buildFileName(kind, scope, date, options)).toBe(expected);
  });

  it.each([
    [' -- Hello, world! & / * -- ', 'hello-world'],
    ['Crème Brûlée — Café', 'creme-brulee-cafe'],
    ['Café Été', 'cafe-ete'],
    ['हिंदी किताब', 'हिंदी-किताब'],
    ['किताब की दुनिया', 'किताब-की-दुनिया'],
    ['क़िताब', 'क़िताब'],
    ['東京 2026', '東京-2026'],
    ['', 'book'], ['!!!', 'book'], [null, 'book'],
  ])('makes a Unicode filename slug from %j', (title, slug) => {
    expect(buildFileName('notes-md', { kind: 'book', title }, date, options)).toBe(
      'bookconnect-notes-' + slug + '-2026-10-03.md',
    );
  });

  it('caps slugs at 60 characters and trims a separator at the cap', () => {
    expect(buildFileName('notes-pdf', { kind: 'book', title: 'A'.repeat(80) }, date, options)).toBe(
      'bookconnect-notes-' + 'a'.repeat(60) + '-2026-10-03.pdf',
    );
    expect(buildFileName('notes-md', { kind: 'book', title: 'A'.repeat(59) + ' B' }, date, options)).toBe(
      'bookconnect-notes-' + 'a'.repeat(59) + '-2026-10-03.md',
    );
  });

  it.each([
    'किताब'.repeat(11) + 'भारत',
    'किताब'.repeat(11) + 'भरत',
  ])('keeps a base and all its following marks together at the cap after %s', prefix => {
    const fileName = buildFileName('notes-md', { kind: 'book', title: prefix + 'किंबहुना' }, date, options);
    expect(fileName).toBe('bookconnect-notes-' + prefix + '-2026-10-03.md');
    expect(Array.from(prefix).length).toBeLessThanOrEqual(60);
    expect(prefix).not.toMatch(/\p{M}$/u);
  });

  it('keeps complete marked syllables that fit exactly in 60 code points', () => {
    expect(buildFileName('notes-md', { kind: 'book', title: 'कि'.repeat(31) }, date, options)).toBe(
      'bookconnect-notes-' + 'कि'.repeat(30) + '-2026-10-03.md',
    );
  });

  it('caps supplementary CJK letters by UTF-8 bytes before the code-point cap', () => {
    expect(buildFileName('notes-md', { kind: 'book', title: '𠮷'.repeat(61) }, date, options)).toBe(
      'bookconnect-notes-' + '𠮷'.repeat(50) + '-2026-10-03.md',
    );
  });

  it('uses the date in the injected zone without changing the input Date', () => {
    expect(buildFileName('library-csv', { kind: 'all' }, date, { timeZone: 'Asia/Kolkata' })).toBe('bookconnect-library-2026-10-04.csv');
    expect(date.toISOString()).toBe('2026-10-03T20:00:00.000Z');
  });

  it.each(['notes-md', 'notes-pdf'] as const)('caps a supplementary CJK slug at 200 UTF-8 bytes for %s', kind => {
    const fileName = buildFileName(kind, { kind: 'book', title: '\u{20000}'.repeat(60) }, date, options);
    const extension = kind === 'notes-md' ? 'md' : 'pdf';
    const slug = fileName.slice('bookconnect-notes-'.length, -`-2026-10-03.${extension}`.length);
    expect(slug).toBe('\u{20000}'.repeat(50));
    expect(Buffer.byteLength(slug, 'utf8')).toBeLessThanOrEqual(200);
    expect(Buffer.byteLength(fileName, 'utf8')).toBeLessThanOrEqual(255);
    expect(Array.from(slug).length).toBeLessThanOrEqual(60);
  });

  it('keeps a Devanagari base with all its marks at the UTF-8 byte cap', () => {
    // 196 bytes, then a 9-byte syllable: a split group would still fit its 3-byte base.
    const prefix = '\u{20BB7}'.repeat(49);
    const fileName = buildFileName('notes-md', {
      kind: 'book', title: prefix + '\u0915\u093f\u0902'.repeat(5),
    }, date, options);
    expect(fileName).toBe('bookconnect-notes-' + prefix + '-2026-10-03.md');
    expect(Buffer.byteLength(prefix, 'utf8')).toBe(196);
  });

  it.each([
    ['Crème Brûlée', 'creme-brulee'], ['क़िताब', 'क़िताब'], ['!!!', 'book'],
    ['A'.repeat(80), 'a'.repeat(60)], ['𠮷'.repeat(61), '𠮷'.repeat(50)],
  ])('names a quote PNG with the existing slug rules for %s', (title, slug) => {
    expect(buildFileName('quote-png', { kind: 'book', title }, date, options)).toBe(`bookconnect-quote-${slug}-2026-10-03.png`);
  });

  it('names a year PNG with a single year and no slug', () => {
    expect(buildFileName('year-png', { kind: 'all' }, date, options)).toBe('bookconnect-year-2026-10-03.png');
    expect(buildFileName('year-png', { kind: 'book', title: 'Ignored' }, date, options)).toBe(
      'bookconnect-year-2026-10-03.png',
    );
  });
});
