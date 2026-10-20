
> plan · space-bunny-free

I'll start by reading the review instructions.
→ Read .spec/FINAL-REVIEW.md
→ Read .spec/ESSENCE.md

$ ls -R src/prototypes/flowA 2>/dev/null | head -60; echo "---"; wc -l src/prototypes/flowA/*.tsx src/prototypes/flowA/*.ts src/prototypes/flowA/components/* src/components/library/LibraryAppearance.ts 2>/dev/null
src/prototypes/flowA:
BookDetailsPrototype.tsx
BookDetailsPrototypeRoute.tsx
PrototypeSwitcher.tsx
__tests__
components
fixtures
fixtures.ts
prototypeTokens.ts

src/prototypes/flowA/__tests__:
BookDetailsPrototype.test.tsx
prototypeContracts.test.tsx
round2.test.tsx
round3.test.tsx
webSemantics.test.tsx

src/prototypes/flowA/components:
CoverBlock.tsx
DetailRow.tsx
Header.tsx
NotePassages.tsx
OfflineNotice.tsx
PrimaryButton.tsx
RemoveDialog.tsx
ReservedSlot.tsx
ScreenStates.tsx
StatusSegments.tsx
TextButton.tsx

src/prototypes/flowA/fixtures:
cover-walden.png
---
  111 src/prototypes/flowA/BookDetailsPrototype.tsx
   31 src/prototypes/flowA/BookDetailsPrototypeRoute.tsx
   25 src/prototypes/flowA/PrototypeSwitcher.tsx
   85 src/prototypes/flowA/fixtures.ts
  137 src/prototypes/flowA/prototypeTokens.ts
   48 src/prototypes/flowA/components/CoverBlock.tsx
   25 src/prototypes/flowA/components/DetailRow.tsx
   14 src/prototypes/flowA/components/Header.tsx
   42 src/prototypes/flowA/components/NotePassages.tsx
    9 src/prototypes/flowA/components/OfflineNotice.tsx
   17 src/prototypes/flowA/components/PrimaryButton.tsx
   30 src/prototypes/flowA/components/RemoveDialog.tsx
   14 src/prototypes/flowA/components/ReservedSlot.tsx
   27 src/prototypes/flowA/components/ScreenStates.tsx
   65 src/prototypes/flowA/components/StatusSegments.tsx
   22 src/prototypes/flowA/components/TextButton.tsx
  152 src/components/library/LibraryAppearance.ts
  854 total

→ Read src/prototypes/flowA/BookDetailsPrototype.tsx
→ Read src/prototypes/flowA/prototypeTokens.ts

$ for f in CoverBlock DetailRow Header NotePassages OfflineNotice PrimaryButton RemoveDialog ReservedSlot ScreenStates StatusSegments TextButton; do echo "=== $f ==="; cat -n "src/prototypes/flowA/components/$f.tsx"; done
=== CoverBlock ===
     1	import React, { useEffect, useState } from 'react';
     2	import { Image, Platform, Text, View, useWindowDimensions } from 'react-native';
     3	import { SPACE, COVER_SIZE, NARROW_COVER_SIZE, NARROW_COVER_BELOW, MIN_TITLE_BLOCK_WIDTH, TITLE_LINE_LIMIT, styles, usePrototypeText } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5	import type { PrototypeBook } from '../fixtures';
     6
     7	export const titleInitials = (title: string) => title.split(/\s+/)
     8	    .filter(word => !/^(the|a|an|and|of|in|on|to)$/i.test(word)).slice(0, 2)
     9	    .map(word => word[0]).join('').toUpperCase();
    10
    11	export function CoverBlock({ book, colors }: { book: PrototypeBook; colors: Appearance }) {
    12	    const text = usePrototypeText();
    13	    const { fontScale } = useWindowDimensions();
    14	    const [rowWidth, setRowWidth] = useState(0);
    15	    const [longTitle, setLongTitle] = useState(false);
    16	    useEffect(() => {
    17	        setLongTitle(false);
    18	    }, [fontScale]);
    19	    const narrow = rowWidth < NARROW_COVER_BELOW;
    20	    const coverWidth = narrow ? NARROW_COVER_SIZE.width : COVER_SIZE.width;
    21	    const stacked = longTitle || rowWidth - coverWidth - SPACE.md < MIN_TITLE_BLOCK_WIDTH;
    22	    const coverStyle = [styles.cover, narrow && styles.narrowCover];
    23	    return <View testID="fa-cover-row" onLayout={event => {
    24	        const nextWidth = event.nativeEvent.layout.width;
    25	        if (nextWidth !== rowWidth) { setRowWidth(nextWidth); setLongTitle(false); }
    26	    }}
    27	        style={[styles.coverRow, stacked && styles.stacked]}>
    28	        <View style={[styles.shadow, { backgroundColor: colors.bgCard, shadowColor: colors.shadow }]}>
    29	            {book.cover ? <Image source={book.cover} accessible={false} style={coverStyle} resizeMode="cover" /> :
    30	                <View testID="fa-cover-placeholder" accessible={false} aria-hidden importantForAccessibility="no-hide-descendants"
    31	                    style={[coverStyle, { backgroundColor: colors.coverPlaceholder }]}>
    32	                    <Text style={[text.heading, { color: colors.coverPlaceholderInk }]}>{titleInitials(book.title)}</Text>
    33	                </View>}
    34	        </View>
    35	        <View testID="fa-title-block" style={[styles.titleBlock, stacked && styles.stackedTitle]}>
    36	            <Text role="heading" aria-level={1} accessibilityRole="header" style={[text.title, Platform.OS === 'web' && styles.wrapWords, { color: colors.textPrimary }]}
    37	                onLayout={event => {
    38	                    // RN-web supports onLayout, not onTextLayout. Keep the stacked layout
    39	                    // once measured so the narrower title cannot cause an oscillation.
    40	                    if (!stacked && event.nativeEvent.layout.height > text.title.lineHeight * fontScale * TITLE_LINE_LIMIT) setLongTitle(true);
    41	                }}
    42	                onTextLayout={event => { if (event.nativeEvent.lines.length > TITLE_LINE_LIMIT) setLongTitle(true); }}>
    43	                {book.title}
    44	            </Text>
    45	            <Text style={[text.body, Platform.OS === 'web' && styles.wrapWords, { color: colors.textSecondary }]}>{book.authors.join(', ')}</Text>
    46	        </View>
    47	    </View>;
    48	}
=== DetailRow ===
     1	import React from 'react';
     2	import { Pressable, Text, View } from 'react-native';
     3	import { Ionicons } from '@expo/vector-icons';
     4	import { ICON_SIZE, styles, usePrototypeText, useWebFocus } from '../prototypeTokens';
     5	import type { Appearance } from '../prototypeTokens';
     6
     7	export function DetailRow({ id, label, secondary, absent, expanded, onPress, children, colors, link = false }: {
     8	    id: string; label: string; secondary?: string; absent?: boolean; expanded?: boolean; link?: boolean;
     9	    onPress: () => void; children?: React.ReactNode; colors: Appearance;
    10	}) {
    11	    const text = usePrototypeText();
    12	    const { focusStyle, ...focusProps } = useWebFocus(colors);
    13	    return <View>
    14	        <Pressable testID={`fa-row-${id}`} accessibilityRole={link ? 'link' : 'button'}
    15	            accessibilityLabel={[label, secondary].filter(Boolean).join(', ')}
    16	            aria-expanded={link ? undefined : expanded} accessibilityState={link ? undefined : { expanded }}
    17	            {...focusProps} onPress={onPress} style={[styles.row, { borderColor: colors.divider }, focusStyle]}>
    18	            <Text style={[text.body, styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
    19	            {secondary ? <Text numberOfLines={1} ellipsizeMode="tail" style={[text.body, styles.rowSummary,
    20	                { color: absent ? colors.textTertiary : colors.textSecondary }]}>{secondary}</Text> : <View style={styles.spacer} />}
    21	            <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={ICON_SIZE} color={colors.textSecondary} accessible={false} aria-hidden />
    22	        </Pressable>
    23	        {expanded && <View testID={`fa-expanded-${id}`} style={styles.expanded}>{children}</View>}
    24	    </View>;
    25	}
=== Header ===
     1	import React from 'react';
     2	import { View } from 'react-native';
     3	import { styles } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5	import { TextButton } from './TextButton';
     6	import { ReservedSlot } from './ReservedSlot';
     7
     8	export function Header({ colors, showSlots }: { colors: Appearance; showSlots: boolean }) {
     9	    return <View style={styles.header}>
    10	        <TextButton label="‹ Library" accessibleName="Back to Library" colors={colors} primaryInk
    11	            onPress={() => console.info('[FA-P1] would go back')} />
    12	        {showSlots ? <ReservedSlot kind="options" colors={colors} /> : <View accessible={false} style={styles.headerSlot} />}
    13	    </View>;
    14	}
=== NotePassages ===
     1	import React from 'react';
     2	import { Text, View } from 'react-native';
     3	import { categoryLabel } from '@/features/books/notes/manualNoteContract';
     4	import type { ManualNote } from '@/features/books/notes/manualNoteContract';
     5	import type { Appearance } from '../prototypeTokens';
     6	import { NOTE_PREVIEW_LINES, styles, usePrototypeText } from '../prototypeTokens';
     7	import { TextButton } from './TextButton';
     8
     9	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    10	export function noteDate(stamp: string) {
    11	    const date = new Date(stamp);
    12	    return `${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
    13	}
    14
    15	export function NotePassages({ notes, state, colors }: { notes: ManualNote[]; state: string; colors: Appearance }) {
    16	    const text = usePrototypeText();
    17	    const partial = state === 'notes-loading' || state === 'notes-error';
    18	    return <View style={[styles.notes, { borderColor: colors.divider }]}>
    19	        <View testID="fa-notes-header" style={styles.notesHeader}>
    20	            <Text role="heading" aria-level={2} accessibilityRole="header" style={[text.heading, { color: colors.textPrimary }]}>Your notes</Text>
    21	            {!partial && notes.length > 0 && <Text testID="fa-note-count" style={[text.body, { color: colors.textSecondary }]}>
    22	                {`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`}
    23	            </Text>}
    24	        </View>
    25	        {state === 'notes-loading' ? <Text accessibilityLiveRegion="polite" style={[text.body, { color: colors.textSecondary }]}>Loading notes…</Text> :
    26	            state === 'notes-error' ? <View>
    27	                <Text style={[text.body, { color: colors.textSecondary }]}>Couldn't load your notes.</Text>
    28	                <TextButton label="Try again" colors={colors} onPress={() => console.info('[FA-P1] would retry notes')} />
    29	            </View> : notes.length === 0 ? <Text style={[text.body, { color: colors.textSecondary }]}>No notes yet.</Text> :
    30	                <View style={styles.passages}>
    31	                    {[...notes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2).map(note => <View key={note.id} style={styles.passage}>
    32	                        <Text testID={`fa-note-${note.id}-meta`} style={[text.caption, { color: colors.textTertiary }]}>
    33	                            {[note.tag ? categoryLabel(note.tag) : null, note.page_number == null ? null : `p. ${note.page_number}`, noteDate(note.created_at)].filter(Boolean).join(' · ')}
    34	                        </Text>
    35	                        <Text testID={`fa-note-${note.id}-body`} numberOfLines={NOTE_PREVIEW_LINES} ellipsizeMode="tail"
    36	                            style={[text.bodySerif, { color: colors.textPrimary }]}>
    37	                            {note.tag === 'quote' ? `“${note.content}”` : note.content}
    38	                        </Text>
    39	                    </View>)}
    40	                </View>}
    41	    </View>;
    42	}
=== OfflineNotice ===
     1	import React from 'react';
     2	import { Text } from 'react-native';
     3	import { styles, usePrototypeText } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5
     6	export function OfflineNotice({ colors }: { colors: Appearance }) {
     7	    const text = usePrototypeText();
     8	    return <Text style={[text.body, styles.notice, { color: colors.textSecondary }]}>Offline · Showing saved content.</Text>;
     9	}
=== PrimaryButton ===
     1	import React from 'react';
     2	import { Pressable, Text } from 'react-native';
     3	import { styles, usePrototypeText, useWebFocus } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5
     6	export function PrimaryButton({ label, colors, onPress, destructive = false, disabled = false }: {
     7	    label: string; colors: Appearance; onPress: () => void; destructive?: boolean; disabled?: boolean;
     8	}) {
     9	    const text = usePrototypeText();
    10	    const { focusStyle, ...focusProps } = useWebFocus(colors);
    11	    return <Pressable testID="fa-primary" accessibilityRole="button" accessibilityLabel={label}
    12	        disabled={disabled} aria-disabled={disabled} accessibilityState={{ disabled }} {...focusProps}
    13	        onPress={disabled ? undefined : onPress}
    14	        style={[styles.button, { backgroundColor: destructive ? colors.error : colors.accent }, disabled && styles.disabled, focusStyle]}>
    15	        <Text style={[text.label, { color: destructive ? colors.onErrorSurface : colors.textOnAccent }]}>{label}</Text>
    16	    </Pressable>;
    17	}
=== RemoveDialog ===
     1	import React, { useId, useRef } from 'react';
     2	import { Modal, Platform, View, Text } from 'react-native';
     3	import { styles, usePrototypeText } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5	import { TextButton } from './TextButton';
     6	import { PrimaryButton } from './PrimaryButton';
     7
     8	export function RemoveDialog({ title: bookTitle, colors, onClose }: { title: string; colors: Appearance; onClose: () => void }) {
     9	    const text = usePrototypeText();
    10	    const cancel = useRef<View>(null);
    11	    const descriptionId = useId();
    12	    const title = `Remove “${bookTitle}” from your library?`;
    13	    const description = "Your notes, review and saved pages for this book will be deleted too. You can't undo this.";
    14	    // RN-web Modal supplies a focus trap, aria-modal and restoration; focus Cancel
    15	    // explicitly after mounting. The screen also restores the Remove trigger.
    16	    return <Modal visible transparent animationType="none" accessible role="dialog" aria-modal accessibilityViewIsModal
    17	        testID="fa-dialog" accessibilityLabel={Platform.OS === 'web' ? title : `${title} ${description}`}
    18	        aria-describedby={descriptionId} onRequestClose={onClose} onShow={() => cancel.current?.focus()}>
    19	        <View style={[styles.scrim, { backgroundColor: colors.overlay }]}>
    20	            <View style={[styles.dialog, { backgroundColor: colors.bgRaised }]}>
    21	                <Text style={[text.heading, { color: colors.textPrimary }]}>{title}</Text>
    22	                <Text nativeID={descriptionId} style={[text.body, { color: colors.textSecondary }]}>{description}</Text>
    23	                <View style={styles.dialogButtons}>
    24	                    <TextButton ref={cancel} label="Cancel" colors={colors} onPress={onClose} />
    25	                    <PrimaryButton label="Remove book" colors={colors} destructive onPress={onClose} />
    26	                </View>
    27	            </View>
    28	        </View>
    29	    </Modal>;
    30	}
=== ReservedSlot ===
     1	import React from 'react';
     2	import { Text, View } from 'react-native';
     3	import { styles, usePrototypeText } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5
     6	export function ReservedSlot({ kind, colors }: { kind: 'options' | 'dates'; colors: Appearance }) {
     7	    const text = usePrototypeText();
     8	    return <View testID={`fa-slot-${kind}`} accessible={false} aria-hidden importantForAccessibility="no-hide-descendants"
     9	        style={[styles.annotation, kind === 'options' ? styles.headerSlot : styles.dateSlot, { borderColor: colors.divider }]}>
    10	        <Text testID={`fa-slot-${kind}-meta`} style={[text.caption, { color: colors.textTertiary }]}>
    11	            {kind === 'options' ? 'SDD-08' : 'SDD-09 · Reading dates / reread'}
    12	        </Text>
    13	    </View>;
    14	}
=== ScreenStates ===
     1	import React from 'react';
     2	import { Text, View } from 'react-native';
     3	import { styles, usePrototypeText } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5	import { PrimaryButton } from './PrimaryButton';
     6
     7	export function ScreenStates({ state, colors }: { state: 'loading' | 'error' | 'not-found'; colors: Appearance }) {
     8	    const text = usePrototypeText();
     9	    if (state === 'loading') return <View accessible accessibilityLabel="Loading book" accessibilityLiveRegion="polite" role="status">
    10	        <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants">
    11	            <View style={styles.skeletonRow}>
    12	                <View style={[styles.cover, { backgroundColor: colors.coverPlaceholder }]} />
    13	                <View style={styles.titleBlock}>
    14	                    <View style={[styles.skeletonTitle, { backgroundColor: colors.bgSecondary }]} />
    15	                    <View style={[styles.skeletonAuthor, { backgroundColor: colors.bgSecondary }]} />
    16	                </View>
    17	            </View>
    18	            <View style={[styles.skeletonTrack, { backgroundColor: colors.bgSecondary }]} />
    19	        </View>
    20	    </View>;
    21	    const missing = state === 'not-found';
    22	    return <View style={styles.state}>
    23	        <Text style={[text.heading, { color: colors.textPrimary }]}>{missing ? "This book isn't in your library." : "Couldn't load this book."}</Text>
    24	        <PrimaryButton label={missing ? 'Back to Library' : 'Try again'} colors={colors}
    25	            onPress={() => console.info(missing ? '[FA-P1] would go back' : '[FA-P1] would retry book')} />
    26	    </View>;
    27	}
=== StatusSegments ===
     1	import React, { useRef, useState } from 'react';
     2	import { Platform, Pressable, Text, View } from 'react-native';
     3	import { SPACE, STACK_STATUS_BELOW, STATUS_SEGMENT_BORDER, styles, usePrototypeText, webFocusStyle } from '../prototypeTokens';
     4	import type { Appearance } from '../prototypeTokens';
     5	import type { ReadingStatus } from '../fixtures';
     6
     7	const statuses: readonly { label: string; value: ReadingStatus }[] = [
     8	    { label: 'Want to read', value: 'want_to_read' },
     9	    { label: 'Reading', value: 'reading' },
    10	    { label: 'Finished', value: 'completed' },
    11	];
    12
    13	export function StatusSegments({ initialStatus, colors, disabled = false }: { initialStatus: ReadingStatus; colors: Appearance; disabled?: boolean }) {
    14	    const text = usePrototypeText();
    15	    const [width, setWidth] = useState(0);
    16	    const [labelWidths, setLabelWidths] = useState<number[]>([]);
    17	    const labelSpace = (width - SPACE.xxs * 2) / statuses.length - (SPACE.xxs + STATUS_SEGMENT_BORDER) * 2;
    18	    const vertical = width < STACK_STATUS_BELOW || statuses.some((_, index) =>
    19	        labelWidths[index] == null || labelWidths[index] > labelSpace);
    20	    const [selected, setSelected] = useState(initialStatus);
    21	    const [focused, setFocused] = useState<number | null>(null);
    22	    const refs = useRef<(View | null)[]>([]);
    23	    return <View accessible accessibilityRole="radiogroup" accessibilityLabel="Reading status"
    24	        onLayout={event => setWidth(event.nativeEvent.layout.width)}
    25	        aria-disabled={disabled} accessibilityState={{ disabled }} aria-orientation={vertical ? 'vertical' : 'horizontal'}
    26	        style={[styles.track, vertical && styles.verticalTrack, { backgroundColor: colors.bgSecondary }, disabled && styles.disabled]}>
    27	        {/* Measure the bold label in one line, independently of the visible rows. */}
    28	        <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={styles.measurementClip}>
    29	            <View style={styles.measurementRow}>
    30	                {statuses.map(({ label, value }, index) => <Text key={value} testID={`fa-status-measure-${value}`}
    31	                    numberOfLines={1} style={[text.label, styles.measurementLabel]}
    32	                    onLayout={event => {
    33	                        const nextWidth = event.nativeEvent.layout.width;
    34	                        setLabelWidths(current => {
    35	                            if (current[index] === nextWidth) return current;
    36	                            const next = [...current];
    37	                            next[index] = nextWidth;
    38	                            return next;
    39	                        });
    40	                    }}>{label}</Text>)}
    41	            </View>
    42	        </View>
    43	        {statuses.map(({ label, value }, index) => {
    44	            const checked = selected === value;
    45	            const keyboard = { onKeyDown: (event: { key?: string; nativeEvent?: { key: string }; preventDefault: () => void }) => {
    46	                const key = event.nativeEvent?.key ?? event.key;
    47	                if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
    48	                event.preventDefault();
    49	                const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : statuses.length - 1)) % statuses.length;
    50	                setSelected(statuses[next].value);
    51	                refs.current[next]?.focus();
    52	            } };
    53	            return <Pressable key={value} ref={node => { refs.current[index] = node; }}
    54	                accessibilityRole="radio" accessibilityLabel={label} aria-checked={checked} aria-disabled={disabled}
    55	                accessibilityState={{ checked, disabled }} disabled={disabled}
    56	                tabIndex={!disabled && checked ? 0 : -1} {...keyboard} onPress={disabled ? undefined : () => setSelected(value)}
    57	                onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
    58	                style={[styles.segment, vertical && styles.verticalSegment, { backgroundColor: checked ? colors.bgCard : colors.bgSecondary,
    59	                    borderColor: checked ? colors.controlBorder : colors.bgSecondary }, webFocusStyle(focused === index, colors)]}>
    60	                <Text style={[checked ? text.label : text.body, styles.segmentLabel, Platform.OS === 'web' && styles.wrapWords,
    61	                    { color: checked ? colors.textPrimary : colors.textSecondary }]}>{label}</Text>
    62	            </Pressable>;
    63	        })}
    64	    </View>;
    65	}
