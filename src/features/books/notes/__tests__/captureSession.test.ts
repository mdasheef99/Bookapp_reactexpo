import { NoteCaptureSession } from '../captureSession';
import type { CaptureAdapter, CapturePhoto } from '../captureAdapter';
import { noteFields } from '../manualNoteContract';
import { adjustCropEdge, autoCropForText, containedImage, cropPixels, FULL_CROP, moveCropCorner, rotateCropClockwise } from '../captureGeometry';

const photo: CapturePhoto = { uri: 'owned-photo', width: 1200, height: 800, sourceWidth: 1200, sourceHeight: 800, rotation: 0 };
const result = (text = 'Candidate B', partial = false) => ({ version: 1 as const, provider: 'on-device' as const, languageHint: 'en' as const, reviewText: text, reviewOverflow: partial, textBounds: [{ left: 120, top: 80, width: 480, height: 300 }] });
function setup(step: 'choose' | 'write' | 'review' = 'write', mode: 'create' | 'edit' = 'create') {
  const adapter: jest.Mocked<CaptureAdapter> = {
    canRecognize: true,
    pick: jest.fn().mockResolvedValue(photo), rotate: jest.fn().mockResolvedValue({ ...photo, uri: 'rotated', width: 800, height: 1200, rotation: 90 }),
    transform: jest.fn().mockResolvedValue({ ...photo, uri: 'transformed-selection', width: 600, height: 400 }), recognize: jest.fn().mockResolvedValue(result()), release: jest.fn().mockResolvedValue(undefined),
  };
  const session = new NoteCaptureSession({ actorId: 'actor', bookId: 'book', mode, noteId: mode === 'edit' ? 'saved-id' : undefined }, adapter, step);
  return { session, adapter };
}
async function scan(session: NoteCaptureSession) { session.beginScan(); await session.pick('gallery'); await session.recognize(); }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

it.each([
  ['ON_DEVICE_UNAVAILABLE', true, "Scanning text isn't available in this app. Your earlier text is still here."],
  ['UNSUPPORTED_SCRIPT', true, "Scanning text isn't available in this app. Your earlier text is still here."],
  ['LOCAL_FAILED', false, "This page couldn't be read. Your earlier text is still here."],
] as const)('C1 %s keeps earlier text and describes failure plainly', async (code, engine, message) => {
  const { session, adapter } = setup(); session.initialize({ text: 'Earlier text', category: null, page: '' });
  adapter.recognize.mockRejectedValueOnce(Object.assign(new Error(), { code }));
  session.beginScan(); await session.pick('gallery');
  expect(session.snapshot()).toMatchObject({ step: 'failure', fields: { text: 'Earlier text' }, error: { code, engine, message } });
});

