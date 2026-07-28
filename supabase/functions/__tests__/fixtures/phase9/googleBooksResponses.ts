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
