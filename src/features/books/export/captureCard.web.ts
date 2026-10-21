import type { RefObject } from 'react';
import type { View } from 'react-native';
import { ExportUnavailableError } from './deliver';

export async function captureCardPng(_ref: RefObject<View | null>): Promise<string> {
  throw new ExportUnavailableError();
}

export function releaseCardCapture(_uri: string): void {}