=== TextButton ===
     1	import React, { forwardRef } from 'react';
     2	import { Pressable, Text, View } from 'react-native';
     3	import type { StyleProp, ViewStyle } from 'react-native';
     4	import { styles, usePrototypeText, useWebFocus } from '../prototypeTokens';
     5	import type { Appearance } from '../prototypeTokens';
     6
     7	interface Props {
     8	    label: string;
     9	    accessibleName?: string;
    10	    colors: Appearance;
    11	    onPress: () => void;
    12	    primaryInk?: boolean;
    13	    style?: StyleProp<ViewStyle>;
    14	}
    15	export const TextButton = forwardRef<View, Props>(function TextButton({ label, accessibleName, colors, onPress, primaryInk, style }, ref) {
    16	    const text = usePrototypeText();
    17	    const { focusStyle, ...focusProps } = useWebFocus(colors);
    18	    return <Pressable ref={ref} accessibilityRole="button" accessibilityLabel={accessibleName ?? label}
    19	        {...focusProps} onPress={onPress} style={[styles.textButton, style, focusStyle]}>
    20	        <Text style={[text.label, { color: primaryInk ? colors.textPrimary : colors.textSecondary }]}>{label}</Text>
    21	    </Pressable>;
    22	});

$ cat -n src/prototypes/flowA/fixtures.ts; echo "=== ROUTE ==="; cat -n src/prototypes/flowA/BookDetailsPrototypeRoute.tsx; echo "=== SWITCHER ==="; cat -n src/prototypes/flowA/PrototypeSwitcher.tsx
1	import type { ImageSourcePropType } from 'react-native';
     2	import type { ManualNote } from '@/features/books/notes/manualNoteContract';
     3	import type { UserBookPage } from '@/features/books/services/userBookPagesService';
     4
     5	export type ReadingStatus = 'want_to_read' | 'reading' | 'completed';
     6	export type OpenRow = 'review' | 'saved' | 'info' | 'ownership' | 'remove';
     7	export const OPEN_ROWS: readonly OpenRow[] = ['review', 'saved', 'info', 'ownership', 'remove'];
     8	export const PRESETS = [
     9	    'populated', 'no-cover', 'zero-notes', 'many-notes', 'long-title', 'saved-absent',
    10	    'review-absent', 'want-to-read', 'finished', 'lent-out', 'uncategorised-note',
    11	    'notes-loading', 'notes-error', 'loading', 'error', 'not-found', 'offline', 'refresh-failed',
    12	] as const;
    13	export type Preset = typeof PRESETS[number];
    14	export interface PrototypeBook {
    15	    title: string;
    16	    authors: string[];
    17	    cover: ImageSourcePropType | null;
    18	    reading_status: ReadingStatus;
    19	    review: string | null;
    20	    rating: number | null;
    21	    review_is_public: boolean;
    22	    ownership: 'owned' | 'lent_out';
    23	    condition: 'good';
    24	    page_count: number;
    25	    publisher: string;
    26	    published_year: string;
    27	    isbn_13: string | null;
    28	    description: string;
    29	}
    30	export interface PrototypeFixture {
    31	    book: PrototypeBook;
    32	    notes: ManualNote[];
    33	    savedPages: UserBookPage[];
    34	}
    35
    36	const stamp = '2026-10-14T12:00:00Z';
    37	const notes: ManualNote[] = [
    38	    { id: 'walden-quote', user_id: 'fixture-reader', user_book_id: 'fixture-walden',
    39	        content: 'I went to the woods because I wished to live deliberately.', tag: 'quote', page_number: 42, created_at: stamp, updated_at: null },
    40	    { id: 'walden-thought', user_id: 'fixture-reader', user_book_id: 'fixture-walden',
    41	        content: 'I notice more when I slow down and read a few pages at a time.', tag: 'reflect', page_number: null, created_at: '2026-10-12T12:00:00Z', updated_at: null },
    42	    { id: 'walden-question', user_id: 'fixture-reader', user_book_id: 'fixture-walden',
    43	        content: 'Which things make my days feel full, and which just keep me busy?', tag: 'question', page_number: 31, created_at: '2026-10-09T12:00:00Z', updated_at: null },
    44	];
    45	const walden: PrototypeBook = {
    46	    title: 'Walden', authors: ['Henry David Thoreau'], cover: require('./fixtures/cover-walden.png'),
    47	    reading_status: 'reading', review: 'A book I want to return to slowly. The small observations stay with me after I put it down.',
    48	    rating: 4, review_is_public: false, ownership: 'owned', condition: 'good',
    49	    page_count: 357, publisher: 'Ticknor and Fields', published_year: '1854', isbn_13: null,
    50	    description: 'Reflections on simple living, self-reliance, and the natural world, drawn from time beside Walden Pond in Massachusetts.',
    51	};
    52	const savedPages: UserBookPage[] = [{
    53	    id: 'walden-page', user_id: 'fixture-reader', user_book_id: 'fixture-walden', page_number: 42,
    54	    content_excerpt: 'I went to the woods because I wished to live deliberately.',
    55	    full_text: 'I went to the woods because I wished to live deliberately.', word_count: 13,
    56	    created_at: stamp, updated_at: stamp,
    57	}];
    58	const populated: PrototypeFixture = { book: walden, notes, savedPages };
    59
    60	export const FIXTURES: Record<Preset, PrototypeFixture> = {
    61	    populated,
    62	    'no-cover': { ...populated, book: { ...walden, cover: null } },
    63	    'zero-notes': { ...populated, notes: [] },
    64	    'many-notes': { ...populated, notes: [...notes, ...Array.from({ length: 9 }, (_, index) => ({
    65	        ...notes[1], id: `walden-earlier-${index}`, created_at: `2026-10-0${9 - index}T08:00:00Z`,
    66	        content: `I am keeping this earlier observation about the pond, passage ${index + 1}, for a slower reread.`,
    67	    }))] },
    68	    'long-title': { ...populated, book: { ...walden,
    69	        title: 'The Life and Opinions of Tristram Shandy, Gentleman', authors: ['Laurence Sterne'],
    70	        cover: null,
    71	        publisher: 'Ann Ward', published_year: '1759–1767', page_count: 560,
    72	        description: 'A playful, digressive novel about the telling of a life, published in nine volumes.',
    73	    }, notes: [
    74	        { ...notes[1], id: 'shandy-thought', user_book_id: 'fixture-shandy', content: 'The detours feel like part of the point. I want to notice where the story returns.' },
    75	        { ...notes[2], id: 'shandy-question', user_book_id: 'fixture-shandy', content: 'How much of a life fits into a straight line?' },
    76	    ], savedPages: [] },
    77	    'saved-absent': { ...populated, savedPages: [] },
    78	    'review-absent': { ...populated, book: { ...walden, review: null, rating: null } },
    79	    'want-to-read': { ...populated, book: { ...walden, reading_status: 'want_to_read' } },
    80	    finished: { ...populated, book: { ...walden, reading_status: 'completed' } },
    81	    'lent-out': { ...populated, book: { ...walden, ownership: 'lent_out' } },
    82	    'uncategorised-note': { ...populated, notes: [{ ...notes[0], tag: null, page_number: null }, ...notes.slice(1)] },
    83	    'notes-loading': populated, 'notes-error': populated, loading: populated,
    84	    error: populated, 'not-found': populated, offline: populated, 'refresh-failed': populated,
    85	};
