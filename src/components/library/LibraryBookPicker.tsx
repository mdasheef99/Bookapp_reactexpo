import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LibraryBookEntry } from '@/features/books/utils/libraryShelf';
import { LIBRARY_RADIUS, LIBRARY_SPACING, useLibraryAppearance } from './LibraryAppearance';
import { useLibraryTypography } from './LibraryTypography';

// A separate, non-overlapping activation path preserves the narrow physical spines.
export function LibraryBookPicker({ books, onBookPress, activeBook = null, selecting = false, onQuickLook }: {
    books: LibraryBookEntry[];
    onBookPress: (book: LibraryBookEntry) => void;
    activeBook?: LibraryBookEntry | null;
    selecting?: boolean;
    onQuickLook?: (book: LibraryBookEntry) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const colors = useLibraryAppearance();
    const fonts = useLibraryTypography();
    React.useEffect(() => { setOpen(false); }, [books]);
    if (books.length === 0) return null;

    const activeAuthors = activeBook?.book.authors?.filter((author) => author.trim().length > 0).join(', ');

    return (
        <>
            <Pressable testID="library-book-picker-open" accessibilityRole="button"
                accessibilityLabel={activeBook
                    ? `Highlighted book: ${activeBook.book.title}${activeAuthors ? ` by ${activeAuthors}` : ''}. Opens the title chooser.`
                    : 'Choose a book by title'}
                accessibilityHint="Opens a list of book titles with larger buttons"
                accessibilityState={{ expanded: open }} onPress={() => setOpen(true)}
                style={[styles.openButton, { borderColor: colors.border, backgroundColor: colors.bgCard }]}>
                {activeBook ? (
                    <View testID="library-active-book-caption" style={styles.activeCaption} pointerEvents="none" accessible={false}>
                        <Text testID="library-active-book-caption-title"
                            style={[styles.activeTitle, { color: colors.textPrimary, fontFamily: fonts.heading }]}>
                            {activeBook.book.title}
                        </Text>
                        {activeAuthors ? (
                            <Text testID="library-active-book-caption-author"
                                style={[styles.activeAuthor, { color: colors.textSecondary, fontFamily: fonts.body }]}>
                                {activeAuthors}
                            </Text>
                        ) : null}
                    </View>
                ) : (
                    <>
                        <Ionicons name="list-outline" size={18} color={colors.textPrimary} accessible={false} />
                        <Text style={[styles.openLabel, { color: colors.textPrimary, fontFamily: fonts.body }]}>Choose a book</Text>
                    </>
                )}
                {activeBook ? (
                    <View style={styles.browseAction} pointerEvents="none" accessible={false}>
                        <Ionicons name="list-outline" size={18} color={colors.textPrimary} accessible={false} />
                        <Text style={[styles.browseLabel, { color: colors.textSecondary, fontFamily: fonts.body }]}>Browse</Text>
                    </View>
                ) : null}
            </Pressable>
            {open ? (
                <Modal transparent animationType="none" accessibilityLabel="Choose a book" onRequestClose={() => setOpen(false)}>
                    <View style={styles.backdrop}>
                        <View style={[styles.panel, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
                            accessibilityViewIsModal testID="library-book-picker-panel">
                            <View style={styles.header}>
                                <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary, fontFamily: fonts.heading }]}>Choose a book</Text>
                                <Pressable onPress={() => setOpen(false)} accessibilityRole="button"
                                    accessibilityLabel="Close book chooser" testID="library-book-picker-close" style={styles.closeButton}>
                                    <Ionicons name="close-outline" size={24} color={colors.textPrimary} accessible={false} />
                                </Pressable>
                            </View>
                            <FlatList testID="library-book-picker-list" style={styles.list} data={books} keyExtractor={(book) => book.id}
                                renderItem={({ item }) => (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Pressable testID={`library-book-picker-entry-${item.id}`} accessibilityRole="button"
                                        accessibilityLabel={`${selecting ? 'Select' : 'Open'} ${item.book.title}${item.book.authors?.[0] ? ` by ${item.book.authors[0]}` : ''}`}
                                        onPress={() => { setOpen(false); onBookPress(item); }}
                                        style={[styles.entry, { flex: 1, borderBottomColor: colors.border }]}>
                                        <Text style={[styles.title, { color: colors.textPrimary, fontFamily: fonts.heading }]}>{item.book.title}</Text>
                                        {item.book.authors?.length ? (
                                            <Text style={[styles.author, { color: colors.textSecondary, fontFamily: fonts.body }]}>{item.book.authors.join(', ')}</Text>
                                        ) : null}
                                    </Pressable>
                                    {onQuickLook && !selecting ? <Pressable testID={`library-book-picker-quick-${item.id}`}
                                        accessibilityRole="button" accessibilityLabel={`Quick look at ${item.book.title}`}
                                        onPress={() => { setOpen(false); onQuickLook(item); }}
                                        style={{ minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center' }}>
                                        <Text style={{ fontFamily: fonts.label, color: colors.textPrimary }}>Quick look</Text>
                                    </Pressable> : null}
                                    </View>
                                )} />
                        </View>
                    </View>
                </Modal>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    openButton: { minHeight: 60, minWidth: 44, borderWidth: 1, borderRadius: LIBRARY_RADIUS.control,
        paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
        marginBottom: LIBRARY_SPACING.large },
    openLabel: { fontSize: 14, lineHeight: 20 },
    activeCaption: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
    activeTitle: { fontSize: 16, lineHeight: 20, flexWrap: 'wrap' },
    activeAuthor: { fontSize: 12, lineHeight: 16, marginTop: 2, flexWrap: 'wrap' },
    browseAction: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 10 },
    browseLabel: { fontSize: 12, lineHeight: 16 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
    panel: { width: '100%', maxWidth: 552, height: '70%', maxHeight: 640, borderWidth: 1, borderRadius: LIBRARY_RADIUS.card, overflow: 'hidden' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12 },
    heading: { flex: 1, fontSize: 26, lineHeight: 30 },
    closeButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
    list: { flex: 1 },
    entry: { minWidth: 44, minHeight: 64, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, justifyContent: 'center' },
    title: { fontSize: 22, lineHeight: 26 },
    author: { fontSize: 14, lineHeight: 20, marginTop: 4 },
});
