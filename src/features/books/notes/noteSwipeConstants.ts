export const NOTE_SWIPE = Object.freeze({
  horizontalFraction: 0.3,
  verticalFraction: 0.2,
  velocity: 800,
  axisLock: 10,
  tapMaxDistance: 8,
  tapMaxDuration: 500,
  safetyMarginMs: 200,
  maxTilt: 12,
  backgroundMs: 250,
  exitMs: 180,
  crossFadeMs: 100,
  hintMs: 120,
  batchSize: 20,
  pageSize: 1000,
});
export type SwipeDirection = 'next' | 'previous' | 'leave' | 'cancel';
/** Called inside the UI worklet; a fling must agree with the drag's sign. Up is reserved for C3. */
export function swipeDirection(axis: number, x: number, y: number, vx: number, vy: number, width: number, height: number): SwipeDirection {
  'worklet';
  if (axis === 1 && (Math.abs(x) >= width * NOTE_SWIPE.horizontalFraction || (Math.abs(vx) > NOTE_SWIPE.velocity && vx * x > 0))) return x < 0 ? 'next' : 'previous';
  if (axis === 2 && y > 0 && (y >= height * NOTE_SWIPE.verticalFraction || (vy > NOTE_SWIPE.velocity && vy * y > 0))) return 'leave';
  return 'cancel';
}