=== ROUTE ===
     1	import React from 'react';
     2	import { View } from 'react-native';
     3	import { useLocalSearchParams } from 'expo-router';
     4	import { useTheme } from '@/hooks/useTheme';
     5	import type { ThemePhase } from '@/hooks/useTheme';
     6	import { LibraryTypographyProvider } from '@/components/library/LibraryTypography';
     7	import { OPEN_ROWS, PRESETS } from './fixtures';
     8	import type { OpenRow, Preset } from './fixtures';
     9	import { PHASES, styles } from './prototypeTokens';
    10	import { BookDetailsPrototype } from './BookDetailsPrototype';
    11	import PrototypeSwitcher from './PrototypeSwitcher';
    12
    13	const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
    14
    15	export default function BookDetailsPrototypeRoute() {
    16	    const params = useLocalSearchParams<{ s?: string | string[]; phase?: string | string[]; open?: string | string[]; slots?: string | string[] }>();
    17	    const { phase: currentPhase } = useTheme();
    18	    const phaseParam = first(params.phase);
    19	    const phase = PHASES.includes(phaseParam as ThemePhase) ? phaseParam as ThemePhase : currentPhase;
    20	    const presetParam = first(params.s);
    21	    const preset = PRESETS.includes(presetParam as Preset) ? presetParam as Preset : 'populated';
    22	    const openParam = first(params.open);
    23	    const open = OPEN_ROWS.includes(openParam as OpenRow) ? openParam as OpenRow : undefined;
    24	    return <LibraryTypographyProvider>
    25	        <View testID="FA_P1_PROTOTYPE_MARKER" style={styles.page}>
    26	            {presetParam == null ? <PrototypeSwitcher phase={phase} /> :
    27	                <BookDetailsPrototype key={`${preset}-${phase}-${open}-${first(params.slots)}`} preset={preset}
    28	                    phase={phase} initialOpen={open} showSlots={first(params.slots) === '1'} />}
    29	        </View>
    30	    </LibraryTypographyProvider>;
    31	}
