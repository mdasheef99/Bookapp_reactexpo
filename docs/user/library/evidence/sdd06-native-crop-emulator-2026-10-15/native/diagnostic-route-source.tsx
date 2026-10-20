import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import * as fs from 'expo-file-system/legacy';
import { NoteCrop } from '@/components/notes/NoteCrop';
import { NoteButton, NoteMessage, useNoteColors } from '@/components/notes/ManualNoteUi';
import { CapturePhoto, createCaptureAdapter, onDeviceAvailability } from '@/features/books/notes/captureAdapter';
import { CropSelection, FULL_CROP } from '@/features/books/notes/captureGeometry';

const PAGE_ASSET = require('../docs/user/library/evidence/sdd06-capture-ocr-2026-10-11/fixtures/english-page.png');

export default function NativeCaptureProof() {
  const colors = useNoteColors();
  const adapter = useRef(createCaptureAdapter());
  const [photo, setPhoto] = useState<CapturePhoto | null>(null);
  const [crop, setCrop] = useState<CropSelection>(FULL_CROP);
  const [status, setStatus] = useState('Loading original synthetic English text page…');
  const [recognized, setRecognized] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const asset = Asset.fromModule(PAGE_ASSET);
        await asset.downloadAsync();
        const source: CapturePhoto = { uri: asset.localUri ?? asset.uri, width: 1600, height: 2200, sourceWidth: 1600, sourceHeight: 2200, rotation: 0 };
        if (active) {
          setPhoto(source);
          const availability = onDeviceAvailability();
          setStatus(`Fixture ready. Native OCR ${availability.available ? 'available' : 'unavailable'}: ${availability.message}`);
        }
      } catch (error) {
        if (active) setStatus(`Fixture load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    })();
    return () => { active = false; };
  }, []);

  const recognize = async () => {
    if (!photo || running || !fs.documentDirectory) return;
    setRunning(true);
    setRecognized('');
    let selected: CapturePhoto | undefined;
    try {
      const started = Date.now();
      selected = await adapter.current.transform(photo, crop);
      await fs.copyAsync({ from: selected.uri, to: `${fs.documentDirectory}native-crop-output.png` });
      const result = await adapter.current.recognize(selected.uri, new AbortController().signal);
      const receipt = {
        fixture: 'original synthetic English text page',
        source: { width: photo.width, height: photo.height },
        crop,
        cropPixels: { width: selected.width, height: selected.height },
        elapsedMs: Date.now() - started,
        ...result,
      };
      await fs.writeAsStringAsync(`${fs.documentDirectory}native-crop-proof.json`, JSON.stringify(receipt, null, 2));
      setRecognized(result.reviewText);
      setStatus(`Recognition finished. Provider: ${result.provider}; crop output ${selected.width}×${selected.height}; receipt saved locally.`);
    } catch (error) {
      setStatus(`Native crop/OCR failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      if (selected) await adapter.current.release(selected.uri);
      setRunning(false);
    }
  };

  return <ScrollView contentContainerStyle={{ padding: 16, gap: 12, backgroundColor: colors.bgPrimary }}>
    <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700' }}>Native crop and OCR check</Text>
    <Text style={{ color: colors.textSecondary }}>Original, locally generated English text. Adjust the outlined area; only those pixels are sent to on-device recognition.</Text>
    {photo ? <NoteCrop photo={photo} crop={crop} onChange={setCrop} disabled={running} /> : null}
    <Text accessibilityLabel="Current crop values" testID="currentCropValues" style={{ color: colors.textPrimary, fontSize: 15 }}>
      x={crop.x.toFixed(2)} y={crop.y.toFixed(2)} width={crop.width.toFixed(2)} height={crop.height.toFixed(2)}
    </Text>
    <View style={{ gap: 8 }}>
      <NoteButton label="Reset crop to full image" secondary disabled={running || !photo} onPress={() => setCrop(FULL_CROP)} />
      <NoteButton label="Recognize cropped image" disabled={running || !photo} onPress={() => void recognize()} />
    </View>
    <NoteMessage message={status} />
    {recognized ? <Text accessibilityLabel="Recognized synthetic text" selectable style={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24 }}>{recognized}</Text> : null}
  </ScrollView>;
}
