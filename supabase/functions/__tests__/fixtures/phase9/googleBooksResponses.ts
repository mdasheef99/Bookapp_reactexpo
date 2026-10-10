// Manually constructed from the official Google Books API v1 Volume schema.
export const googleBooksMultipleVolumes = {
  kind: 'books#volumes',
  totalItems: 3,
  items: [
    {
      id: 'volume-exact-isbn',
      volumeInfo: {
        title: 'The Fixture Book',
        subtitle: 'A Contract Example',
        authors: ['Fixture Author'],
        publisher: 'Fixture Press',
        publishedDate: '2020',
        description: '<b>Synthetic</b> edition description.',
        industryIdentifiers: [
          { type: 'ISBN_10', identifier: '0306406152' },
          { type: 'ISBN_13', identifier: '9780306406157' },
        ],
        pageCount: 240,
        categories: ['Fiction'],
        imageLinks: { thumbnail: 'http://books.google.com/books/content?id=fixture' },
        language: 'en',
        printType: 'BOOK',
      },
    },
    {
      id: 'volume-unicode',
      volumeInfo: {
        title: 'गोदान',
        authors: ['प्रेमचंद'],
        publisher: 'परीक्षण प्रकाशक',
        publishedDate: '2018',
        language: 'hi',
        printType: 'BOOK',
      },
    },
    {
      id: 'volume-conflict',
      volumeInfo: {
        title: 'The Fixture Book',
        authors: ['Another Author'],
        industryIdentifiers: [
          { type: 'ISBN_13', identifier: '9781861972712' },
          { type: 'OTHER', identifier: 'ignored' },
        ],
        language: 'en',
        printType: 'BOOK',
      },
    },
  ],
};

export const googleBooksMalformedSibling = {
  kind: 'books#volumes',
  totalItems: 2,
  items: [
    googleBooksMultipleVolumes.items[0],
    { id: 42, volumeInfo: { title: ['not-a-string'], authors: 'not-an-array' } },
  ],
};

export const googleBooksEmptyResponse = {
  kind: 'books#volumes',
  totalItems: 0,
};

// Synthetic examples of the public Google Volume shape; Task 3 decides eligibility.
const editionVolume = { ...googleBooksMultipleVolumes.items[0], volumeInfo: {
  ...googleBooksMultipleVolumes.items[0].volumeInfo,
  infoLink: 'https://books.google.com/books?id=volume-exact-isbn',
  imageLinks: { thumbnail: 'http://books.google.com/books/content?id=volume-exact-isbn' },
} };
const variant = (id: string, fields: Record<string, unknown>) => ({
  ...editionVolume, id, volumeInfo: {
    ...editionVolume.volumeInfo, infoLink: 'https://books.google.com/books?id=' + encodeURIComponent(id),
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=' + encodeURIComponent(id) },
    ...fields,
  },
});
export const googleBooksEditionPickerFixtures = {
  exactIsbn: { items: [editionVolume] },
  textOnlyMedium: { items: [variant('text-only', { industryIdentifiers: [], imageLinks: undefined })] },
  alternateIsbn: { items: [variant('alternative', { industryIdentifiers: [
    { type: 'ISBN_10', identifier: '1861972717' }, { type: 'ISBN_13', identifier: '9781861972712' },
  ] })] },
  unrelatedAuthor: { items: [variant('wrong-author', { authors: ['Unrelated Author'] })] },
  unrelatedTitle: { items: [variant('wrong-title', { title: 'An Unrelated Book' })] },
  incompatibleLanguage: { items: [variant('wrong-language', { language: 'fr' })] },
  incompatibleVolume: { items: [variant('wrong-volume', { title: 'The Fixture Book, Volume II' })] },
  conflictingIsbnPair: { items: [variant('isbn-conflict', { industryIdentifiers: [
    { type: 'ISBN_10', identifier: '0306406152' }, { type: 'ISBN_13', identifier: '9781861972712' },
  ] })] },
  sparseOptionalFields: { items: [{ id: 'sparse', volumeInfo: {
    title: 'The Fixture Book', authors: ['Fixture Author'], language: 'en',
    infoLink: 'https://books.google.com/books?id=sparse',
  } }] },
  missingRequiredFields: { items: [variant('missing-title', { title: undefined })] },
  partialPublicationDate: { items: [variant('year-only', { publishedDate: '2024' })] },
  unavailableMiddlePosition: { items: [
    editionVolume, { id: 42, volumeInfo: null }, variant('third-position', { publishedDate: '2024' }),
  ] },
  duplicateProviderId: { items: [
    editionVolume, { ...editionVolume, volumeInfo: { ...editionVolume.volumeInfo, publishedDate: '2024' } },
  ] },
  empty: googleBooksEmptyResponse,
  rateLimited: { status: 429, headers: { 'retry-after': '2' }, body: {
    error: { code: 429, message: 'Synthetic quota response', status: 'RESOURCE_EXHAUSTED' },
  } },
};
// Test-only inputs: these do NOT prove configured-provider permission.
export const googleBooksEditionRetentionFixtures = {
  shorterDeadline: { storagePermissionVerified: true, permittedDeadlineAt: '2026-10-07T06:00:00.000Z' },
  productCap: { storagePermissionVerified: true, permittedDeadlineAt: '2026-10-10T00:00:00.000Z' },
  unknownPermission: { storagePermissionVerified: false, permittedDeadlineAt: null },
  unknownDeadline: { storagePermissionVerified: true, permittedDeadlineAt: null },
};
