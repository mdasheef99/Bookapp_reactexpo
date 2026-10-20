import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import type { OcrResult } from '../services/ocrService';
import { cropPixels, CropSelection, ImageSize, validImageSize } from './captureGeometry';

export interface CapturePhoto extends ImageSize { uri: string; sourceWidth: number; sourceHeight: number; rotation: number }
export type CaptureErrorCode = 'PERMISSION_DENIED' | 'CAMERA_UNAVAILABLE' | 'INVALID_ASSET' | 'TRANSFORM_FAILED';
const copy: Record<CaptureErrorCode, string> = {
  PERMISSION_DENIED: 'Camera access is off for BookConnect. Choose a photo instead, or write your note.',
  CAMERA_UNAVAILABLE: "The camera isn't available here. Choose a photo instead, or write your note.",
  INVALID_ASSET: "This photo couldn't be opened. Choose a different one.",
  TRANSFORM_FAILED: "This photo couldn't be prepared. Your earlier text is still here.",
};
export class CaptureError extends Error { constructor(public readonly code: CaptureErrorCode) { super(copy[code]); } }
export interface CaptureAdapter {
  canRecognize: boolean;
  pick(source: 'camera' | 'gallery'): Promise<CapturePhoto | null>;
  rotate(photo: CapturePhoto): Promise<CapturePhoto>;
  transform(photo: CapturePhoto, crop: CropSelection): Promise<CapturePhoto>;
  recognize(uri: string, signal: AbortSignal): Promise<OcrResult>;
  release(uri: string): Promise<void>;
}
export function onDeviceAvailability(): { available: boolean; message: string } {
  if (Platform.OS === 'web') return { available: false, message: "Scanning text isn't available in the browser. Use the BookConnect app to scan, or write your note here." };
  if (Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient') return { available: false, message: "Scanning text isn't available in Expo Go. Use the BookConnect development app to scan, or write your note here." };
  const available = typeof NativeModules.TextRecognition?.recognize === 'function';
  return { available, message: available ? 'Scanning reads printed English text. Check the result before you save.' : "Scanning text isn't available in this version of the app. You can write your note instead." };
}
export function createCaptureAdapter(): CaptureAdapter {
  // Only URIs created by this adapter are eligible for cleanup. Picker originals are never owned.
  const owned = new Set<string>();
  const leases = new Map<string, number>(); const pendingRelease = new Set<string>();
  const release = async (uri: string) => {
    if (!owned.has(uri)) return;
    if (leases.has(uri)) { pendingRelease.add(uri); return; }
    owned.delete(uri); pendingRelease.delete(uri);
    try {
      if (Platform.OS === 'web') { if (uri.startsWith('blob:')) URL.revokeObjectURL(uri); return; }
      const fs = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
      if (fs.cacheDirectory && uri.startsWith(fs.cacheDirectory)) await fs.deleteAsync(uri, { idempotent: true });
    } catch { /* No private URI/error logging; OS cache cleanup remains a fallback. */ }
  };
  const render = async (uri: string, actions: (context: import('expo-image-manipulator').ImageManipulatorContext) => void) => {
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
    const context = ImageManipulator.manipulate(uri); let image: import('expo-image-manipulator').ImageRef | undefined;
    try {
      actions(context); image = await context.renderAsync();
      const result = await image.saveAsync({ format: SaveFormat.PNG, base64: false });
      if (!validImageSize(result) || !result.uri || result.uri === uri) throw new CaptureError('TRANSFORM_FAILED');
      owned.add(result.uri); return result;
    } finally { image?.release(); context.release(); }
  };
  return {
    canRecognize: onDeviceAvailability().available,
    async pick(source) {
      const picker = require('expo-image-picker') as typeof import('expo-image-picker');
      if (source === 'camera') {
        if (Platform.OS === 'web') throw new CaptureError('CAMERA_UNAVAILABLE');
        let permission;
        try { permission = await picker.requestCameraPermissionsAsync(); } catch { throw new CaptureError('CAMERA_UNAVAILABLE'); }
        if (!permission.granted) throw new CaptureError('PERMISSION_DENIED');
      }
      let selected;
      try {
        const options = { mediaTypes: ['images'] as import('expo-image-picker').MediaType[], allowsEditing: false, quality: 1, base64: false, exif: false };
        // SDK 54's system photo picker needs no broad gallery permission for images.
        selected = source === 'camera' ? await picker.launchCameraAsync(options) : await picker.launchImageLibraryAsync(options);
      } catch { throw new CaptureError(source === 'camera' ? 'CAMERA_UNAVAILABLE' : 'INVALID_ASSET'); }
      if (selected.canceled) return null;
      const asset = selected.assets?.[0];
      if (!asset || !asset.uri || !validImageSize(asset) || (asset.type && asset.type !== 'image')) throw new CaptureError('INVALID_ASSET');
      try {
        // Decoding honors EXIF orientation. Re-encoding removes it; dimensions below describe actual pixels.
        const result = await render(asset.uri, () => {});
        return { uri: result.uri, width: result.width, height: result.height, sourceWidth: asset.width, sourceHeight: asset.height, rotation: 0 };
      } catch { throw new CaptureError('INVALID_ASSET'); }
    },
    async rotate(photo) {
      try { const result = await render(photo.uri, context => { context.rotate(90); }); return { ...photo, ...result, rotation: (photo.rotation + 90) % 360 }; }
      catch { throw new CaptureError('TRANSFORM_FAILED'); }
    },
    async transform(photo, selection) {
      try { const bounds = cropPixels(photo, selection); const result = await render(photo.uri, context => { context.crop(bounds); }); return { ...photo, ...result }; }
      catch { throw new CaptureError('TRANSFORM_FAILED'); }
    },
    async recognize(uri, signal) {
      const { recognizePageText } = require('../services/ocrService') as typeof import('../services/ocrService');
      return recognizePageText(uri, { languageHint: 'en', signal, onNativeWork: work => {
        leases.set(uri, (leases.get(uri) ?? 0) + 1);
        const settled = () => { const count = (leases.get(uri) ?? 1) - 1; if (count) leases.set(uri, count); else leases.delete(uri); if (pendingRelease.has(uri)) void release(uri); };
        void work.then(settled, settled);
      } });
    },
    release,
  };
}