=== SWITCHER ===
     1	import React from 'react';
     2	import { ScrollView, Text } from 'react-native';
     3	import { Link } from 'expo-router';
     4	import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
     5	import type { ThemePhase } from '@/hooks/useTheme';
     6	import { OPEN_ROWS, PRESETS } from './fixtures';
     7	import type { OpenRow, Preset } from './fixtures';
     8	import { PHASES, styles, usePrototypeText } from './prototypeTokens';
     9
    10	export default function PrototypeSwitcher({ phase }: { phase: ThemePhase }) {
    11	    const text = usePrototypeText();
    12	    const colors = getLibraryAppearance(phase);
    13	    const link = (preset: Preset, chosenPhase: ThemePhase, open?: OpenRow, slots?: boolean) => {
    14	        const label = `${preset} · ${chosenPhase}${open ? ` · open=${open}` : ''}${slots ? ' · slots=1' : ''}`;
    15	        return <Link key={label} accessibilityRole="link" accessibilityLabel={label}
    16	            href={{ pathname: '/(tabs)/library/dev-flow-a', params: { s: preset, phase: chosenPhase, ...(open ? { open } : {}), ...(slots ? { slots: '1' } : {}) } }}
    17	            style={[styles.target, text.body, { color: colors.textPrimary }]}>
    18	            <Text>{label}</Text>
    19	        </Link>;
    20	    };
    21	    return <ScrollView testID="fa-switcher" style={{ backgroundColor: colors.bgPrimary }} contentContainerStyle={[styles.content, styles.switcher]}>
    22	        {PRESETS.flatMap(preset => PHASES.map(chosenPhase => link(preset, chosenPhase)))}
    23	        {PHASES.flatMap(chosenPhase => [...OPEN_ROWS.map(open => link('populated', chosenPhase, open)), link('populated', chosenPhase, undefined, true)])}
    24	    </ScrollView>;
    25	}

