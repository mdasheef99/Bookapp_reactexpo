import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ScrollView, Text } from 'react-native';
import { Asset } from 'expo-asset';
import * as fs from 'expo-file-system/legacy';
import { NoteCrop } from '@/components/notes/NoteCrop';
import { NoteButton, NoteMessage, useNoteColors } from '@/components/notes/ManualNoteUi';
import { CaptureAdapter, CapturePhoto, createCaptureAdapter } from '@/features/books/notes/captureAdapter';
import { NoteCaptureSession } from '@/features/books/notes/captureSession';
import type { CropSelection } from '@/features/books/notes/captureGeometry';
import type { OcrResult } from '@/features/books/services/ocrService';

const PAGE = require('../docs/user/library/evidence/sdd06-capture-ocr-2026-10-11/fixtures/english-page.png');
export default function NativeAutoCropProof() {
  const [photo, setPhoto] = useState<CapturePhoto>();
  useEffect(() => { let active = true; void (async () => {
    const asset = Asset.fromModule(PAGE); await asset.downloadAsync();
    if (active) setPhoto({ uri: asset.localUri ?? asset.uri, width: 1600, height: 2200, sourceWidth: 1600, sourceHeight: 2200, rotation: 0 });
  })(); return () => { active = false; }; }, []);
  return photo ? <Proof photo={photo} /> : <Text>Loading synthetic printed page…</Text>;
}
function Proof({ photo }: { photo: CapturePhoto }) {
  const colors = useNoteColors(); const started = useRef(false); const [status, setStatus] = useState('Finding printed text automatically…');
  const [proof] = useState(() => {
    const native = createCaptureAdapter();
    const operations = { recognitions: [] as { input: string; elapsedMs: number; result: OcrResult }[], transforms: [] as { crop: CropSelection; width: number; height: number }[] };
    const adapter: CaptureAdapter = { ...native, pick: async () => photo,
      recognize: async (uri, signal) => { const began = Date.now(); const result = await native.recognize(uri, signal);
        operations.recognitions.push({ input: uri === photo.uri ? 'source' : 'transformed', elapsedMs: Date.now() - began, result }); return result; },
      transform: async (source, crop) => { const output = await native.transform(source, crop);
        const filename = operations.transforms.length ? 'native-manual-crop-output.png' : 'native-auto-crop-output.png';
        if (fs.documentDirectory) await fs.copyAsync({ from: output.uri, to: `${fs.documentDirectory}${filename}` });
        operations.transforms.push({ crop, width: output.width, height: output.height }); return output; },
    };
    return { session: new NoteCaptureSession({ actorId: 'synthetic-actor', bookId: 'synthetic-book', mode: 'create' }, adapter, 'write'), operations };
  });
  const state = useSyncExternalStore(proof.session.subscribe, proof.session.snapshot, proof.session.snapshot);
  const persist = async () => { if (fs.documentDirectory) await fs.writeAsStringAsync(`${fs.documentDirectory}native-auto-crop-proof.json`, JSON.stringify({
    source: { width: photo.width, height: photo.height }, operations: proof.operations,
    state: { step: proof.session.snapshot().step, crop: proof.session.snapshot().crop, cropMode: proof.session.snapshot().cropMode,
      autoCrop: proof.session.snapshot().autoCrop, cropNotice: proof.session.snapshot().cropNotice, text: proof.session.snapshot().fields.text, error: proof.session.snapshot().error },
  }, null, 2)); };
  useEffect(() => { const cleanup = proof.session.mount(); if (!started.current) { started.current = true; proof.session.beginScan();
    void proof.session.pick('gallery').then(async () => { await persist(); setStatus(`Automatic crop ready. Native OCR calls: ${proof.operations.recognitions.length}`); });
  } return cleanup; }, [proof]);
  const review = async () => { await proof.session.recognize(); await persist(); setStatus(`Review ready. Native OCR calls: ${proof.operations.recognitions.length}`); };
  return <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 36, gap: 12, backgroundColor: colors.bgPrimary }}>
    <Text accessibilityRole="header" style={{ fontSize: 24, color: colors.textPrimary }}>Automatic printed-text crop proof</Text>
    <NoteMessage message={status} />
    {state.photo && <NoteCrop photo={state.photo} crop={state.crop} cropMode={state.cropMode} autoDetected={!!state.autoCrop}
      cropNotice={state.cropNotice} disabled={!!state.busy} onChange={crop => proof.session.setCrop(crop)} onReset={() => proof.session.resetCrop()} />}
    <Text accessibilityLabel="Current automatic crop" style={{ color: colors.textPrimary }}>{JSON.stringify(state.crop)}</Text>
    <NoteButton label={state.cropMode === 'automatic' ? 'Review recognized text' : 'Recognize adjusted crop'} disabled={!!state.busy} onPress={() => void review()} />
    <NoteButton label="Write current receipt" secondary disabled={!!state.busy} onPress={() => void persist()} />
    {!!state.fields.text && <Text selectable accessibilityLabel="Recognized fixture text" style={{ color: colors.textPrimary }}>{state.fields.text}</Text>}
    {!!state.error && <NoteMessage message={state.error.message} error />}
  </ScrollView>;
}
