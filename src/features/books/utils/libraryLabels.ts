function fallbackLabel(raw: string): string {
  const spaced = raw.replace(/_/g, ' ');
  if (spaced.length === 0) return spaced;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function readingStatusLabel(status: string): string {
  if (status === 'want_to_read') return 'Want to read';
  if (status === 'reading') return 'Reading';
  if (status === 'completed') return 'Finished';
  return fallbackLabel(status);
}

export function ownershipLabel(ownership: string): string {
  if (ownership === 'owned') return 'Owned';
  if (ownership === 'lent_out') return 'Lent out';
  if (ownership === 'borrowed') return 'Borrowed';
  if (ownership === 'wishlist') return 'Wishlist';
  return fallbackLabel(ownership);
}

export function conditionLabel(condition: string): string {
  if (condition === 'new') return 'New';
  if (condition === 'like_new') return 'Like new';
  if (condition === 'good') return 'Good';
  if (condition === 'acceptable') return 'Fair';
  if (condition === 'poor') return 'Poor';
  return fallbackLabel(condition);
}