→ Read src/components/library/LibraryAppearance.ts

$ cat -n src/features/books/notes/manualNoteContract.ts 2>/dev/null | head -80; echo "=== TYPO ==="; cat -n src/components/library/LibraryTypography.tsx 2>/dev/null | head -60
1	import { getWordCount, NOTE_WORD_LIMIT } from '../utils/ocrWordCap';
     2
     3	export const NOTE_CATEGORIES = [
     4	  { value: 'quote', label: 'Quote' },
     5	  { value: 'reflect', label: 'Thought' },
     6	  { value: 'distill', label: 'Takeaway' },
     7	  { value: 'apply', label: 'Action' },
     8	  { value: 'question', label: 'Question' },
     9	] as const;
    10	export type NoteCategory = typeof NOTE_CATEGORIES[number]['value'];
    11	export type NoteOrigin = 'book' | 'collection';
    12	export interface ManualNote {
    13	  id: string;
    14	  user_id: string;
    15	  user_book_id: string;
    16	  content: string;
    17	  tag: NoteCategory | null;
    18	  page_number: number | null;
    19	  created_at: string;
    20	  updated_at: string | null;
    21	  /** Absent in the current schema. Never substitute a client timestamp. */
    22	  version?: number;
    23	  last_operation_id?: string | null;
    24	}
    25	export interface NoteFields { text: string; category: NoteCategory | null; page: string }
    26	export interface NoteSubmission {
    27	  id: string;
    28	  actorId: string;
    29	  bookId: string;
    30	  noteId: string;
    31	  sessionId: string;
    32	  mode: 'create' | 'edit';
    33	  origin: NoteOrigin;
    34	  content: string;
    35	  tag: NoteCategory | null;
    36	  page_number: number | null;
    37	  expectedVersion?: number;
    38	}
    39	export function categoryLabel(category: NoteCategory | null): string {
    40	  return NOTE_CATEGORIES.find(item => item.value === category)?.label ?? 'No category';
    41	}
    42	export function noteFields(note?: ManualNote): NoteFields {
    43	  return { text: note?.content ?? '', category: note?.tag ?? null, page: note?.page_number?.toString() ?? '' };
    44	}
    45	export function validateNote(fields: NoteFields) {
    46	  const errors: { text?: string; page?: string } = {};
    47	  const content = fields.text.trim();
    48	  if (!content) errors.text = 'Write some text before saving.';
    49	  const excess = getWordCount(content) - NOTE_WORD_LIMIT;
    50	  if (excess > 0) errors.text = `Remove ${excess} word${excess === 1 ? '' : 's'} to save. Your text has been kept.`;
    51	  const page = fields.page.trim();
    52	  const pageNumber = page ? Number(page) : null;
    53	  if (page && (!/^\d+$/.test(page) || !Number.isSafeInteger(pageNumber) || pageNumber! < 1 || pageNumber! > 2147483647)) {
    54	    errors.page = 'Enter a positive whole page number, or leave it blank.';
    55	  }
    56	  return { errors, valid: !errors.text && !errors.page, content, pageNumber };
    57	}
    58	export function fieldsChanged(fields: NoteFields, baseline?: ManualNote): boolean {
    59	  const original = noteFields(baseline);
    60	  return fields.text !== original.text || fields.category !== original.category || fields.page !== original.page;
    61	}
    62	export const noteKeys = {
    63	  book: (actor: string, book: string) => ['library-note-book', actor, book] as const,
    64	  collection: (actor: string, book: string) => ['notes', actor, book] as const,
    65	  record: (actor: string, book: string, note: string) => ['library-note', actor, book, note] as const,
    66	};
    67	export class NoteWriteError extends Error {
    68	  constructor(public kind: 'definite' | 'unknown' | 'conflict', message: string, public latest?: ManualNote) { super(message); }
    69	}