it('maps a known non-square letterboxed selection to independent expected source bounds', () => {
  expect(containedImage({ width: 1200, height: 800 }, { width: 300, height: 300 })).toEqual({ x: 0, y: 50, width: 300, height: 200 });
  const selected = moveCropCorner(FULL_CROP, 'start', 75, 50, { width: 300, height: 200 });
  expect(cropPixels(photo, selected)).toEqual({ originX: 300, originY: 200, width: 900, height: 600 });
  expect(cropPixels(photo, { x: .25, y: .25, width: .5, height: .5 })).toEqual({ originX: 300, originY: 200, width: 600, height: 400 });
});
it('rotates the selected text area clockwise and resets to those bounds in the oriented image', async () => {
  expect(rotateCropClockwise({ x: .1, y: .2, width: .3, height: .4 })).toEqual({ x: .4, y: .1, width: .4, height: .3 });
  const { session } = setup(); session.beginScan(); await session.pick('gallery'); session.setCrop({ x: .25, y: .25, width: .5, height: .5 }); await session.rotate();
  expect(cropPixels(session.snapshot().photo!, session.snapshot().crop)).toEqual({ originX: 200, originY: 300, width: 400, height: 600 });
  session.resetCrop(); expect(session.snapshot().crop.x).toBeCloseTo(.505, 12); expect(session.snapshot().crop.y).toBe(.08);
  expect(session.snapshot().crop.width).toBe(.415); expect(session.snapshot().crop.height).toBe(.44);
  expect(cropPixels(session.snapshot().photo!, session.snapshot().crop)).toEqual({ originX: 404, originY: 96, width: 333, height: 528 });
});
it('clamps edges, rejects invalid dimensions and never allows an empty selection', () => {
  expect(cropPixels({ width: 1, height: 1 }, { x: 2, y: -2, width: -1, height: 4 })).toEqual({ originX: 0, originY: 0, width: 1, height: 1 });
  expect(() => cropPixels({ width: 0, height: 1 }, FULL_CROP)).toThrow();
  expect(() => cropPixels(photo, { ...FULL_CROP, x: NaN })).toThrow();
  expect(adjustCropEdge(FULL_CROP, 'left', true)).toEqual({ x: .05, y: 0, width: .95, height: 1 });
});
it('automatically crops around the union of valid printed-text bounds with 2% image padding', () => {
  expect(autoCropForText([
    { left: 100, top: 200, width: 200, height: 40 },
    { left: 300, top: 500, width: 400, height: 100 },
    { left: 30, top: 20, width: 0, height: 80 },
  ], { width: 1000, height: 800 })).toEqual({ x: .08, y: .23, width: .64, height: .54 });
  expect(autoCropForText([{ left: 5, top: 8, width: 40, height: 20 }], { width: 1000, height: 800 }))
    .toEqual({ x: 0, y: 0, width: .065, height: .055 });
  expect(autoCropForText([{ left: 10, top: 10, width: 0, height: 20 }], { width: 1000, height: 800 })).toBeNull();
});
it.each(['choose', 'write', 'review'] as const)('picker dismissal retains the exact launching state for %s', async step => {
  const { session, adapter } = setup(step); session.initialize({ text: 'A', category: 'question', page: '24' }); session.beginScan();
  adapter.pick.mockResolvedValueOnce(null); await session.pick('gallery'); expect(session.snapshot().step).toBe('intake');
  session.cancelScan(); expect(session.snapshot()).toMatchObject({ step, fields: { text: 'A', category: 'question', page: '24' } });
});
it('replacement-photo dismissal retains the current selected photo and crop', async () => {
  const { session, adapter } = setup(); session.beginScan(); await session.pick('gallery'); session.setCrop({ x: .2, y: .1, width: .4, height: .6 });
  adapter.pick.mockResolvedValueOnce(null); const before = session.snapshot(); await session.pick('gallery');
  expect(session.snapshot().photo).toBe(before.photo); expect(session.snapshot().crop).toBe(before.crop); expect(session.snapshot().step).toBe('crop');
  expect(adapter.recognize).toHaveBeenCalledTimes(1);
});
it('auto-detects text on the selected photo, crops to its padded bounds, and reuses that scan for review', async () => {
  const { session, adapter } = setup('choose'); session.beginScan(); await session.pick('gallery');
  expect(adapter.recognize).toHaveBeenCalledTimes(1);
  expect(adapter.recognize.mock.calls[0][0]).toBe(photo.uri);
  expect(adapter.transform).toHaveBeenCalledWith(photo, { x: .08, y: .08, width: .44, height: .415 });
  expect(session.snapshot()).toMatchObject({ step: 'crop', cropMode: 'automatic', crop: { x: .08, y: .08, width: .44, height: .415 } });
  await session.recognize();
  expect(adapter.recognize).toHaveBeenCalledTimes(1);
  expect(session.snapshot()).toMatchObject({ step: 'review', fields: { text: 'Candidate B' } });
});
it('makes missing text bounds explicit and keeps the full-image crop visible as a recovery choice', async () => {
  const { session, adapter } = setup(); adapter.recognize.mockResolvedValueOnce({ ...result(), textBounds: undefined });
  session.beginScan(); await session.pick('gallery');
  expect(session.snapshot()).toMatchObject({ step: 'crop', crop: FULL_CROP, cropMode: 'automatic', cropNotice: 'Text was found, but not where it sits on the page. The whole photo is selected; adjust the crop if needed.' });
  expect(adapter.transform).toHaveBeenCalledWith(photo, FULL_CROP);
  await session.recognize(); expect(session.snapshot().fields.text).toBe('Candidate B'); expect(adapter.recognize).toHaveBeenCalledTimes(1);
});
it('recognizes a manually adjusted crop from the transformed image URI', async () => {
  const { session, adapter } = setup(); session.beginScan(); await session.pick('gallery');
  const selection = { x: .1, y: .2, width: .5, height: .4 }; session.setCrop(selection); await session.recognize();
  expect(adapter.transform).toHaveBeenLastCalledWith(photo, selection);
  expect(adapter.recognize).toHaveBeenLastCalledWith('transformed-selection', expect.any(AbortSignal));
  expect(adapter.recognize).toHaveBeenCalledTimes(2);
});
it('reads the rotated image again so rotation can improve recognition rather than reuse old text', async () => {
  const { session, adapter } = setup(); session.beginScan(); await session.pick('gallery'); await session.rotate();
  adapter.recognize.mockResolvedValueOnce(result('Correctly oriented text'));
  await session.recognize();
  expect(session.snapshot().fields.text).toBe('Correctly oriented text');
  expect(adapter.recognize).toHaveBeenLastCalledWith('rotated', expect.any(AbortSignal));
});
it('allows photo preparation on a surface without native OCR instead of automatically invoking an unavailable engine', async () => {
  const { session, adapter } = setup(); adapter.canRecognize = false; session.beginScan(); await session.pick('gallery');
  expect(session.snapshot()).toMatchObject({ step: 'crop', photo, crop: FULL_CROP, cropMode: 'manual' });
  expect(session.snapshot().cropNotice).toBe('The whole photo is selected. Adjust the crop if you only want part of it.');
  expect(adapter.recognize).not.toHaveBeenCalled(); expect(adapter.transform).not.toHaveBeenCalled();
});
it('never falls back to the original image when transformation fails', async () => {
  const { session, adapter } = setup(); session.initialize({ text: 'A', category: null, page: '' }); session.beginScan(); await session.pick('gallery');
  session.setCrop({ x: .15, y: .1, width: .7, height: .8 });
  adapter.transform.mockRejectedValueOnce(Object.assign(new Error('Could not prepare'), { code: 'TRANSFORM_FAILED' })); await session.recognize();
  expect(session.snapshot()).toMatchObject({ step: 'crop', fields: { text: 'A' }, error: { code: 'TRANSFORM_FAILED' } }); expect(adapter.recognize).toHaveBeenCalledTimes(1);
});
it('retains create/edit identity, saved baseline, metadata, focus and scroll through cancellation', async () => {
  const { session } = setup('write', 'edit'); const baseline = { id: 'saved-id', content: 'Saved', version: 8 } as any;
  session.initialize({ text: 'Draft A', category: 'apply', page: '37' }, baseline); session.setPosition({ scroll: 480, focus: 'page', selection: { start: 2, end: 4 } });
  await scan(session); expect(session.snapshot().fields).toEqual({ text: 'Candidate B', category: 'apply', page: '37' }); expect(session.identity.noteId).toBe('saved-id');
  session.cancelScan(); expect(session.snapshot()).toMatchObject({ step: 'write', baseline, fields: { text: 'Draft A', category: 'apply', page: '37' }, position: { scroll: 480, focus: 'page', selection: { start: 2, end: 4 } } });
});
it('Scan 2 replaces its sole checkpoint with B; cancel restores B, not A', async () => {
  const { session, adapter } = setup(); session.initialize({ text: 'A', category: 'reflect', page: '4' }); await scan(session);
  adapter.recognize.mockResolvedValueOnce(result('C')); await scan(session); expect(session.snapshot().fields.text).toBe('C');
  expect(session.snapshot().checkpoint?.fields.text).toBe('Candidate B'); session.cancelScan();
  expect(session.snapshot().fields.text).toBe('Candidate B'); expect(session.snapshot().step).toBe('review'); expect(session.snapshot().checkpoint).toBeUndefined();
  session.returnToCrop(); expect(session.snapshot().checkpoint?.fields.text).toBe('Candidate B'); await session.recognize();
  session.cancelScan(); expect(session.snapshot().fields.text).toBe('Candidate B');
});
it('binds partial acknowledgement to text revision; complete replacement clears provenance', async () => {
  const { session, adapter } = setup(); adapter.recognize.mockResolvedValueOnce(result('Partial text', true)); await scan(session);
  expect(session.snapshot().warningOpen).toBe(true); session.keepPartialEditing(); expect(session.partialUnaccepted).toBe(true);
  session.acceptPartial(); expect(session.partialUnaccepted).toBe(false); session.setFields({ ...session.snapshot().fields, page: '24', category: 'question' }); expect(session.partialUnaccepted).toBe(false);
  session.setFields({ ...session.snapshot().fields, text: 'Edited partial' }); expect(session.partialUnaccepted).toBe(true);
  session.openPartialWarning(); session.acceptPartial(); await scan(session); expect(session.snapshot().partial).toBeUndefined();
});
it('canceled partial replacement restores the exact prior acknowledgement', async () => {
  const { session, adapter } = setup(); adapter.recognize.mockResolvedValueOnce(result('B', true)); await scan(session); session.acceptPartial();
  session.beginScan(); session.cancelScan(); expect(session.snapshot().fields.text).toBe('B'); expect(session.partialUnaccepted).toBe(false);
});
it.each(['NO_TEXT', 'LOCAL_FAILED', 'ON_DEVICE_UNAVAILABLE'])('distinct %s recovery keeps the checkpoint and does not overwrite text', async code => {
  const { session, adapter } = setup(); session.initialize({ text: 'A', category: 'distill', page: '3' }); session.beginScan();
  adapter.recognize.mockRejectedValueOnce(Object.assign(new Error(), { code })); await session.pick('gallery');
  expect(session.snapshot().step).toBe(code === 'NO_TEXT' ? 'no-text' : 'failure'); expect(session.snapshot().fields.text).toBe('A');
  if (code === 'ON_DEVICE_UNAVAILABLE') expect(session.snapshot().error?.engine).toBe(true);
  session.cancelScan(); expect(session.snapshot().fields.text).toBe('A');
});
it('cancel recognition aborts adoption and remains on crop; a late result cannot replace a newer scan', async () => {
  const { session, adapter } = setup(); session.initialize({ text: 'A', category: null, page: '' }); session.beginScan(); await session.pick('gallery');
  session.setCrop({ x: .1, y: .2, width: .7, height: .6 });
  const late = deferred<ReturnType<typeof result>>(); adapter.recognize.mockReturnValueOnce(late.promise); const work = session.recognize(); await Promise.resolve();
  const signal = adapter.recognize.mock.calls.at(-1)![1]; session.cancelRecognition(); expect(signal.aborted).toBe(true); expect(session.snapshot().step).toBe('crop');
  session.cancelScan(); await scan(session); late.resolve(result('Obsolete')); await work; expect(session.snapshot().fields.text).toBe('Candidate B');
});
it('canceling automatic bounds detection ignores late text and does not create a crop', async () => {
  const { session, adapter } = setup(); session.initialize({ text: 'Prior', category: null, page: '' }); session.beginScan();
  const late = deferred<ReturnType<typeof result>>(); adapter.recognize.mockReturnValueOnce(late.promise); const work = session.pick('gallery'); await Promise.resolve();
  const signal = adapter.recognize.mock.calls[0][1]; session.cancelRecognition(); expect(signal.aborted).toBe(true);
  late.resolve(result('Obsolete')); await work;
  expect(session.snapshot()).toMatchObject({ step: 'crop', fields: { text: 'Prior' }, autoDetection: undefined, crop: FULL_CROP });
  expect(adapter.transform).not.toHaveBeenCalled();
});
it('dispose on actor/book change invalidates late picker and recognition work and clears fields', async () => {
  const { session, adapter } = setup(); session.initialize({ text: 'Private fixture', category: null, page: '' }); session.beginScan();
  const late = deferred<CapturePhoto | null>(); adapter.pick.mockReturnValueOnce(late.promise); const work = session.pick('gallery'); session.dispose(); late.resolve(photo); await work;
  expect(session.snapshot().fields).toEqual(noteFields()); expect(adapter.release).toHaveBeenCalledWith('owned-photo');
  const next = new NoteCaptureSession({ actorId: 'other', bookId: 'other-book', mode: 'create' }, adapter, 'choose'); expect(next.snapshot().fields.text).toBe('');
});
it('protects blank capture work, preserves checkpoint images, and releases superseded owned references', async () => {
  const { session, adapter } = setup('choose'); session.beginScan(); await session.pick('gallery'); expect(session.meaningfulCapture).toBe(true);
  await session.recognize(); session.beginScan(); expect(adapter.release).not.toHaveBeenCalledWith('owned-photo');
  adapter.pick.mockResolvedValueOnce({ ...photo, uri: 'new-photo' }); await session.pick('gallery'); session.cancelScan();
  expect(session.snapshot().photo?.uri).toBe('owned-photo'); expect(adapter.release).toHaveBeenCalledWith('new-photo'); session.dispose(); expect(adapter.release).toHaveBeenCalledWith('owned-photo');
});

