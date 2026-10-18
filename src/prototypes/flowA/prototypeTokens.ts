import { useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useLibraryTypography } from '@/components/library/LibraryTypography';
import type { BookSectionColors } from '@/components/library/LibraryAppearance';
import { LIBRARY_SPACING as SPACE, LIBRARY_RADIUS as RADIUS, MIN_TARGET } from '@/components/library/LibraryAppearance';

export type Appearance = BookSectionColors;
export { SPACE, RADIUS, MIN_TARGET };
export const PHASES = ['daylight', 'golden', 'midnight'] as const;
export const COVER_SIZE = { width: 112, height: 168 } as const;
export const NARROW_COVER_SIZE = { width: 80, height: 120 } as const;
export const COVER_RADIUS = 4;
export const ICON_SIZE = 20;
export const ROW_MIN_HEIGHT = 56;
export const COLUMN_MAX_WIDTH = 600;
export const NARROW_COVER_BELOW = 340;
export const MIN_TITLE_BLOCK_WIDTH = 180;
export const STACK_STATUS_BELOW = 360;
export const STATUS_SEGMENT_BORDER = 1;
export const TITLE_LINE_LIMIT = 4;
export const NOTE_PREVIEW_LINES = 4;
export const MAX_SCORE = 5;
// React Native's style types omit these RN-web text properties.
const WEB_WORD_WRAP = { wordBreak: 'normal', wordWrap: 'normal', overflowWrap: 'normal' } as const;

// Local FU-2 mirror; replace with LIBRARY_TEXT when that unit lands.
export const TYPE_SCALE = {
    title: { fontSize: 26, lineHeight: 32 },
    heading: { fontSize: 21, lineHeight: 27 },
    bodySerif: { fontSize: 18, lineHeight: 26 },
    body: { fontSize: 16, lineHeight: 24 },
    label: { fontSize: 16, lineHeight: 22 },
    caption: { fontSize: 14, lineHeight: 20 },
} as const;

export function usePrototypeText() {
    const fonts = useLibraryTypography();
    return {
        title: { ...TYPE_SCALE.title, fontFamily: fonts.heading },
        heading: { ...TYPE_SCALE.heading, fontFamily: fonts.heading },
        bodySerif: { ...TYPE_SCALE.bodySerif, fontFamily: fonts.serif },
        body: { ...TYPE_SCALE.body, fontFamily: fonts.body },
        label: { ...TYPE_SCALE.label, fontFamily: fonts.label, fontWeight: '700' as const },
        caption: { ...TYPE_SCALE.caption, fontFamily: fonts.body },
    };
}

export function webFocusStyle(focused: boolean, colors: Appearance) {
    return Platform.OS === 'web' && focused ? [styles.focusRing, { outlineColor: colors.focusRing }] : undefined;
}

export function useWebFocus(colors: Appearance) {
    const [focused, setFocused] = useState(false);
    return {
        onFocus: () => setFocused(true),
        onBlur: () => setFocused(false),
        focusStyle: webFocusStyle(focused, colors),
    };
}

export const PROTOTYPE_PAIRS = [
    { token: 'textPrimary', background: 'bgPrimary' },
    { token: 'textSecondary', background: 'bgPrimary' },
    { token: 'textTertiary', background: 'bgPrimary' },
    { token: 'textPrimary', background: 'bgCard' },
    { token: 'textSecondary', background: 'bgSecondary' },
    { token: 'controlBorder', background: 'bgCard' },
    { token: 'controlBorder', background: 'bgSecondary' },
    { token: 'textOnAccent', background: 'accent' },
    { token: 'coverPlaceholderInk', background: 'coverPlaceholder' },
    { token: 'textPrimary', background: 'bgRaised' },
    { token: 'textSecondary', background: 'bgRaised' },
    { token: 'onErrorSurface', background: 'error' },
    { token: 'focusRing', background: 'bgPrimary' },
    { token: 'focusRing', background: 'bgCard' },
    { token: 'divider', background: 'bgPrimary' },
    { token: 'bgSecondary', background: 'bgPrimary' },
    { token: 'bgCard', background: 'bgPrimary' },
    { token: 'bgRaised', background: 'bgPrimary' },
    { token: 'overlay', background: 'bgPrimary' },
    { token: 'coverPlaceholder', background: 'bgPrimary' },
    { token: 'shadow', background: 'bgCard' },
] as const satisfies readonly { token: keyof Appearance; background: keyof Appearance }[];

