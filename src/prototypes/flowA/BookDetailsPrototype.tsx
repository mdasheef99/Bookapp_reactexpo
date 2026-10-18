import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getLibraryAppearance } from '@/components/library/LibraryAppearance';
import type { ThemePhase } from '@/hooks/useTheme';
import { FIXTURES } from './fixtures';
import type { OpenRow, Preset } from './fixtures';
import { ICON_SIZE, MAX_SCORE, styles, usePrototypeText } from './prototypeTokens';
import { Header } from './components/Header';
import { CoverBlock } from './components/CoverBlock';
import { StatusSegments } from './components/StatusSegments';
import { NotePassages } from './components/NotePassages';
import { PrimaryButton } from './components/PrimaryButton';
import { TextButton } from './components/TextButton';
import { DetailRow } from './components/DetailRow';
import { RemoveDialog } from './components/RemoveDialog';
import { ScreenStates } from './components/ScreenStates';
import { ReservedSlot } from './components/ReservedSlot';
import { OfflineNotice } from './components/OfflineNotice';

export function BookDetailsPrototype({ preset, phase, initialOpen, showSlots = false }: {
    preset: Preset; phase: ThemePhase; initialOpen?: OpenRow; showSlots?: boolean;
}) {
    const colors = getLibraryAppearance(phase);
    const text = usePrototypeText();
    const { book, notes, savedPages } = FIXTURES[preset];
    const wholeScreen = preset === 'loading' || preset === 'error' || preset === 'not-found';
    const [open, setOpen] = useState<OpenRow | undefined>(initialOpen);
    const [removeOpen, setRemoveOpen] = useState(initialOpen === 'remove' && !wholeScreen);
    const removeTrigger = useRef<View>(null);
    const pageRef = useRef<View>(null);
    useEffect(() => {
        if (Platform.OS !== 'web' || !pageRef.current) return;
        // RN-web does not forward the inert prop. Its View ref is the DOM node.
        const page = pageRef.current as unknown as { inert: boolean };
        page.inert = removeOpen;
        return () => { page.inert = false; };
    }, [removeOpen]);
    const wasOpen = useRef(removeOpen);
    useEffect(() => {
        if (wasOpen.current && !removeOpen) removeTrigger.current?.focus();
        wasOpen.current = removeOpen;
    }, [removeOpen]);
    const toggle = (id: OpenRow) => () => setOpen(current => current === id ? undefined : id);
    const ownership = book.ownership === 'lent_out' ? 'Lent out' : 'Owned';
    const condition = book.condition;
    const ownershipSummary = book.ownership === 'lent_out' || !condition ? ownership : `${ownership} · ${condition}`;
    const hasOwnershipDetails = book.ownership === 'lent_out' && Boolean(condition);
    const body = [text.body, { color: colors.textPrimary }];

    return <View style={[styles.page, { backgroundColor: colors.bgPrimary }]}>
        <View ref={pageRef} testID="fa-page" aria-hidden={removeOpen} importantForAccessibility={removeOpen ? 'no-hide-descendants' : 'auto'}
            style={[styles.page, { backgroundColor: colors.bgPrimary }]}>
            <ScrollView contentContainerStyle={styles.content}>
                <Header colors={colors} showSlots={showSlots} />
                {wholeScreen ? <ScreenStates state={preset} colors={colors} /> : <>
                    {preset === 'offline' && <OfflineNotice colors={colors} />}
                    {preset === 'refresh-failed' && <View style={styles.refreshNotice}>
                        <Text style={[text.body, { color: colors.textSecondary }]}>Couldn't refresh.</Text>
                        <TextButton label="Try again" colors={colors} onPress={() => console.info('[FA-P1] would retry book')} />
                    </View>}
                    <CoverBlock key={preset} book={book} colors={colors} />
                    <StatusSegments key={`status-${preset}`} initialStatus={book.reading_status} colors={colors} disabled={preset === 'offline'} />
                    {showSlots && <ReservedSlot kind="dates" colors={colors} />}
                    <NotePassages notes={notes} state={preset} colors={colors} />
                    <View testID="fa-action" style={styles.action}>
                        {preset === 'offline' && <Text testID="fa-connection-notice" style={[text.body, styles.connectionNotice, { color: colors.textSecondary }]}>Changes need a connection.</Text>}
                        <PrimaryButton label="Add note" colors={colors} disabled={preset === 'offline'} onPress={() => console.info('[FA-P1] would add note')} />
                    </View>
                    <View style={styles.rows}>
                        {notes.length > 0 && <DetailRow id="notes" label="All notes" link colors={colors}
                            onPress={() => console.info('[FA-P1] would open notes list')} />}
                        <DetailRow id="review" label="Your review" secondary={book.review?.split('\n')[0] || 'No review yet.'}
                            absent={!book.review} expanded={book.review ? open === 'review' : undefined} colors={colors}
                            onPress={book.review ? toggle('review') : () => console.info('[FA-P1] would open review editor')}>
                            {book.review && <>
                                {book.rating != null && <View testID="fa-own-score" accessible accessibilityLabel={`Your rating: ${book.rating} of ${MAX_SCORE}`} style={styles.stars}>
                                    {Array.from({ length: MAX_SCORE }, (_, index) => <Ionicons key={index}
                                        testID={index < book.rating! ? 'fa-star-filled' : 'fa-star-empty'}
                                        name={index < book.rating! ? 'star' : 'star-outline'} size={ICON_SIZE}
                                        color={colors.textPrimary} accessible={false} aria-hidden />)}
                                </View>}
                                <Text style={body}>{book.review}</Text>
                                <Text style={[text.body, { color: colors.textSecondary }]}>{book.review_is_public ? 'Public' : 'Private'}</Text>
                            </>}
                        </DetailRow>
                        {savedPages.length > 0 && <DetailRow id="saved" label="Saved pages"
                            secondary={`${savedPages.length} ${savedPages.length === 1 ? 'page' : 'pages'}`}
                            expanded={open === 'saved'} colors={colors} onPress={toggle('saved')}>
                            {savedPages.map(page => <View key={page.id} style={styles.passage}>
                                <Text style={[text.caption, { color: colors.textSecondary }]}>{`Page ${page.page_number}`}</Text>
                                <Text style={[text.bodySerif, { color: colors.textPrimary }]}>{page.content_excerpt.split('\n')[0]}</Text>
                            </View>)}
                        </DetailRow>}
                        <DetailRow id="info" label="Book information" expanded={open === 'info'} colors={colors} onPress={toggle('info')}>
                            <Text style={body}>{`Pages · ${book.page_count}`}</Text>
                            <Text style={body}>{`Publisher · ${book.publisher}`}</Text>
                            <Text style={body}>{`Published · ${book.published_year}`}</Text>
                            <Text style={body}>{`ISBN-13 · ${book.isbn_13 ?? 'Not available'}`}</Text>
                            <Text style={body}>{book.description}</Text>
                        </DetailRow>
                        <DetailRow id="ownership" label="Ownership & condition" secondary={ownershipSummary}
                            expanded={hasOwnershipDetails ? open === 'ownership' : undefined} colors={colors}
                            onPress={hasOwnershipDetails ? toggle('ownership') : undefined}>
                            <Text style={body}>{ownership}</Text>
                            <Text style={body}>{condition}</Text>
                        </DetailRow>
                        <View style={[styles.row, { borderColor: colors.divider }]}>
                            <Text style={[text.body, { color: colors.textSecondary }]}>No community reviews.</Text>
                        </View>
                    </View>
                    <TextButton ref={removeTrigger} label="Remove from library" colors={colors} disabled={preset === 'offline'}
                        style={styles.remove} onPress={() => setRemoveOpen(true)} />
                </>}
            </ScrollView>
        </View>
        {removeOpen && !wholeScreen && <RemoveDialog title={book.title} colors={colors} onClose={() => setRemoveOpen(false)} />}
    </View>;
}
