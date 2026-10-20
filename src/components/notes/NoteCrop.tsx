import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, PanResponder, Text, View } from 'react-native';
import type { CapturePhoto } from '@/features/books/notes/captureAdapter';
import { adjustCropEdge, containedImage, CropSelection, moveCropCorner } from '@/features/books/notes/captureGeometry';
import { NoteButton, ui } from './ManualNoteUi';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';

/**
 * SDD-07 FU-1b: the one tint the palette does not carry as its own token (a faint
 * darkening over the crop area) is derived from `shadow`, the palette's darkest hue,
 * instead of restating a literal rgba.
 */
const withAlpha = (color: string, alpha: number) => {
    const hex = color.startsWith('#') ? color.slice(1) : '';
    const digits = hex.length === 3 ? [...hex].map(digit => digit + digit).join('') : hex;
    const channels = hex
        ? (digits.match(/../g) ?? []).map(part => Number.parseInt(part, 16))
        : color.slice(color.indexOf('(') + 1, color.lastIndexOf(')')).split(',').slice(0, 3).map(part => Number.parseFloat(part.trim()));
    return `rgba(${channels.join(', ')}, ${alpha})`;
};

export function NoteCrop({ photo, crop, onChange, disabled, cropMode, autoDetected, cropNotice, onReset }: {
  photo: CapturePhoto; crop: CropSelection; onChange: (crop: CropSelection) => void; disabled: boolean;
  cropMode: 'automatic' | 'manual'; autoDetected: boolean; cropNotice?: string; onReset: () => void;
}) {
  const colors = useLibraryAppearance(); const [frame, setFrame] = useState({ width: 320, height: 280 }); const [adjusting, setAdjusting] = useState(false);
  useEffect(() => setAdjusting(false), [photo.uri]);
  const displayed = containedImage(photo, frame);
  const selection = { left: displayed.x + crop.x * displayed.width, top: displayed.y + crop.y * displayed.height, width: crop.width * displayed.width, height: crop.height * displayed.height };
  return <View style={{ gap: 12, width: '100%', maxWidth: 720, alignSelf: 'center' }}>
    <View accessibilityLabel="Selected photo and crop" style={{ height: 280, width: '100%', backgroundColor: colors.bgCard }}
      onLayout={event => setFrame({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
      <Image source={{ uri: photo.uri }} accessibilityLabel="Selected page photo" resizeMode="contain" style={{ width: '100%', height: '100%' }} />
      <View pointerEvents="none" style={{ position: 'absolute', ...selection, borderWidth: 3, borderColor: colors.controlBorder, backgroundColor: withAlpha(colors.shadow, 0.06) }} />
      {adjusting && <>
        <CropHandle corner="start" crop={crop} displayed={displayed} onChange={onChange} disabled={disabled}
          left={Math.max(0, Math.min(frame.width - 48, selection.left - 24))} top={Math.max(0, Math.min(frame.height - 48, selection.top - 24))} />
        <CropHandle corner="end" crop={crop} displayed={displayed} onChange={onChange} disabled={disabled}
          left={Math.max(0, Math.min(frame.width - 48, selection.left + selection.width - 24))} top={Math.max(0, Math.min(frame.height - 48, selection.top + selection.height - 24))} />
      </>}
    </View>
    <Text style={[ui.message, { color: colors.textSecondary }]}>{cropNotice ?? (cropMode === 'manual' ? 'The outlined area will be read.' : autoDetected
      ? 'The printed text area was detected automatically. The outline shows what will be read.'
      : cropMode === 'automatic' ? 'The printed text will be detected and cropped automatically.' : 'The outlined area will be read.')}</Text>
    <NoteButton label={adjusting ? 'Done adjusting' : 'Adjust crop'} secondary disabled={disabled} onPress={() => setAdjusting(value => !value)} />
    {adjusting && <>
      {(['left', 'top', 'right', 'bottom'] as const).map(edge => {
        const percent = Math.round(100 * (edge === 'left' ? crop.x : edge === 'top' ? crop.y : edge === 'right' ? crop.x + crop.width : crop.y + crop.height));
        const name = edge[0].toUpperCase() + edge.slice(1);
        return <View key={edge} style={{ gap: 8 }}>
          <Text style={[ui.label, { color: colors.textPrimary }]}>{name} edge: {percent}%</Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <NoteButton label={`${name} edge inward`} secondary disabled={disabled} onPress={() => onChange(adjustCropEdge(crop, edge, true))} />
            <NoteButton label={`${name} edge outward`} secondary disabled={disabled} onPress={() => onChange(adjustCropEdge(crop, edge, false))} />
          </View>
        </View>;
      })}
      <NoteButton label={autoDetected ? 'Use detected text area' : 'Use full image'} secondary disabled={disabled} onPress={onReset} />
    </>}
  </View>;
}
function CropHandle({ corner, crop, displayed, onChange, disabled, left, top }: {
  corner: 'start' | 'end'; crop: CropSelection; displayed: { width: number; height: number }; onChange: (crop: CropSelection) => void; disabled: boolean; left: number; top: number;
}) {
  const colors = useLibraryAppearance(); const latest = useRef(crop); latest.current = crop; const starting = useRef(crop);
  const callback = useRef(onChange); callback.current = onChange;
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    onPanResponderGrant: () => { starting.current = latest.current; },
    onPanResponderMove: (_, gesture) => callback.current(moveCropCorner(starting.current, corner, gesture.dx, gesture.dy, displayed)),
  }), [corner, disabled, displayed.width, displayed.height]);
  return <View {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel={corner === 'start' ? 'Top left crop corner' : 'Bottom right crop corner'}
    accessibilityState={{ disabled }} accessibilityHint="Use the labeled edge buttons below to adjust without dragging."
    style={{ position: 'absolute', left, top, width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: colors.controlBorder, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: colors.accent, fontSize: 24 }}>{corner === 'start' ? '↖' : '↘'}</Text>
  </View>;
}
