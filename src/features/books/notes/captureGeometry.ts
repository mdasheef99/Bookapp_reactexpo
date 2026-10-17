/** Coordinates are normalized against the decoded, oriented image, never its letterbox. */
export interface CropSelection { x: number; y: number; width: number; height: number }
export interface ImageSize { width: number; height: number }
export interface TextFrame { left: number; top: number; width: number; height: number }
export const FULL_CROP: CropSelection = Object.freeze({ x: 0, y: 0, width: 1, height: 1 });
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export function validImageSize(size: ImageSize): boolean {
  return Number.isSafeInteger(size.width) && Number.isSafeInteger(size.height) && size.width > 0 && size.height > 0;
}
export function clampCrop(crop: CropSelection): CropSelection {
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)) throw new Error('Invalid crop');
  const x = clamp(crop.x, 0, 0.99); const y = clamp(crop.y, 0, 0.99);
  return { x, y, width: clamp(crop.width, 0.01, 1 - x), height: clamp(crop.height, 0.01, 1 - y) };
}
export function cropPixels(size: ImageSize, selection: CropSelection) {
  if (!validImageSize(size)) throw new Error('Invalid image dimensions');
  const crop = clampCrop(selection);
  const originX = Math.min(size.width - 1, Math.floor(crop.x * size.width));
  const originY = Math.min(size.height - 1, Math.floor(crop.y * size.height));
  const right = Math.min(size.width, Math.max(originX + 1, Math.ceil((crop.x + crop.width) * size.width)));
  const bottom = Math.min(size.height, Math.max(originY + 1, Math.ceil((crop.y + crop.height) * size.height)));
  return { originX, originY, width: right - originX, height: bottom - originY };
}
/** Returns a padded crop around all valid ML Kit text frames, or null when frames are absent. */
export function autoCropForText(frames: readonly TextFrame[] | undefined, size: ImageSize): CropSelection | null {
  if (!validImageSize(size) || !frames?.length) return null;
  const valid = frames.filter(frame => [frame.left, frame.top, frame.width, frame.height].every(Number.isFinite)
    && frame.width > 0 && frame.height > 0);
  if (!valid.length) return null;
  const paddingX = size.width * 0.02; const paddingY = size.height * 0.02;
  const left = Math.max(0, Math.min(...valid.map(frame => frame.left)) - paddingX);
  const top = Math.max(0, Math.min(...valid.map(frame => frame.top)) - paddingY);
  const right = Math.min(size.width, Math.max(...valid.map(frame => frame.left + frame.width)) + paddingX);
  const bottom = Math.min(size.height, Math.max(...valid.map(frame => frame.top + frame.height)) + paddingY);
  if (right <= left || bottom <= top) return null;
  return clampCrop({ x: left / size.width, y: top / size.height, width: (right - left) / size.width, height: (bottom - top) / size.height });
}
export function rotateCropClockwise(crop: CropSelection): CropSelection {
  const c = clampCrop(crop);
  return clampCrop({ x: 1 - c.y - c.height, y: c.x, width: c.height, height: c.width });
}
export function containedImage(size: ImageSize, frame: ImageSize) {
  if (!validImageSize(size) || frame.width <= 0 || frame.height <= 0) return { x: 0, y: 0, width: 0, height: 0 };
  const scale = Math.min(frame.width / size.width, frame.height / size.height);
  return { x: (frame.width - size.width * scale) / 2, y: (frame.height - size.height * scale) / 2, width: size.width * scale, height: size.height * scale };
}
export function moveCropCorner(crop: CropSelection, corner: 'start' | 'end', dx: number, dy: number, displayed: ImageSize): CropSelection {
  if (displayed.width <= 0 || displayed.height <= 0) return crop;
  const right = crop.x + crop.width; const bottom = crop.y + crop.height;
  if (corner === 'start') {
    const x = clamp(crop.x + dx / displayed.width, 0, right - 0.01);
    const y = clamp(crop.y + dy / displayed.height, 0, bottom - 0.01);
    return clampCrop({ x, y, width: right - x, height: bottom - y });
  }
  return clampCrop({ ...crop, width: crop.width + dx / displayed.width, height: crop.height + dy / displayed.height });
}
export function adjustCropEdge(crop: CropSelection, edge: 'left' | 'top' | 'right' | 'bottom', inward: boolean): CropSelection {
  const amount = inward ? 0.05 : -0.05; const right = crop.x + crop.width; const bottom = crop.y + crop.height;
  if (edge === 'left') { const x = clamp(crop.x + amount, 0, right - 0.01); return clampCrop({ ...crop, x, width: right - x }); }
  if (edge === 'top') { const y = clamp(crop.y + amount, 0, bottom - 0.01); return clampCrop({ ...crop, y, height: bottom - y }); }
  if (edge === 'right') return clampCrop({ ...crop, width: crop.width - amount });
  return clampCrop({ ...crop, height: crop.height - amount });
}
