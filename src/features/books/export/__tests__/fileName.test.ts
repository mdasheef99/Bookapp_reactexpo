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

  it('counts supplementary CJK letters as one code point at the cap', () => {
    expect(buildFileName('notes-md', { kind: 'book', title: '𠮷'.repeat(61) }, date, options)).toBe(
      'bookconnect-notes-' + '𠮷'.repeat(60) + '-2026-10-03.md',
    );
  });

  it('uses the date in the injected zone without changing the input Date', () => {
    expect(buildFileName('library-csv', { kind: 'all' }, date, { timeZone: 'Asia/Kolkata' })).toBe('bookconnect-library-2026-10-04.csv');
    expect(date.toISOString()).toBe('2026-10-03T20:00:00.000Z');
  });
});