=== TYPO ===
     1	import React, { createContext, useContext } from 'react';
     2	import { Platform } from 'react-native';
     3	import { useFonts } from 'expo-font';
     4
     5	const fallbackSerif = Platform.select({ ios: 'Georgia', web: 'Georgia', default: 'serif' });
     6	const fallback = {
     7	    serif: fallbackSerif,
     8	    heading: fallbackSerif,
     9	    body: undefined as string | undefined,
    10	    label: undefined as string | undefined,
    11	};
    12	const libraryFonts = {
    13	    serif: 'LibraryGaramondMedium',
    14	    heading: 'LibraryGaramondSemiBold',
    15	    body: 'LibraryManrope',
    16	    label: 'LibraryManropeBold',
    17	};
    18	const TypographyContext = createContext(fallback);
    19
    20	export function LibraryTypographyProvider({ children }: { children: React.ReactNode }) {
    21	    const [loaded] = useFonts({
    22	        LibraryGaramondMedium: require('../../../assets/fonts/library/EBGaramond_500Medium.ttf'),
    23	        LibraryGaramondSemiBold: require('../../../assets/fonts/library/EBGaramond_600SemiBold.ttf'),
    24	        LibraryManrope: require('../../../assets/fonts/library/Manrope_400Regular.ttf'),
    25	        LibraryManropeBold: require('../../../assets/fonts/library/Manrope_700Bold.ttf'),
    26	    });
    27	    return <TypographyContext.Provider value={loaded ? libraryFonts : fallback}>{children}</TypographyContext.Provider>;
    28	}
    29
    30	export const useLibraryTypography = () => useContext(TypographyContext);

$ node -e "
const L=h=>{const v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4));return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];};
const C=(a,b)=>{const x=L(a),y=L(b);const r=(Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);return r.toFixed(2);};
const p={daylight:{bgPrimary:'#faf6ee',bgSecondary:'#eee5d6',bgCard:'#fffdf8',controlBorder:'#948669',textSecondary:'#685d4d',textTertiary:'#6f6350',textPrimary:'#30291f',accent:'#3e3225',focusRing:'#7a5c33',divider:'#ded3c1',coverPlaceholder:'#e6dcc8',coverPlaceholderInk:'#5f5343',error:'#ad3f36',onErrorSurface:'#fff8f4'},
golden:{bgPrimary:'#fbf2e4',bgSecondary:'#f0e0c8',bgCard:'#fff9ed',controlBorder:'#93794f',textSecondary:'#6a5845',textTertiary:'#755c48',textPrimary:'#33271d',accent:'#493627',focusRing:'#86632f',divider:'#deceb6',coverPlaceholder:'#e8d6b6',coverPlaceholderInk:'#64503e',error:'#9c382f',onErrorSurface:'#fff7f0'},
midnight:{bgPrimary:'#211e1a',bgSecondary:'#383229',bgCard:'#2d2923',controlBorder:'#8d7f66',textSecondary:'#c4b8a4',textTertiary:'#b4a58c',textPrimary:'#f3eada',accent:'#dfc496',focusRing:'#f0d9ae',divider:'#504638',coverPlaceholder:'#3a332a',coverPlaceholderInk:'#b8a98f',error:'#ffb3a6',onErrorSurface:'#2b1512'}};
for(const [n,c] of Object.entries(p)){
 console.log('---',n);
 console.log(' checkedSegBorder vs track:',C(c.controlBorder,c.bgSecondary));
 console.log(' checkedSegBorder vs card :',C(c.controlBorder,c.bgCard));
 console.log(' checkedFill vs track    :',C(c.bgCard,c.bgSecondary));
 console.log(' uncheckedFill vs track  :',C(c.bgSecondary,c.bgSecondary));
 console.log(' textSecondary/bgPrimary :',C(c.textSecondary,c.bgPrimary));
 console.log(' textTertiary/bgPrimary  :',C(c.textTertiary,c.bgPrimary));
 console.log(' divider/bgPrimary       :',C(c.divider,c.bgPrimary));
 console.log(' coverInk/coverPlaceholder:',C(c.coverPlaceholderInk,c.coverPlaceholder));
 console.log(' onError/error           :',C(c.onErrorSurface,c.error));
 console.log(' onAccent? textPrimary/accent:',C(c.textPrimary,c.accent));
 console.log(' focusRing/bgSecondary   :',C(c.focusRing,c.bgSecondary));
 console.log(' textSecondary/bgSecondary(unchecked seg):',C(c.textSecondary,c.bgSecondary));
 console.log(' textSecondary/bgCard(checked seg):',C(c.textSecondary,c.bgCard));
}
"
--- daylight
 checkedSegBorder vs track: 2.86
 checkedSegBorder vs card : 3.52
 checkedFill vs track    : 1.23
 uncheckedFill vs track  : 1.00
 textSecondary/bgPrimary : 5.97
 textTertiary/bgPrimary  : 5.45
 divider/bgPrimary       : 1.37
 coverInk/coverPlaceholder: 5.50
 onError/error           : 5.64
 onAccent? textPrimary/accent: 1.15
 focusRing/bgSecondary   : 4.94
 textSecondary/bgSecondary(unchecked seg): 5.16
 textSecondary/bgCard(checked seg): 6.33
