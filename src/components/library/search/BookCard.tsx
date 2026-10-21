import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GoogleBook } from '@/features/books/services/booksService';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { LibraryBookThumb } from '@/components/library/LibraryBookThumb';
import { COLUMN_MAX_WIDTH, CONTROL_DISABLED_OPACITY, ICON_SIZE } from '@/components/library/bookDetails/bookDetailsTokens';
import { RatingStars } from './RatingStars';
import { PriceBadge } from './PriceBadge';
import { GenreTag } from './GenreTag';
import { InLibraryBadge } from './InLibraryBadge';
import { WishlistButton } from './WishlistButton';

export interface BookCardProps {
    book: GoogleBook;
    index: number;
    isInLibrary: boolean;
    isAdding: boolean;
    isInWishlist: boolean;
    isTogglingWishlist: boolean;
    onAdd: (book: GoogleBook) => void;
    onPreview: (previewLink?: string) => void;
    onShare: (book: GoogleBook) => void;
    onWishlistToggle: (book: GoogleBook) => void;
}

const languageLabel = (value: string) => {
    const labels: Record<string, string> = {
        en: 'English', eng: 'English', hi: 'Hindi', hin: 'Hindi', es: 'Spanish', spa: 'Spanish',
        fr: 'French', fre: 'French', de: 'German', ger: 'German', it: 'Italian', ita: 'Italian',
    };
    return labels[value.toLowerCase()] ?? value.toUpperCase();
};

