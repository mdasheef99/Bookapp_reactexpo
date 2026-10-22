import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { useLibraryAppearance, LIBRARY_SPACING } from './LibraryAppearance';
import { useLibraryTypography } from './LibraryTypography';
import { conditionLabel, ownershipLabel, readingStatusLabel } from '@/features/books/utils/libraryLabels';
import { booksService } from '@/features/books/services/booksService';
import { historyKeys } from '@/features/books/history/readingHistoryContract';
import { readingHistoryGateway } from '@/features/books/history/readingHistoryGateway';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useBookFeedback, BookButton, BookFeedbackSlot } from './ui';
import { notifySaveSuccess } from '@/features/books/history/saveConfirmation';

/** Facts already loaded with the Library entry; no invented progress or extra request. */
export function LibraryBookQuickLook({ book, onClose, onDetails }: {
    book: LibraryBookEntry | null; onClose: () => void; onDetails: (book: LibraryBookEntry) => void;
}) {
    if (!book) return null;
    return <QuickLookBody book={book} onClose={onClose} onDetails={onDetails} />;
}

function QuickLookBody({ book, onClose, onDetails }: {
    book: LibraryBookEntry; onClose: () => void; onDetails: (book: LibraryBookEntry) => void;
}) {
    const colors = useLibraryAppearance(), fonts = useLibraryTypography();
    const closeRef = React.useRef<any>(null);
    const { session } = useAuth();
    const actorId = session?.user?.id ?? '';
    const client = useQueryClient();
    const { notify } = useBookFeedback();
    const [starting, setStarting] = React.useState(false);
    const startGuard = React.useRef(false);
    const showStart = book.reading_status !== 'reading';
    const isFinished = book.reading_status === 'completed';
    const startLabel = isFinished ? 'Read again' : 'Start reading';
    const handleStart = () => {
        if (startGuard.current || starting) return;
        if (!actorId || !book) return;
        startGuard.current = true;
        setStarting(true);
        const targetId = book.id;
        const finished = isFinished;
        const attempt = async () => {
            try {
                if (finished) {
                    await readingHistoryGateway.startReread(actorId, targetId);
                } else {
                    await booksService.updateReadingStatus(targetId, 'reading');
                }
            } catch (error) {
                const message = error instanceof Error && error.message ? error.message : "Couldn't update reading status.";
                notify({
                    kind: 'error',
                    message,
                    action: { label: 'Retry', onPress: () => { void handleStart(); } },
                });
                throw error;
            }
            notifySaveSuccess(notify, finished ? 'Reading again' : 'Started reading');
            client.invalidateQueries({ queryKey: ['library'] });
            client.invalidateQueries({ queryKey: historyKeys.readsForBook(actorId, targetId) });
            client.invalidateQueries({ queryKey: historyKeys.readsForUser(actorId) });
            client.invalidateQueries({ queryKey: historyKeys.openReads(actorId) });
        };
        void attempt().catch(() => {}).finally(() => {
            startGuard.current = false;
            setStarting(false);
        });
    };
    const facts = [
        ['Reading status', book.reading_status ? readingStatusLabel(book.reading_status) : 'Not recorded'],
        ['Collection', book.ownership ? ownershipLabel(book.ownership) : 'Not recorded'],
        ...(typeof book.book.page_count === 'number' && Number.isFinite(book.book.page_count) && book.book.page_count > 0 ? [['Pages', String(book.book.page_count)]] : []),
        ...(typeof book.condition === 'string' && book.condition.length > 0 ? [['Condition', conditionLabel(book.condition)]] : []),
        ...(typeof book.rating === 'number' && Number.isFinite(book.rating) && book.rating >= 1 && book.rating <= 5 ? [['Your rating', `${book.rating} / 5`]] : []),
    ];
    return <Modal transparent animationType="none" accessibilityLabel="Book quick look" onRequestClose={onClose}
        onShow={() => closeRef.current?.focus?.()}>
        <View style={styles.backdrop}>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss book quick look" onPress={onClose} style={StyleSheet.absoluteFill} />
            <View accessibilityViewIsModal testID="library-book-quick-look" style={[styles.panel, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <View style={styles.header}>
                    <Text accessibilityRole="header" style={{ fontFamily: fonts.heading, fontSize: 24, color: colors.textPrimary }}>Quick look</Text>
                    <Pressable ref={closeRef} testID="library-quick-look-close" accessibilityRole="button" accessibilityLabel="Close book quick look" onPress={onClose} style={styles.button}>
                        <Text style={{ fontFamily: fonts.label, color: colors.textPrimary }}>Close</Text>
                    </Pressable>
                </View>
                <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 20, gap: 12 }}>
                    <View style={styles.bookHeader}>
                        {book.book.cover_url ? <Image source={{ uri: book.book.cover_url }} contentFit="contain" accessible={false} style={{ width: 64, height: 96 }} /> : null}
                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ fontFamily: fonts.serif, fontSize: 25, color: colors.textPrimary }}>{book.book.title}</Text>
                            {book.book.authors?.some((author) => author.trim()) ? <Text style={{ fontFamily: fonts.body, color: colors.textSecondary, marginTop: 6 }}>{book.book.authors.filter((author) => author.trim()).join(', ')}</Text> : null}
                        </View>
                    </View>
                    {facts.map(([label, value]) => <View key={label} style={[styles.fact, { borderColor: colors.border }]}>
                        <Text style={{ fontFamily: fonts.body, color: colors.textSecondary }}>{label}</Text>
                        <Text style={{ fontFamily: fonts.label, color: colors.textPrimary }}>{value}</Text>
                    </View>)}
                    {book.review?.trim() ? <View style={{ gap: 4 }}><Text style={{ fontFamily: fonts.label, color: colors.textSecondary }}>Your review</Text>
                        <Text style={{ fontFamily: fonts.body, color: colors.textPrimary }}>{book.review}</Text></View> : null}
                </ScrollView>
                {showStart ? <View style={{ paddingHorizontal: LIBRARY_SPACING.md, paddingBottom: LIBRARY_SPACING.xs }}>
                    <BookButton label={startLabel} variant="secondary" disabled={starting || !actorId}
                        onPress={handleStart} testID="library-quick-look-start-reading" />
                </View> : null}
                <Pressable testID="library-quick-look-details" accessibilityRole="button" accessibilityLabel={`View details for ${book.book.title}`}
                    onPress={() => { onClose(); onDetails(book); }} style={[styles.details, { borderColor: colors.border }]}>
                    <Text style={{ fontFamily: fonts.label, color: colors.textPrimary }}>View details</Text>
                </Pressable>
                <View pointerEvents="box-none" style={styles.feedbackOverlay}>
                    <BookFeedbackSlot />
                </View>
            </View>
        </View>
    </Modal>;
}
const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    panel: { width: '100%', maxWidth: 480, maxHeight: '85%', borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 20, paddingTop: 8 },
    button: { minHeight: 44, minWidth: 60, justifyContent: 'center', alignItems: 'center' },
    bookHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    fact: { paddingVertical: 8, borderBottomWidth: 1, gap: 4 },
    details: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1 },
    feedbackOverlay: { position: 'absolute', top: 8, left: 12, right: 12, zIndex: 1 },
});
