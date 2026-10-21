import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { CaptureError, createCaptureAdapter, onDeviceAvailability } from '../captureAdapter';
import { FULL_CROP } from '../captureGeometry';
import { recognizePageText, recognizePageViaCloud } from '../../services/ocrService';

const mockPicker = { requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() };
const mockDelete = jest.fn(); const mockCrop = jest.fn(); const mockRotate = jest.fn(); const mockContextRelease = jest.fn(); const mockImageRelease = jest.fn();
let mockResult: any; const mockSave = jest.fn(async () => mockResult); const mockRender = jest.fn(async () => ({ saveAsync: mockSave, release: mockImageRelease }));
jest.mock('expo-image-picker', () => mockPicker);
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: () => ({ crop: mockCrop, rotate: mockRotate, renderAsync: mockRender, release: mockContextRelease }) }, SaveFormat: { PNG: 'png' } }));
jest.mock('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///cache/', deleteAsync: (...args: unknown[]) => mockDelete(...args) }));
jest.mock('../../services/ocrService', () => ({ recognizePageText: jest.fn(), recognizePageViaCloud: jest.fn() }));
const photo = { uri: 'file:///cache/normalized.png', width: 1200, height: 800, sourceWidth: 1200, sourceHeight: 800, rotation: 0 };
beforeEach(() => {
  jest.clearAllMocks(); Platform.OS = 'android'; (Constants as any).appOwnership = null; (Constants as any).executionEnvironment = 'bare';
  mockResult = { uri: photo.uri, width: 1200, height: 800 };
  mockPicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
  mockPicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///gallery/original.jpg', width: 1200, height: 800, type: 'image' }] });
  mockPicker.launchCameraAsync.mockResolvedValue({ canceled: true });
  mockDelete.mockResolvedValue(undefined); mockRender.mockImplementation(async () => ({ saveAsync: mockSave, release: mockImageRelease }));
});
it('distinguishes camera denial from unavailable camera and picker dismissal', async () => {
  const adapter = createCaptureAdapter(); mockPicker.requestCameraPermissionsAsync.mockResolvedValueOnce({ granted: false });
  await expect(adapter.pick('camera')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' }); expect(mockPicker.launchCameraAsync).not.toHaveBeenCalled();
  mockPicker.launchCameraAsync.mockRejectedValueOnce(new Error()); await expect(adapter.pick('camera')).rejects.toMatchObject({ code: 'CAMERA_UNAVAILABLE' });
  await expect(adapter.pick('camera')).resolves.toBeNull(); expect(mockRender).not.toHaveBeenCalled();
});
it('gallery requires no camera permission and decodes orientation into app-owned pixels', async () => {
  const adapter = createCaptureAdapter(); mockResult = { uri: 'file:///cache/decoded.png', width: 800, height: 1200 };
  await expect(adapter.pick('gallery')).resolves.toMatchObject({ width: 800, height: 1200, sourceWidth: 1200, sourceHeight: 800, rotation: 0 });
  expect(mockPicker.requestCameraPermissionsAsync).not.toHaveBeenCalled(); expect(mockSave).toHaveBeenCalledWith({ format: 'png', base64: false });
  expect(mockPicker.launchImageLibraryAsync).toHaveBeenCalledWith(expect.objectContaining({ allowsEditing: false, exif: false, base64: false }));
  expect(mockImageRelease).toHaveBeenCalled(); expect(mockContextRelease).toHaveBeenCalled();
});
it.each([{ canceled: false, assets: [] }, { canceled: false, assets: [{ uri: 'bad', width: 0, height: 20 }] }, { canceled: false, assets: [{ uri: 'video', width: 100, height: 50, type: 'video' }] }])('rejects invalid selected assets without recognizing', async selected => {
  mockPicker.launchImageLibraryAsync.mockResolvedValueOnce(selected); await expect(createCaptureAdapter().pick('gallery')).rejects.toBeInstanceOf(CaptureError);
  expect(recognizePageText).not.toHaveBeenCalled();
});
it('sends clamped oriented pixel bounds to the installed manipulator and refuses fallback on failure', async () => {
  const adapter = createCaptureAdapter(); mockResult = { uri: 'file:///cache/selection.png', width: 600, height: 400 };
  await expect(adapter.transform(photo, { x: .25, y: .25, width: .5, height: .5 })).resolves.toMatchObject({ uri: 'file:///cache/selection.png' });
  expect(mockCrop).toHaveBeenCalledWith({ originX: 300, originY: 200, width: 600, height: 400 });
  mockRender.mockRejectedValueOnce(new Error()); await expect(adapter.transform(photo, FULL_CROP)).rejects.toMatchObject({ code: 'TRANSFORM_FAILED' });
  expect(recognizePageText).not.toHaveBeenCalled(); expect(recognizePageViaCloud).not.toHaveBeenCalled();
});
it('releases only generated cache images, never gallery originals', async () => {
  const adapter = createCaptureAdapter(); await adapter.pick('gallery'); await adapter.release('file:///gallery/original.jpg'); expect(mockDelete).not.toHaveBeenCalled();
  await adapter.release(photo.uri); expect(mockDelete).toHaveBeenCalledWith(photo.uri, { idempotent: true }); await adapter.release(photo.uri); expect(mockDelete).toHaveBeenCalledTimes(1);
});
it('retains the transformed file until actual native work settles after UI cancellation', async () => {
  const adapter = createCaptureAdapter(); await adapter.pick('gallery'); let settle!: () => void; const work = new Promise<void>(resolve => { settle = resolve; });
  (recognizePageText as jest.Mock).mockImplementationOnce(async (_uri, options) => { options.onNativeWork(work); throw Object.assign(new Error(), { code: 'CANCELED' }); });
  await expect(adapter.recognize(photo.uri, new AbortController().signal)).rejects.toMatchObject({ code: 'CANCELED' });
  await adapter.release(photo.uri); expect(mockDelete).not.toHaveBeenCalled(); settle(); await work; await Promise.resolve(); expect(mockDelete).toHaveBeenCalledTimes(1);
});
it('detects browser, Expo Go and unlinked native engines truthfully', () => {
  (NativeModules as any).TextRecognition = { recognize: jest.fn() }; expect(onDeviceAvailability().available).toBe(true);
  Platform.OS = 'web'; expect(onDeviceAvailability()).toMatchObject({ available: false, message: expect.stringContaining('browser') });
  Platform.OS = 'android'; (Constants as any).appOwnership = 'expo'; expect(onDeviceAvailability().available).toBe(false);
  (Constants as any).appOwnership = null; delete (NativeModules as any).TextRecognition; expect(onDeviceAvailability().available).toBe(false);
});

it.each([
  ['PERMISSION_DENIED', 'Camera access is off for BookConnect. Choose a photo instead, or write your note.'],
  ['CAMERA_UNAVAILABLE', "The camera isn't available here. Choose a photo instead, or write your note."],
  ['INVALID_ASSET', "This photo couldn't be opened. Choose a different one."],
  ['TRANSFORM_FAILED', "This photo couldn't be prepared. Your earlier text is still here."],
] as const)('C1 %s explains the recovery in plain language', (code, message) => {
  expect(new CaptureError(code)).toMatchObject({ code, message });
});
it('C1 availability explains English scanning and each unavailable surface', () => {
  (NativeModules as any).TextRecognition = { recognize: jest.fn() };
  expect(onDeviceAvailability()).toEqual({ available: true, message: 'Scanning reads printed English text. Check the result before you save.' });
  Platform.OS = 'web';
  expect(onDeviceAvailability()).toEqual({ available: false, message: "Scanning text isn't available in the browser. Use the BookConnect app to scan, or write your note here." });
  Platform.OS = 'android'; (Constants as any).appOwnership = 'expo';
  expect(onDeviceAvailability()).toEqual({ available: false, message: "Scanning text isn't available in Expo Go. Use the BookConnect development app to scan, or write your note here." });
  (Constants as any).appOwnership = null; (Constants as any).executionEnvironment = 'storeClient';
  expect(onDeviceAvailability().message).toBe("Scanning text isn't available in Expo Go. Use the BookConnect development app to scan, or write your note here.");
  (Constants as any).executionEnvironment = 'bare'; delete (NativeModules as any).TextRecognition;
  expect(onDeviceAvailability()).toEqual({ available: false, message: "Scanning text isn't available in this version of the app. You can write your note instead." });
});