it.each([
  ['first', 'cancel'], ['second', 'cancel'], ['first', 'dispose'], ['second', 'dispose'],
] as const)('retains overlapping transforms until their last use settles (%s first, %s)', async (settlesFirst, boundary) => {
  const { session, adapter } = setup(); session.initialize({ text: 'A', category: 'question', page: '24' });
  session.beginScan(); await session.pick('gallery');
  session.setCrop({ x: .2, y: .1, width: .5, height: .7 });
  const first = deferred<CapturePhoto>(); const second = deferred<CapturePhoto>();
  adapter.transform.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const firstWork = session.recognize(); session.cancelRecognition(); const secondWork = session.recognize();
  if (boundary === 'cancel') session.cancelScan(); else session.dispose();
  const work = { first: firstWork, second: secondWork }; const pending = { first, second };
  const settlesLast = settlesFirst === 'first' ? 'second' : 'first';
  pending[settlesFirst].resolve({ ...photo, uri: `${settlesFirst}-selection` }); await work[settlesFirst];
  expect(adapter.release).not.toHaveBeenCalledWith(photo.uri);
  pending[settlesLast].resolve({ ...photo, uri: `${settlesLast}-selection` }); await work[settlesLast];
  expect(adapter.release.mock.calls.filter(([uri]) => uri === photo.uri)).toHaveLength(1);
  expect(adapter.release.mock.calls.filter(([uri]) => uri === 'first-selection')).toHaveLength(1);
  expect(adapter.release.mock.calls.filter(([uri]) => uri === 'second-selection')).toHaveLength(1);
  expect(adapter.recognize).toHaveBeenCalledTimes(1);
  expect(session.snapshot().fields.text).toBe(boundary === 'cancel' ? 'A' : '');
  if (boundary === 'dispose') {
    const next = new NoteCaptureSession({ actorId: 'other', bookId: 'other-book', mode: 'create' }, adapter, 'choose');
    expect(next.snapshot().fields).toEqual(noteFields()); expect(next.snapshot().photo).toBeUndefined();
  }
});

