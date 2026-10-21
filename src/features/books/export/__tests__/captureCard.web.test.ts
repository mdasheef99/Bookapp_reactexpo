import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createRef } from 'react';
import type { View } from 'react-native';
import { captureCardPng, releaseCardCapture } from '../captureCard.web';
import { ExportUnavailableError } from '../deliver';

it('rejects web capture with the delivery availability error', async () => {
  await expect(captureCardPng(createRef<View>())).rejects.toBeInstanceOf(ExportUnavailableError);
  expect(() => releaseCardCapture('file:///unused.png')).not.toThrow();
});

it('has no native capture dependency in the web source', () => {
  const source = readFileSync(resolve(__dirname, '../captureCard.web.ts'), 'utf8');
  expect(source).not.toContain('react-native-view-shot');
});
