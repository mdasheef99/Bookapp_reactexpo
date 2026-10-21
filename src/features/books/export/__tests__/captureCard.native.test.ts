import { createRef } from 'react';
import type { View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { captureCardPng, releaseCardCapture } from '../captureCard';

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(), releaseCapture: jest.fn() }));

beforeEach(() => { jest.resetAllMocks(); });

it('captures the given native ref with the exact PNG output options', async () => {
  const ref = createRef<View>();
  jest.mocked(captureRef).mockResolvedValue('file:///card.png');
  await expect(captureCardPng(ref)).resolves.toBe('file:///card.png');
  expect(captureRef).toHaveBeenCalledWith(ref, {
    format: 'png', quality: 1, width: 1080, height: 1350, result: 'tmpfile',
  });
});

it('releases a cancelled capture and swallows native cleanup errors', () => {
  releaseCardCapture('file:///card.png');
  expect(releaseCapture).toHaveBeenCalledWith('file:///card.png');
  jest.mocked(releaseCapture).mockImplementationOnce(() => { throw new Error('already removed'); });
  expect(() => releaseCardCapture('file:///gone.png')).not.toThrow();
});