it.each(['first', 'second'] as const)('retains overlapping rotations through disposal and out-of-order settlement (%s first)', async settlesFirst => {
  const { session, adapter } = setup(); await scan(session);
  // Adopted review retains the source. Canceling this new attempt restores that same photo.
  session.beginScan(); session.cancelScan(); session.returnToCrop();
  const first = deferred<CapturePhoto>(); const second = deferred<CapturePhoto>();
  adapter.rotate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const firstWork = session.rotate(); session.cancelScan(); session.returnToCrop(); const secondWork = session.rotate();
  session.dispose();
  const work = { first: firstWork, second: secondWork }; const pending = { first, second };
  const settlesLast = settlesFirst === 'first' ? 'second' : 'first';
  pending[settlesFirst].resolve({ ...photo, uri: `${settlesFirst}-rotation`, width: 800, height: 1200 }); await work[settlesFirst];
  expect(adapter.release).not.toHaveBeenCalledWith(photo.uri);
  pending[settlesLast].resolve({ ...photo, uri: `${settlesLast}-rotation`, width: 800, height: 1200 }); await work[settlesLast];
  expect(adapter.release.mock.calls.filter(([uri]) => uri === photo.uri)).toHaveLength(1);
  expect(adapter.release.mock.calls.filter(([uri]) => uri === 'first-rotation')).toHaveLength(1);
  expect(adapter.release.mock.calls.filter(([uri]) => uri === 'second-rotation')).toHaveLength(1);
  expect(session.snapshot()).toMatchObject({ fields: noteFields(), step: 'choose' }); expect(session.snapshot().photo).toBeUndefined();
});
