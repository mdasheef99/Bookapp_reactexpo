import { conditionLabel, ownershipLabel, readingStatusLabel } from '../libraryLabels';

describe('readingStatusLabel', () => {
  it.each([
    ['want_to_read', 'Want to read'],
    ['reading', 'Reading'],
    ['completed', 'Finished'],
  ])('maps %s to %s', (input, expected) => {
    expect(readingStatusLabel(input)).toBe(expected);
  });

  it('falls back by replacing underscores and capitalising the first letter', () => {
    expect(readingStatusLabel('some_custom_status')).toBe('Some custom status');
  });

  it('falls back for a single word', () => {
    expect(readingStatusLabel('unknown')).toBe('Unknown');
  });
});

describe('ownershipLabel', () => {
  it.each([
    ['owned', 'Owned'],
    ['lent_out', 'Lent out'],
    ['borrowed', 'Borrowed'],
    ['wishlist', 'Wishlist'],
  ])('maps %s to %s', (input, expected) => {
    expect(ownershipLabel(input)).toBe(expected);
  });

  it('falls back by replacing underscores and capitalising the first letter', () => {
    expect(ownershipLabel('on_hold')).toBe('On hold');
  });
});

describe('conditionLabel', () => {
  it.each([
    ['new', 'New'],
    ['like_new', 'Like new'],
    ['good', 'Good'],
    ['acceptable', 'Fair'],
    ['poor', 'Poor'],
  ])('maps %s to %s', (input, expected) => {
    expect(conditionLabel(input)).toBe(expected);
  });

  it('falls back by replacing underscores and capitalising the first letter', () => {
    expect(conditionLabel('very_worn')).toBe('Very worn');
  });
});