--- golden
 checkedSegBorder vs track: 3.18
 checkedSegBorder vs card : 3.94
 checkedFill vs track    : 1.24
 uncheckedFill vs track  : 1.00
 textSecondary/bgPrimary : 6.11
 textTertiary/bgPrimary  : 5.60
 divider/bgPrimary       : 1.39
 coverInk/coverPlaceholder: 5.34
 onError/error           : 6.56
 onAccent? textPrimary/accent: 1.27
 focusRing/bgSecondary   : 4.22
 textSecondary/bgSecondary(unchecked seg): 5.24
 textSecondary/bgCard(checked seg): 6.47
--- midnight
 checkedSegBorder vs track: 3.24
 checkedSegBorder vs card : 3.69
 checkedFill vs track    : 1.14
 uncheckedFill vs track  : 1.00
 textSecondary/bgPrimary : 8.49
 textTertiary/bgPrimary  : 6.88
 divider/bgPrimary       : 1.80
 coverInk/coverPlaceholder: 5.40
 onError/error           : 10.05
 onAccent? textPrimary/accent: 1.41
 focusRing/bgSecondary   : 9.20
 textSecondary/bgSecondary(unchecked seg): 6.48
 textSecondary/bgCard(checked seg): 7.39

• Check library vocabulary consistency Explore Agent
✓ Check library vocabulary consistency Explore Agent

$ echo "--- StatusSelector ---"; sed -n '1,40p' src/components/library/StatusSelector.tsx; echo "--- who uses StatusSelector ---"; grep -rn "StatusSelector" app src --include=*.tsx --include=*.ts | grep -v "StatusSelector.tsx:"; echo "--- NoteCard date ---"; sed -n '40,60p' src/components/notes/NoteCard.tsx
--- StatusSelector ---
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';

export type ReadingStatus = 'want_to_read' | 'reading' | 'completed';

interface StatusSelectorProps {
    status: ReadingStatus;
    onChange: (status: ReadingStatus) => void;
    disabled?: boolean;
}

