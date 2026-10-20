import React from 'react';
import { ownershipLabel } from '@/features/books/utils/libraryLabels';
import { ChoiceRadioGroup } from './bookDetails/ChoiceRadioGroup';

export type Ownership = 'owned' | 'lent_out' | 'borrowed' | 'wishlist';

interface OwnershipSelectorProps {
  ownership: Ownership;
  onChange: (val: Ownership) => void;
  disabled?: boolean;
}

const VALUES: readonly Ownership[] = ['owned', 'lent_out', 'borrowed', 'wishlist'];
const OPTIONS = VALUES.map(value => ({ value, label: ownershipLabel(value) }));

export const OwnershipSelector = ({ ownership, onChange, disabled }: OwnershipSelectorProps) => (
  <ChoiceRadioGroup label="Ownership" value={ownership} options={OPTIONS} onChange={onChange} disabled={disabled} />
);
