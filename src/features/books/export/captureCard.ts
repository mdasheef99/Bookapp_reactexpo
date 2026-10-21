import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

export function captureCardPng(ref: RefObject<View | null>): Promise<string> {
  return captureRef(ref, { format: 'png', quality: 1, width: 1080, height: 1350, result: 'tmpfile' });
}

export function releaseCardCapture(uri: string): void {
  try { releaseCapture(uri); }
  catch { /* Cleanup must not mask a cancelled capture. */ }
}