export const StatusSelector = ({ status, onChange, disabled }: StatusSelectorProps) => {
    const { colors } = useTheme();

    const options: { value: ReadingStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
        { value: 'want_to_read', label: 'Want to Read', icon: 'bookmark-outline' },
        { value: 'reading', label: 'Reading', icon: 'book-outline' },
        { value: 'completed', label: 'Completed', icon: 'checkmark-circle-outline' },
    ];

    return (
        <View style={styles.container}>
            {options.map((option) => {
                const isSelected = status === option.value;
                return (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        disabled={disabled}
                        activeOpacity={0.7}
                        style={[
                            styles.option,
                            {
                                backgroundColor: isSelected ? colors.accent : colors.bgCard,
                                borderColor: isSelected ? colors.accent : colors.border,
                            },
                        ]}
                    >
--- who uses StatusSelector ---
app/(tabs)/library/[bookId].tsx:17:    StatusSelector,
app/(tabs)/library/[bookId].tsx:316:                        <StatusSelector
app/(tabs)/library/__tests__/book-details-corrections.test.tsx:45:    return { StatusSelector: control('Reading status', 'completed'), OwnershipSelector: control('Ownership', 'borrowed'), ConditionPicker: control('Condition', 'good'),
app/(tabs)/library/__tests__/[bookId].test.tsx:57:    StatusSelector: () => null,
src/components/library/index.ts:1:export * from './StatusSelector';
src/components/library/LibraryAppearance.ts:141:// radii already in use in the book section (StatusSelector option 20, TagSelector tag
src/components/library/__tests__/LibraryAppearance.test.ts:272:        expect(read('../StatusSelector.tsx')).toContain('borderRadius: 20');
src/components/notes/__tests__/ManualNoteJourney.test.tsx:59:  return { StatusSelector: View, OwnershipSelector: View, ConditionPicker: View, RatingInput: View, DeleteBookModal: View };
--- NoteCard date ---
                },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const formattedDate = new Date(note.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    const formattedTime = new Date(note.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
    });

    const isQuote = note.tag === 'quote';

    return (
        <TouchableOpacity

$ sed -n '385,400p;488,512p' "app/(tabs)/library/[bookId].tsx"; echo "--- VaultPagesList empty ---"; sed -n '50,66p' src/components/library/VaultPagesList.tsx; echo "--- own review section ---"; sed -n '396,400p;435,445p' "app/(tabs)/library/[bookId].tsx"
{/* Vault Pages — SDD-03 browse/delete via getPagesForBook */}
                    <View style={[styles.notesSection, { backgroundColor: colors.bgCard }]}>
                        <View style={styles.notesSectionHeader}>
                            <View style={styles.notesTitleRow}>
                                <Ionicons name="bookmark-outline" size={18} color={colors.accent} />
                                <Text style={[styles.notesSectionTitle, { color: colors.textPrimary }]}>Saved Pages</Text>
                            </View>
                        </View>
                        <VaultPagesList userBookId={bookId!} />
                    </View>

                    <BookSection title="My review">
                        {/* Rating & Review */}
                        <RatingInput
                            rating={userBook.rating || 0}
                            onChange={(val) => submitReview({ rating: val })}
                    >
                        <Text style={styles.deleteText}>Remove from Library</Text>
                    </TouchableOpacity>

                    </BookSection>
                    <BookSection title="Community reviews">
                        {publicReviews.length > 0 && <Text style={{ color: colors.textSecondary }}>{publicReviews.length} public reviews</Text>}
                        {publicReviewsLoading ? (
                            <View style={styles.communityReviewsState}>
                                <ActivityIndicator size="small" color={colors.accent} />
                            </View>
                        ) : publicReviewsError ? (
                            <View style={styles.communityReviewsState}>
                                <Text style={[styles.communityReviewsStateText, { color: colors.textSecondary }]}>
                                    Community reviews are temporarily unavailable.
                                </Text>
                            </View>
                        ) : publicReviews.length === 0 ? (
                            <View style={styles.communityReviewsState} testID="community-reviews-empty">
                                <Text style={[styles.communityReviewsStateText, { color: colors.textSecondary }]}>
                                    No public reviews yet.
                                </Text>
                            </View>
                        ) : (
                            publicReviews.map((review) => {
--- VaultPagesList empty ---
    return (
        <View>
            {isError && <View style={styles.empty}>
                <Text accessibilityRole="alert" style={[styles.emptyText, { color: colors.error }]}>Couldn't refresh saved pages. Previously loaded pages are still shown.</Text>{retry}
            </View>}
            {pages.length === 0 && <View style={styles.empty}>
                <Ionicons name="bookmark-outline" size={24} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No saved pages yet.</Text>
            </View>}
            {pages.map((page) => (
                <View key={page.id} style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <View style={styles.header}>
                        <Text style={[styles.pageNum, { color: colors.accent }]}>Page {page.page_number}</Text>
                        <Text style={[styles.meta, { color: colors.textTertiary }]}>{page.word_count} words • {new Date(page.updated_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.excerpt, { color: colors.textPrimary }]} numberOfLines={3}>{page.content_excerpt}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete page ${page.page_number}`} disabled={deleteMutation.isPending} onPress={() => handleDelete(page)} style={styles.deleteBtn}>
--- own review section ---
                    <BookSection title="My review">
                        {/* Rating & Review */}
                        <RatingInput
                            rating={userBook.rating || 0}
                            onChange={(val) => submitReview({ rating: val })}
                                    size={16}
                                    color={colors.textSecondary}
                                />
                                <Text style={{ color: colors.textSecondary, fontSize: 13, marginLeft: 6 }}>
                                    {isReviewPublic ? 'Public Review' : 'Private Review'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {reviewDirty && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Review text has unsaved changes.</Text>}
                        {reviewBusy && <Text accessibilityLiveRegion="polite" style={{ color: colors.textSecondary }}>Saving review changes… Rating and visibility shown are the last confirmed settings.</Text>}

$ node -e "
const L=h=>{const v=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4));return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];};
const C=(a,b)=>{const x=L(a),y=L(b);return ((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05)).toFixed(2);};
['#948669','#8d7f60','#87785a','#817254'].forEach(h=>console.log(h,'vs track #eee5d6 =',C(h,'#eee5d6'),'| vs card #fffdf8 =',C(h,'#fffdf8')));
"
#948669 vs track #eee5d6 = 2.86 | vs card #fffdf8 = 3.52
#8d7f60 vs track #eee5d6 = 3.15 | vs card #fffdf8 = 3.87
#87785a vs track #eee5d6 = 3.46 | vs card #fffdf8 = 4.25
#817254 vs track #eee5d6 = 3.76 | vs card #fffdf8 = 4.62

## VERDICT
The prototype now embodies the essence: the reader's own words are the largest thing after the title, metadata sits at the edge, state is carried by weight and placement rather than colour, and the offline/error/empty copy states what is true without alarm. Three things still fail the essence rather than just the checklist — one vocabulary break against the shipped control, one contradiction inside the offline state, and one computed contrast edge in daylight. Ready to finalize: **YES WITH FIXES**.

## FINDINGS

| id | essence item | file:line | problem | concrete fix | severity |
|---|---|---|---|---|---|
| F1 | K3 | `components/StatusSegments.tsx:8-10` | "Finished" exists nowhere else in the app; the shipped control on this very screen (`StatusSelector.tsx:18-20`, rendered at `[bookId].tsx:316`) says 'Want to Read' / 'Reading' / 'Completed'. Same value, three names, one of them invented. | Use the exact `StatusSelector` strings: Want to Read / Reading / Completed. | must-fix |
| F2 | C6, C2 | `BookDetailsPrototype.tsx:104` (with `:62`, `:66-67`) | Offline prints "Changes need a connection." and disables status + Add note, but "Remove from library" stays live and opens a dialog promising a deletion that cannot happen. | Gate the destructive action on the same connection state: disable it with the same plain reason, or make the dialog say the change is held until you reconnect. | must-fix |
| F3 | A1 | `components/StatusSegments.tsx:58-59` + `LibraryAppearance.ts:81` | In daylight the selected segment's only boundary is **2.86:1** against the track (fill difference 1.23:1), so selection rests on bold-vs-regular. golden 3.18 and midnight 3.24 pass; daylight alone fails 1.4.11. | Darken daylight `controlBorder` to ~`#8d7f60` (3.15:1 on `bgSecondary`, 3.87:1 on `bgCard`) and add `controlBorder`/`bgSecondary` to `PROTOTYPE_PAIRS`. | must-fix |
| F4 | C2, K4 | `BookDetailsPrototype.tsx:83` (also `:70`) | "Saved pages" is removed from the tree when the count is zero, while the shipped screen always renders the section with "No saved pages yet." The reader cannot tell whether the feature exists or failed to load. | Always render the row; when empty show the shipped empty copy in the row and drop the chevron so the tap is not a dead end. | should-fix |
| F5 | K4, C1 | `BookDetailsPrototype.tsx:46-47, 95-99` | "Ownership & condition" summarizes "Owned · Good" and expands to exactly "Owned" / "Good" again — a tap that reveals nothing it did not already say. `condition` is also a hardcoded `'Good'` that ignores `book.condition`, so the real build would state something it never read. | Read condition from the book; either drop the summary and expand to borrowed-to/dates detail, or make the row non-interactive when there is nothing more to show. | should-fix |
| F6 | K4 | `BookDetailsPrototype.tsx:72-82` | With no review the row still expands and shows "No review yet." followed by a bare "Private" — a visibility setting for a review that does not exist, and a dead-end tap. | Show the visibility line only when `book.review` exists (shipped wording 'Public Review'/'Private Review'); when review is null, make the row lead to writing one or stop being a button. | should-fix |
| F7 | A1 | `components/StatusSegments.tsx:23` | `accessible` on the radiogroup View makes iOS treat the whole track as one accessibility element, collapsing the three radio Pressables out of the tree. | Keep `accessibilityRole="radiogroup"` but drop `accessible` (or set `accessible={false}`) so the radios stay exposed. | should-fix |
| F8 | K3, C2 | `components/NotePassages.tsx:10-13` | `noteDate` drops the year and hand-rolls a UTC month table, so a 2024 note reads "14 Oct"; the shipped `NoteCard.tsx:46-50` shows "14 Oct 2026". UTC getters can also show the previous day. | `new Date(stamp).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })` in local time; omit the year only when it is the current year. | should-fix |
| F9 | C2, K3 | `BookDetailsPrototype.tsx:101` | "No community reviews." is asserted for every preset with no data behind it, and is a fourth wording for a state the app already models three ways (`[bookId].tsx:502, 508` plus loading). | Drive the line from the real query state and reuse the shipped strings, or omit the row until the feature ships rather than claiming a fact. | should-fix |
| F10 | T2, T3 | `BookDetailsPrototype.tsx:86` | The reader's own saved words are set as a data row — "p. 42 · I went to the woods…" in sans body — the middle dot joining a field label to a sentence, ranked below the note passages. `VaultPagesList.tsx:65` sets the excerpt on its own line. | Render page label and excerpt as separate lines in the same serif as `NotePassages`, and use the shipped "Page 42" wording. | should-fix |

## KEEP
- The unboxed serif passages at 18/26 as the most prominent content after the title, with category/page/date demoted to a caption line — no boxes, no tint, no chips.
- Status state shown by weight + a lifted fill + the one permitted boundary; never an accent fill or colour alarm, and keep the measured vertical fallback plus roving tabindex and arrow keys.
- Offline and failure states that keep the book and the reader's notes on screen and say plainly what cannot happen — no spinner over content, no celebratory empty states.
- The remove dialog: title quotes the book, body states the notes, review and saved pages go too and cannot be undone, Cancel focused on open, focus returned to the trigger, native back dismisses.
- Space and hairlines instead of boxes, one accent-filled control on the screen ("Add note"), 48dp targets, focus ring always from `focusRing`.
