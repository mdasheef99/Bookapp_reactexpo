import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NoteCrop } from '../NoteCrop';
import type { CapturePhoto } from '@/features/books/notes/captureAdapter';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ phase: 'daylight', colors: { textPrimary: '#111', textSecondary: '#444' } }) }));

const photo: CapturePhoto = { uri: 'page.jpg', width: 1000, height: 800, sourceWidth: 1000, sourceHeight: 800, rotation: 0 };
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
