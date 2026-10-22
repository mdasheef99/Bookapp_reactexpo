import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '../LibraryAppearance';
import { LIBRARY_TEXT } from '../LibraryTypography';
import { BookButton } from '../ui/BookButton';

export interface LibraryDateInputProps {
  label: string;
  value: string | null;
  onChange: (day: string) => void;
  disabled?: boolean;
  testID?: string;
}

function parseDay(value: string | null): Date {
  if (value) {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(year, month - 1, day, 12);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function toDayString(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function LibraryDateInput({ label, value, onChange, disabled = false, testID }: LibraryDateInputProps) {
  const colors = useLibraryAppearance();
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<Date | null>(null);

  const openPicker = () => {
    setTemp(parseDay(value));
    setOpen(true);
  };

  const commitTemp = () => {
    if (temp) onChange(toDayString(temp));
    setOpen(false);
    setTemp(null);
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      if (event.type !== 'set' && event.type !== 'dismissed') return;
      setOpen(false);
      if (event.type !== 'set' || !selected) return;
      onChange(toDayString(selected));
      return;
    }
    if (!selected) return;
    setTemp(selected);
  };

  const accessibleValue = value ? formatDisplay(value) : 'No date selected';

  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: accessibleValue }}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={openPicker}
        style={[
          styles.field,
          { backgroundColor: colors.bgSecondary, borderColor: colors.controlBorder },
          disabled && styles.disabled,
        ]}
      >
        <Text style={[LIBRARY_TEXT.body, { color: value ? colors.textPrimary : colors.textSecondary }]}>
          {value ? formatDisplay(value) : 'Select date'}
        </Text>
      </Pressable>
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          mode="date"
          value={temp ?? parseDay(value)}
          maximumDate={new Date()}
          onChange={handleChange}
        />
      ) : null}
      {open && Platform.OS !== 'android' ? (
        <View testID={testID ? `${testID}-ios-picker` : undefined}>
          <DateTimePicker
            testID={testID ? `${testID}-picker` : undefined}
            mode="date"
            value={temp ?? parseDay(value)}
            maximumDate={new Date()}
            onChange={handleChange}
          />
          <BookButton
            label="Done"
            variant="secondary"
            onPress={commitTemp}
            testID={testID ? `${testID}-done` : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: MIN_TARGET,
    justifyContent: 'center',
    paddingHorizontal: LIBRARY_SPACING.sm,
    paddingVertical: LIBRARY_SPACING.xs,
    borderRadius: LIBRARY_RADIUS.control,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});