export const BookCard = ({
    book,
    isInLibrary,
    isAdding,
    isInWishlist,
    isTogglingWishlist,
    onAdd,
    onPreview,
    onShare,
    onWishlistToggle,
}: BookCardProps) => {
    const colors = useLibraryAppearance();
    const [showRecordDetails, setShowRecordDetails] = useState(false);
    const { volumeInfo } = book;
    const categories = volumeInfo.categories?.slice(0, 2) || [];
    const identifiers = volumeInfo.industryIdentifiers ?? [];
    const isbn13 = identifiers.find((entry) => entry.type === 'ISBN_13')?.identifier;
    const isbn10 = identifiers.find((entry) => entry.type === 'ISBN_10')?.identifier;
    const recordDetails = [
        volumeInfo.publisher ? { label: 'Publisher', value: volumeInfo.publisher } : null,
        volumeInfo.publishedDate ? { label: 'Published', value: volumeInfo.publishedDate } : null,
        volumeInfo.pageCount ? { label: 'Length', value: `${volumeInfo.pageCount} pages` } : null,
        volumeInfo.language ? { label: 'Language', value: languageLabel(volumeInfo.language) } : null,
        isbn13 ? { label: 'ISBN-13', value: isbn13 } : null,
        isbn10 ? { label: 'ISBN-10', value: isbn10 } : null,
    ].filter((item): item is { label: string; value: string } => !!item);
    const imageUrl = volumeInfo.imageLinks?.thumbnail
        ?.replace(/^http:/i, 'https:')
        .replace('zoom=1', 'zoom=2');

    return (
        <View style={[styles.card, { borderBottomColor: colors.divider }]}>
            <LibraryBookThumb title={volumeInfo.title} coverUrl={imageUrl} />
            <View style={styles.content}>
                {isInLibrary && <InLibraryBadge />}
                <Text style={[LIBRARY_TEXT.heading, { color: colors.textPrimary }]} numberOfLines={2}>{volumeInfo.title}</Text>
                {!!volumeInfo.subtitle && <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]} numberOfLines={1}>{volumeInfo.subtitle}</Text>}
                <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]} numberOfLines={1}>{volumeInfo.authors?.join(', ') || 'Author not listed'}</Text>
                {categories.length > 0 && <View style={styles.metadata}>
                    {categories.map((category, index) => <GenreTag key={`${category}-${index}`} genre={category.split('/')[0].trim()} />)}
                </View>}
                {!!volumeInfo.description && <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]} numberOfLines={2}>{volumeInfo.description}</Text>}
                {(volumeInfo.publishedDate || volumeInfo.pageCount) ? <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
                    {[volumeInfo.publishedDate?.split('-')[0], volumeInfo.pageCount ? `${volumeInfo.pageCount} pages` : undefined].filter(Boolean).join(' · ')}
                </Text> : null}
                <RatingStars rating={volumeInfo.averageRating} count={volumeInfo.ratingsCount} />
                <PriceBadge price={book.saleInfo?.retailPrice?.amount} currency={book.saleInfo?.retailPrice?.currencyCode} saleability={book.saleInfo?.saleability} />
                <View style={styles.actions}>
                    {!isInLibrary && <Pressable onPress={() => onAdd(book)} disabled={isAdding}
                        accessibilityRole="button" accessibilityLabel={`${isAdding ? 'Adding…' : 'Add to library'}: ${volumeInfo.title}`}
                        accessibilityState={{ disabled: isAdding, busy: isAdding }}
                        style={[styles.add, { backgroundColor: colors.bgCard, borderColor: colors.controlBorder, opacity: isAdding ? CONTROL_DISABLED_OPACITY : 1 }]}>
                        {isAdding && <ActivityIndicator size="small" color={colors.accent} />}
                        <Text style={[LIBRARY_TEXT.label, { color: colors.textPrimary }]}>{isAdding ? 'Adding…' : 'Add to library'}</Text>
                    </Pressable>}
                    <WishlistButton isWishlisted={isInWishlist} isLoading={isTogglingWishlist} onToggle={() => onWishlistToggle(book)}
                        accessibilityLabel={`${isInWishlist ? 'Remove' : 'Add'} ${volumeInfo.title} ${isInWishlist ? 'from' : 'to'} wishlist`}
                        size={ICON_SIZE} color={colors.accent} />
                    {!!volumeInfo.previewLink && <Pressable onPress={() => onPreview(volumeInfo.previewLink)} accessibilityRole="button"
                        accessibilityLabel={`Preview ${volumeInfo.title}`} accessibilityHint="Opens the catalogue preview" style={styles.iconButton}>
                        <Ionicons name="eye-outline" size={ICON_SIZE} color={colors.accent} />
                    </Pressable>}
                    <Pressable onPress={() => onShare(book)} accessibilityRole="button" accessibilityLabel={`Share ${volumeInfo.title}`}
                        accessibilityHint="Opens the system share options" style={styles.iconButton}>
                        <Ionicons name="share-outline" size={ICON_SIZE} color={colors.accent} />
                    </Pressable>
                </View>
                {recordDetails.length > 0 && <>
                    <Pressable onPress={() => setShowRecordDetails(visible => !visible)} accessibilityRole="button"
                        accessibilityLabel={`${showRecordDetails ? 'Hide' : 'Show'} record details for ${volumeInfo.title}`}
                        accessibilityState={{ expanded: showRecordDetails }} style={styles.disclosure}>
                        <Text style={[LIBRARY_TEXT.caption, { color: colors.accent }]}>{showRecordDetails ? 'Hide record details' : 'Record details'}</Text>
                        <Ionicons name={showRecordDetails ? 'chevron-up' : 'chevron-down'} size={ICON_SIZE} color={colors.accent} />
                    </Pressable>
                    {showRecordDetails && <View style={styles.details}>
                        {recordDetails.map(detail => <View key={detail.label} style={styles.metadata}>
                            <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{detail.label}: </Text>
                            <Text selectable style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{detail.value}</Text>
                        </View>)}
                        <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>Details available for this catalogue record; other editions may appear as separate results.</Text>
                    </View>}
                </>}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: { width: '100%', maxWidth: COLUMN_MAX_WIDTH, alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', gap: LIBRARY_SPACING.md, paddingVertical: LIBRARY_SPACING.md, borderBottomWidth: StyleSheet.hairlineWidth },
    content: { flex: 1, minWidth: 0, gap: LIBRARY_SPACING.xxs },
    metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: LIBRARY_SPACING.xxs },
    actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: LIBRARY_SPACING.xxs, marginTop: LIBRARY_SPACING.xs },
    add: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, paddingHorizontal: LIBRARY_SPACING.sm, paddingVertical: LIBRARY_SPACING.xs, borderRadius: LIBRARY_RADIUS.control, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: LIBRARY_SPACING.xs },
    iconButton: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
    disclosure: { minHeight: MIN_TARGET, minWidth: MIN_TARGET, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: LIBRARY_SPACING.xs },
    details: { gap: LIBRARY_SPACING.xs },
});
