import type { ManualNote, NoteFields } from './manualNoteContract';
import { noteFields } from './manualNoteContract';
import type { CaptureAdapter, CapturePhoto } from './captureAdapter';
import type { OcrResult } from '../services/ocrService';
import { autoCropForText, clampCrop, CropSelection, FULL_CROP, rotateCropClockwise } from './captureGeometry';

export type ComposeStep = 'choose' | 'write' | 'intake' | 'crop' | 'review' | 'no-text' | 'failure';
export type CropMode = 'automatic' | 'manual';
export interface EditorPosition { scroll: number; focus: 'text' | 'page' | null; selection?: { start: number; end: number } }
export interface PartialReview { revision: number; acceptedRevision?: number }
interface AutoDetection { photoUri: string; crop: CropSelection; result: OcrResult }
interface Checkpoint {
  fields: NoteFields; baseline?: ManualNote; step: ComposeStep; partial?: PartialReview;
  position: EditorPosition; photo?: CapturePhoto; crop: CropSelection; cropMode: CropMode;
  autoCrop?: CropSelection; autoDetection?: AutoDetection; cropNotice?: string;
  actorId: string; bookId: string; mode: 'create' | 'edit'; noteId?: string;
}
export interface CaptureState {
  fields: NoteFields; baseline?: ManualNote; step: ComposeStep; partial?: PartialReview;
  position: EditorPosition; photo?: CapturePhoto; crop: CropSelection; cropMode: CropMode;
  autoCrop?: CropSelection; autoDetection?: AutoDetection; cropNotice?: string; checkpoint?: Checkpoint;
  busy?: 'picking' | 'detecting' | 'rotating' | 'recognizing'; error?: { code: string; message: string; engine: boolean };
  warningOpen: boolean; restorePosition: number;
}
const position = (): EditorPosition => ({ scroll: 0, focus: null });
const sameCrop = (left: CropSelection, right: CropSelection) => left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
/** One in-memory authority for fields/capture. It is scoped to a mounted actor/book/mode, never a route payload. */
export class NoteCaptureSession {
  private state: CaptureState;
  private listeners = new Set<() => void>();
  private generation = 0; private abort?: AbortController; private disposed = false; private revision = 0;
  private owned = new Set<string>(); private working = new Map<string, number>();
  private mounts = 0;
  constructor(readonly identity: { actorId: string; bookId: string; mode: 'create' | 'edit'; noteId?: string }, private adapter: CaptureAdapter, step: ComposeStep) {
    this.state = { fields: noteFields(), step, crop: FULL_CROP, cropMode: 'automatic', position: position(), warningOpen: false, restorePosition: 0 };
  }
  snapshot = () => this.state;
  mount() { this.mounts++; return () => { this.mounts--; queueMicrotask(() => { if (!this.mounts) this.dispose(); }); }; }
  subscribe = (callback: () => void) => { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; };
  private update(patch: Partial<CaptureState>) {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch }; this.listeners.forEach(callback => callback()); this.collect();
  }
  initialize(fields: NoteFields, baseline?: ManualNote) { this.update({ fields: { ...fields }, baseline }); }
  setFields = (fields: NoteFields) => {
    const partial = this.state.partial && fields.text !== this.state.fields.text ? { revision: ++this.revision } : this.state.partial;
    this.update({ fields: { ...fields }, partial });
  };
  setPosition(patch: Partial<EditorPosition>) { this.update({ position: { ...this.state.position, ...patch } }); }
  setStep(step: ComposeStep) { this.update({ step, error: undefined }); }
  beginScan() {
    this.invalidate();
    const { fields, baseline, step, partial, photo, crop, cropMode, autoCrop, autoDetection, cropNotice } = this.state;
    // Replaces the sole checkpoint; the previous attempt is not an undo history.
    const checkpoint: Checkpoint = { ...this.identity, fields: { ...fields }, baseline, step, partial, photo, crop, cropMode, autoCrop, autoDetection, cropNotice, position: { ...this.state.position } };
    this.update({ checkpoint, photo: undefined, crop: FULL_CROP, cropMode: 'automatic', autoCrop: undefined, autoDetection: undefined, cropNotice: undefined, step: 'intake', busy: undefined, error: undefined, warningOpen: false });
  }
  get firstScan() { const cp = this.state.checkpoint; return !!cp && cp.step === 'choose' && !cp.fields.text.trim() && !cp.fields.page.trim() && cp.mode === 'create'; }
  get meaningfulCapture() { return !!this.state.photo || (!!this.state.checkpoint && this.state.step === 'review'); }
  returnToCrop() {
    const { photo, crop, cropMode, autoCrop, autoDetection, cropNotice } = this.state;
    // A restored B07 has adopted B as its sole origin; returning to its photo starts a fresh attempt from B.
    if (!this.state.checkpoint) this.beginScan();
    this.update({ step: 'crop', photo, crop, cropMode, autoCrop, autoDetection, cropNotice, error: undefined });
  }
  cancelScan(writeInstead = false) {
    const cp = this.state.checkpoint; this.invalidate();
    if (!cp) return;
    this.update({ fields: { ...cp.fields }, baseline: cp.baseline, partial: cp.partial, step: writeInstead && this.firstScan ? 'write' : cp.step,
      photo: cp.photo, crop: cp.crop, cropMode: cp.cropMode, autoCrop: cp.autoCrop, autoDetection: cp.autoDetection, cropNotice: cp.cropNotice,
      position: { ...cp.position }, checkpoint: undefined, busy: undefined, error: undefined, warningOpen: false, restorePosition: this.state.restorePosition + 1 });
  }
  cancelRecognition() { this.invalidate(); this.update({ busy: undefined, step: 'crop', error: undefined }); }
  private invalidate() { this.generation++; this.abort?.abort(); this.abort = undefined; }
  private current(token: number) { return !this.disposed && token === this.generation; }
  private own(photo: CapturePhoto) { this.owned.add(photo.uri); return photo; }
  private retainWorking(uri: string) { this.working.set(uri, (this.working.get(uri) ?? 0) + 1); }
  private releaseWorking(uri: string) {
    const remaining = (this.working.get(uri) ?? 1) - 1;
    if (remaining) this.working.set(uri, remaining); else this.working.delete(uri);
  }
  private collect() {
    // Cancellation allows a new operation before the old native transform settles.
    const retained = new Set([this.state.photo?.uri, this.state.checkpoint?.photo?.uri, ...this.working.keys()]);
    for (const uri of this.owned) if (!retained.has(uri)) { this.owned.delete(uri); void this.adapter.release(uri); }
  }
  async pick(source: 'camera' | 'gallery') {
    if (this.state.busy || !this.state.checkpoint) return;
    const token = ++this.generation; this.update({ busy: 'picking', error: undefined });
    try {
      const photo = await this.adapter.pick(source);
      if (!photo) return; this.own(photo);
      if (!this.current(token)) return;
      this.update({ photo, crop: FULL_CROP, cropMode: 'automatic', autoCrop: undefined, autoDetection: undefined, cropNotice: undefined, step: 'crop', busy: 'detecting' });
      if (!this.adapter.canRecognize) {
        this.update({ cropMode: 'manual', cropNotice: 'Automatic text cropping is unavailable here. The full photo is selected.' });
        return;
      }
      const abort = new AbortController(); this.abort = abort;
      try { await this.detectAndCrop(photo, token, abort.signal); }
      catch (error) { this.handleRecognitionFailure(error, token); }
    } catch (error) {
      if (this.current(token)) this.update({ error: this.classify(error) });
    } finally { if (this.current(token)) { this.abort = undefined; this.update({ busy: undefined }); } this.collect(); }
  }
  setCrop(crop: CropSelection) { if (!this.state.busy) this.update({ crop: clampCrop(crop), cropMode: 'manual', cropNotice: undefined, error: undefined }); }
  resetCrop() {
    if (this.state.busy) return;
    const automatic = this.state.autoCrop;
    this.update({ crop: automatic ?? FULL_CROP, cropMode: automatic ? 'automatic' : 'manual', cropNotice: automatic ? undefined : this.state.cropNotice, error: undefined });
  }
  async rotate() {
    const photo = this.state.photo; if (!photo || this.state.busy) return;
    const token = ++this.generation; const crop = this.state.crop; const automaticCrop = this.state.autoCrop;
    this.retainWorking(photo.uri); this.update({ busy: 'rotating', error: undefined });
    try {
      const rotated = this.own(await this.adapter.rotate(photo));
      if (this.current(token)) {
        const nextCrop = rotateCropClockwise(crop); const nextAutoCrop = automaticCrop ? rotateCropClockwise(automaticCrop) : undefined;
        // Rotation can improve recognition; text detected before it must never be reused.
        this.update({ photo: rotated, crop: nextCrop, autoCrop: nextAutoCrop, autoDetection: undefined });
      }
    } catch (error) { if (this.current(token)) this.update({ error: this.classify(error) }); }
    finally { this.releaseWorking(photo.uri); if (this.current(token)) this.update({ busy: undefined }); this.collect(); }
  }
  private async detectAndCrop(photo: CapturePhoto, token: number, signal: AbortSignal): Promise<OcrResult | undefined> {
    this.retainWorking(photo.uri); let transformed: CapturePhoto | undefined;
    try {
      const result = await this.adapter.recognize(photo.uri, signal);
      if (!this.current(token)) return undefined;
      const automatic = autoCropForText(result.textBounds, photo); const crop = automatic ?? FULL_CROP;
      transformed = this.own(await this.adapter.transform(photo, crop)); this.retainWorking(transformed.uri);
      if (!this.current(token)) return undefined;
      this.update({ crop, cropMode: 'automatic', autoCrop: automatic ?? undefined, autoDetection: { photoUri: photo.uri, crop, result },
        cropNotice: automatic ? undefined : 'Text was recognized, but its bounds were unavailable. The full image remains selected; adjust the crop if needed.', error: undefined });
      return result;
    } finally {
      this.releaseWorking(photo.uri); if (transformed) this.releaseWorking(transformed.uri); this.collect();
    }
  }
  private adopt(result: OcrResult) {
    if (!result.reviewText.trim()) { this.update({ step: 'no-text' }); return; }
    const partial = result.reviewOverflow ? { revision: ++this.revision } : undefined;
    this.update({ fields: { ...this.state.fields, text: result.reviewText }, partial, warningOpen: !!partial, step: 'review', position: position(), restorePosition: this.state.restorePosition + 1 });
  }
  private handleRecognitionFailure(error: unknown, token: number) {
    if (!this.current(token)) return;
    const classified = this.classify(error);
    if (classified.code === 'CANCELED') this.update({ step: 'crop', error: undefined });
    else if (classified.code === 'NO_TEXT') this.update({ step: 'no-text', error: undefined });
    else if (classified.code === 'TRANSFORM_FAILED') this.update({ step: 'crop', error: classified });
    else this.update({ step: 'failure', error: classified });
  }
  async recognize() {
    const photo = this.state.photo; if (!photo || this.state.busy || !this.state.checkpoint || !this.adapter.canRecognize) return;
    const cached = this.state.autoDetection;
    if (this.state.cropMode === 'automatic' && cached?.photoUri === photo.uri && sameCrop(cached.crop, this.state.crop)) {
      this.adopt(cached.result); return;
    }
    const token = ++this.generation; const abort = new AbortController(); this.abort = abort;
    if (this.state.cropMode === 'automatic') {
      this.update({ busy: 'detecting', error: undefined });
      try { const result = await this.detectAndCrop(photo, token, abort.signal); if (this.current(token) && result) this.adopt(result); }
      catch (error) { this.handleRecognitionFailure(error, token); }
      finally { if (this.current(token)) { this.abort = undefined; this.update({ busy: undefined }); } this.collect(); }
      return;
    }
    this.retainWorking(photo.uri); this.update({ busy: 'recognizing', error: undefined });
    let transformed: CapturePhoto | undefined;
    try {
      transformed = this.own(await this.adapter.transform(photo, this.state.crop)); this.retainWorking(transformed.uri);
      if (!this.current(token)) return;
      const result = await this.adapter.recognize(transformed.uri, abort.signal);
      if (!this.current(token)) return;
      this.adopt(result);
    } catch (error) {
      this.handleRecognitionFailure(error, token);
    } finally {
      this.releaseWorking(photo.uri); if (transformed) this.releaseWorking(transformed.uri);
      if (this.current(token)) { this.abort = undefined; this.update({ busy: undefined }); } this.collect();
    }
  }
  openPartialWarning() { this.update({ warningOpen: true }); }
  keepPartialEditing() { this.update({ warningOpen: false }); }
  acceptPartial() { if (this.state.partial) this.update({ partial: { ...this.state.partial, acceptedRevision: this.state.partial.revision }, warningOpen: false }); }
  get partialUnaccepted() { return !!this.state.partial && this.state.partial.acceptedRevision !== this.state.partial.revision; }
  private classify(error: unknown) {
    const code = (error as { code?: string })?.code ?? 'LOCAL_FAILED';
    const engine = ['ON_DEVICE_UNAVAILABLE', 'UNSUPPORTED_SCRIPT'].includes(code);
    const message = engine ? 'Scanning text is unavailable in this app. Your earlier text is still here. Return to writing.'
      : error instanceof Error && ['PERMISSION_DENIED', 'CAMERA_UNAVAILABLE', 'INVALID_ASSET', 'TRANSFORM_FAILED'].includes(code) ? error.message
      : 'This scan could not be processed. Your earlier text is still here.';
    return { code, message, engine };
  }
  dispose() {
    this.invalidate(); this.disposed = true; this.listeners.clear();
    // In-flight transforms retain their input until settling. Native recognition leases are held by the adapter.
    this.state = { fields: noteFields(), step: 'choose', crop: FULL_CROP, cropMode: 'automatic', position: position(), warningOpen: false, restorePosition: 0 }; this.collect();
  }
}
