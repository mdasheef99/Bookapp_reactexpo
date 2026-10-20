import React from 'react';
import { conditionLabel } from '@/features/books/utils/libraryLabels';
import { ChoiceRadioGroup } from './bookDetails/ChoiceRadioGroup';

export type Condition = 'new' | 'like_new' | 'good' | 'acceptable' | 'poor';

interface ConditionPickerProps {
  condition: Condition;
  onChange: (val: Condition) => void;
  disabled?: boolean;
}

const VALUES: readonly Condition[] = ['new', 'like_new', 'good', 'acceptable', 'poor'];
const OPTIONS = VALUES.map(value => ({ value, label: conditionLabel(value) }));

export const ConditionPicker = ({ condition, onChange, disabled }: ConditionPickerProps) => (
  <ChoiceRadioGroup label="Condition" value={condition} options={OPTIONS} onChange={onChange} disabled={disabled} />
);
