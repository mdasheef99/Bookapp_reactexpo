import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NoteCrop } from '../NoteCrop';
import type { CapturePhoto } from '@/features/books/notes/captureAdapter';
import { StyleSheet } from 'react-native';
import { BookButton } from '@/components/library/ui';
import { MIN_TARGET } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { COLUMN_MAX_WIDTH } from '@/components/library/bookDetails/bookDetailsTokens';

// SDD-07 FU-1b: NoteCrop and NoteButton resolve every colour from the book-section palette,
// which useLibraryAppearance derives from `phase` alone.
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: {} }) }));

const photo: CapturePhoto = { uri: 'page.jpg', width: 1000, height: 800, sourceWidth: 1000, sourceHeight: 800, rotation: 0 };
it.each([
  ['automatic', true, 'The printed text was found. The outline shows what will be read.'],
  ['automatic', false, 'The printed text will be found and cropped for you.'],
  ['manual', false, 'The outlined area will be read.'],
] as const)('C1 crop %s detected=%s explains the selected area', (cropMode, autoDetected, notice) => {
  const tree = render(<NoteCrop photo={photo} crop={{ x: 0, y: 0, width: 1, height: 1 }} disabled={false}
    cropMode={cropMode} autoDetected={autoDetected} onChange={jest.fn()} onReset={jest.fn()} />);
  expect(StyleSheet.flatten(screen.getByText(notice).props.style)).toMatchObject(LIBRARY_TEXT.body);
  expect(tree.toJSON()).toMatchObject({ props: { style: { maxWidth: COLUMN_MAX_WIDTH } } });
  fireEvent.press(screen.getByRole('button', { name: 'Adjust crop' }));
  const reset = screen.UNSAFE_getAllByType(BookButton).find(button => button.props.label === (autoDetected ? 'Use detected text area' : 'Use full image'))!;
  expect(reset.props.variant).toBe('text');
  expect(StyleSheet.flatten(screen.getByLabelText('Top left crop corner').props.style)).toMatchObject({ width: MIN_TARGET, height: MIN_TARGET });
});
it('keeps crop handles and edge controls behind one optional Adjust crop action', () => {
  const onChange = jest.fn(); const onReset = jest.fn();
  const selection = { x: .08, y: .08, width: .44, height: .415 };
  const { rerender } = render(<NoteCrop photo={photo} crop={selection} disabled={false}
    cropMode="automatic" autoDetected onChange={onChange} onReset={onReset} />);

  expect(screen.getByRole('button', { name: 'Adjust crop' })).toBeTruthy();
  expect(screen.queryByText('Left edge inward')).toBeNull();
  expect(screen.queryByLabelText('Top left crop corner')).toBeNull();

  fireEvent.press(screen.getByRole('button', { name: 'Adjust crop' }));
  expect(screen.getByRole('button', { name: 'Done adjusting' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Left edge inward' })).toBeTruthy();
  expect(screen.getByLabelText('Top left crop corner')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Left edge inward' }));
  expect(onChange).toHaveBeenCalledWith({ x: .13, y: .08, width: .39, height: .415 });
  rerender(<NoteCrop photo={photo} crop={selection} disabled={false} cropMode="manual" autoDetected onChange={onChange} onReset={onReset} />);
  expect(screen.getByRole('button', { name: 'Use detected text area' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Use detected text area' }));
  expect(onReset).toHaveBeenCalledTimes(1);
});
