const compact = (value: string) => value.replace(/[\s-]/gu, '').toUpperCase();

export function normalizeIsbn(value: string): string {
  return compact(value);
}

export function isValidIsbn10(value: string): boolean {
  const isbn = compact(value);
  if (!/^\d{9}[\dX]$/u.test(isbn)) return false;
  const sum = [...isbn].reduce((total, char, index) => {
    const digit = char === 'X' ? 10 : Number(char);
    return total + digit * (10 - index);
  }, 0);
  return sum % 11 === 0;
}

export function isValidIsbn13(value: string): boolean {
  const isbn = compact(value);
  if (!/^\d{13}$/u.test(isbn)) return false;
  const sum = [...isbn.slice(0, 12)].reduce(
    (total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}

export function isbn10To13(value: string): string | null {
  const isbn10 = compact(value);
  if (!isValidIsbn10(isbn10)) return null;
  const body = `978${isbn10.slice(0, 9)}`;
  const sum = [...body].reduce(
    (total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return `${body}${(10 - (sum % 10)) % 10}`;
}

export type ValidatedIsbnPair = { isbn10: string | null; isbn13: string | null };

export type NormalizedIsbnClue = Readonly<{
  status: 'valid' | 'invalid';
  isbn10: string | null;
  isbn13: string | null;
  privateInvalidEvidence: string | null;
}>;

export function normalizeIsbnClue(value: string): NormalizedIsbnClue {
  const visible = value.trim();
  const invalid = (): NormalizedIsbnClue => ({
    status: 'invalid',
    isbn10: null,
    isbn13: null,
    privateInvalidEvidence: visible || null,
  });
  if (!visible || !/^[0-9Xx\s-]+$/u.test(visible)) return invalid();
  const normalized = compact(visible);
  if (normalized.length === 10 && isValidIsbn10(normalized)) {
    return {
      status: 'valid',
      isbn10: normalized,
      isbn13: isbn10To13(normalized),
      privateInvalidEvidence: null,
    };
  }
  if (normalized.length === 13 && isValidIsbn13(normalized)) {
    return {
      status: 'valid',
      isbn10: null,
      isbn13: normalized,
      privateInvalidEvidence: null,
    };
  }
  return invalid();
}

export function validateIsbnPair(isbn10: string | null, isbn13: string | null): ValidatedIsbnPair {
  const normalized10 = isbn10 ? compact(isbn10) : null;
  const normalized13 = isbn13 ? compact(isbn13) : null;
  if (normalized10 && !isValidIsbn10(normalized10)) throw new Error('invalid ISBN-10 checksum');
  if (normalized13 && !isValidIsbn13(normalized13)) throw new Error('invalid ISBN-13 checksum');
  if (normalized10 && normalized13 && isbn10To13(normalized10) !== normalized13) {
    throw new Error('ISBN-10 and ISBN-13 identify different editions');
  }
  return { isbn10: normalized10, isbn13: normalized13 ?? (normalized10 ? isbn10To13(normalized10) : null) };
}