export const styles = StyleSheet.create({
    page: { flex: 1 },
    focusRing: { outlineWidth: 2, outlineOffset: 2, outlineStyle: 'solid' },
    disabled: { opacity: 0.5 },
    content: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center', paddingHorizontal: SPACE.md, paddingBottom: SPACE.xl },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.xs, marginBottom: SPACE.md },
    target: { minWidth: MIN_TARGET, minHeight: MIN_TARGET, justifyContent: 'center' },
    headerSlot: { width: MIN_TARGET, minHeight: MIN_TARGET },
    coverRow: { flexDirection: 'row', minWidth: 0, maxWidth: '100%', alignItems: 'flex-start', gap: SPACE.md, marginBottom: SPACE.md },
    stacked: { flexDirection: 'column' },
    stackedTitle: { width: '100%' },
    cover: { ...COVER_SIZE, borderRadius: COVER_RADIUS, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    narrowCover: { ...NARROW_COVER_SIZE },
    shadow: { borderRadius: COVER_RADIUS, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: SPACE.xs, elevation: 2 },
    titleBlock: { flexShrink: 1, flexGrow: 1, minWidth: 0, gap: SPACE.xs },
    wrapWords: { minWidth: 0, maxWidth: '100%', ...WEB_WORD_WRAP },
    track: { flexDirection: 'row', minWidth: 0, maxWidth: '100%', borderRadius: RADIUS.control, padding: SPACE.xxs },
    verticalTrack: { flexDirection: 'column' },
    segment: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, flex: 1, paddingVertical: SPACE.xs, paddingHorizontal: SPACE.xxs, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.control, borderWidth: STATUS_SEGMENT_BORDER },
    verticalSegment: { flex: 0, width: '100%' },
    segmentLabel: { textAlign: 'center', maxWidth: '100%' },
    measurementClip: { position: 'absolute', top: 0, left: 0, right: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' },
    measurementRow: { flexDirection: 'row' },
    measurementLabel: { flexShrink: 0 },
    notes: { marginTop: SPACE.lg, paddingTop: SPACE.lg, borderTopWidth: StyleSheet.hairlineWidth },
    notesHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, marginBottom: SPACE.md },
    passages: { gap: SPACE.lg },
    passage: { gap: SPACE.xxs },
    action: { marginTop: SPACE.lg },
    connectionNotice: { marginBottom: SPACE.xs },
    button: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.control },
    textButton: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingVertical: SPACE.sm, justifyContent: 'center', alignItems: 'center' },
    rows: { marginTop: SPACE.xl },
    row: { minHeight: ROW_MIN_HEIGHT, minWidth: MIN_TARGET, flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingVertical: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth },
    rowLabel: { flexShrink: 1 },
    rowSummary: { flex: 1, minWidth: 0, textAlign: 'right' },
    spacer: { flex: 1 },
    expanded: { gap: SPACE.sm, paddingBottom: SPACE.md },
    stars: { flexDirection: 'row', gap: SPACE.xxs },
    remove: { alignSelf: 'center', marginTop: SPACE.lg },
    scrim: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACE.md },
    dialog: { width: '100%', maxWidth: 420, borderRadius: RADIUS.dialog, padding: SPACE.lg, gap: SPACE.md },
    dialogButtons: { gap: SPACE.xs },
    annotation: { borderWidth: 1, borderStyle: 'dashed', padding: SPACE.xxs },
    dateSlot: { marginTop: SPACE.xs },
    notice: { marginBottom: SPACE.md },
    refreshNotice: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md },
    skeletonRow: { flexDirection: 'row', gap: SPACE.md },
    skeletonTitle: { height: TYPE_SCALE.title.lineHeight, width: '90%', borderRadius: COVER_RADIUS },
    skeletonAuthor: { height: TYPE_SCALE.body.lineHeight, width: '70%', borderRadius: COVER_RADIUS },
    skeletonTrack: { minHeight: MIN_TARGET, borderRadius: RADIUS.control, marginTop: SPACE.md },
    state: { gap: SPACE.md, paddingVertical: SPACE.lg },
    switcher: { paddingVertical: SPACE.md },
});
