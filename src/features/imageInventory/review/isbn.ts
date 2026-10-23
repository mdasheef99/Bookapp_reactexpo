// Slice 5 SDD §8: shared normalization/check digits, plus the ISBN box's 978/979 prefix rule.
const compact = (value: string) => value.replace(/[\s-]/gu, '').toUpperCase();

function isValidIsbn10(value: string): boolean {
  const isbn = compact(value);
  if (!/^\d{9}[\dX]$/u.test(isbn)) return false;
  return [...isbn].reduce((sum, char, index) => sum + (char === 'X' ? 10 : Number(char)) * (10 - index), 0) % 11 === 0;
}
function isValidIsbn13(value: string): boolean {
  const isbn = compact(value);
  if (!/^97[89]\d{10}$/u.test(isbn)) return false;
  const sum = [...isbn.slice(0, 12)].reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}
function isbn10To13(value: string): string {
  const body = `978${value.slice(0, 9)}`;
  const sum = [...body].reduce((total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}
export type NormalizedIsbnClue = Readonly<{
  status: 'valid' | 'invalid'; isbn10: string | null; isbn13: string | null; privateInvalidEvidence: string | null;
}>;
export function normalizeIsbnClue(value: string): NormalizedIsbnClue {
  const visible = value.trim();
  const invalid = (): NormalizedIsbnClue => ({ status: 'invalid', isbn10: null, isbn13: null, privateInvalidEvidence: visible || null });
  if (!visible || !/^[0-9Xx\s-]+$/u.test(visible)) return invalid();
  const normalized = compact(visible);
  if (normalized.length === 10 && isValidIsbn10(normalized)) {
    return { status: 'valid', isbn10: normalized, isbn13: isbn10To13(normalized), privateInvalidEvidence: null };
  }
  if (normalized.length === 13 && isValidIsbn13(normalized)) {
    return { status: 'valid', isbn10: null, isbn13: normalized, privateInvalidEvidence: null };
  }
  return invalid();
}
