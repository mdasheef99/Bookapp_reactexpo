import { useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GoogleBook } from '@/features/books/services/booksService';
import { useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { useLibraryTypography } from '@/components/library/LibraryTypography';
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
    const fonts = useLibraryTypography();
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
        <View>
            <View style={{ marginBottom: 12, width: '100%', maxWidth: 920, alignSelf: 'center' }}>
                <View
                    style={{
                        backgroundColor: colors.bgCard,
                        borderRadius: 14,
                        padding: 12,
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        borderWidth: 1,
                        borderColor: isInLibrary ? colors.accent : colors.border,
                        shadowColor: colors.shadow,
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.07,
                        shadowRadius: 6,
                        elevation: 2,
                    }}
                >
                    <View style={{ width: 76, height: 114, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center' }}>
                        {imageUrl ? (
                            <Image source={{ uri: imageUrl }} style={{ width: 76, height: 114 }} contentFit="cover" transition={200} />
                        ) : (
                            <Ionicons name="book-outline" size={28} color={colors.textTertiary} />
                        )}
                        {volumeInfo.previewLink && (
                            <View style={{ position: 'absolute', bottom: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(32,26,19,0.78)', alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="eye" size={13} color="#fff" />
                            </View>
                        )}
                    </View>

                    <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                        {isInLibrary && <View style={{ marginBottom: 5 }}><InLibraryBadge /></View>}
                        <Text
                            style={{ color: colors.textPrimary, fontFamily: fonts.heading, fontSize: 20, lineHeight: 23 }}
                            numberOfLines={2}
                        >
                            {volumeInfo.title}
                        </Text>
                        {volumeInfo.subtitle ? (
                            <Text style={{ color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                                {volumeInfo.subtitle}
                            </Text>
                        ) : null}
                        <Text style={{ color: colors.textSecondary, fontSize: 13, fontFamily: fonts.body, marginTop: 3 }} numberOfLines={1}>
                            {volumeInfo.authors?.join(', ') || 'Author not listed'}
                        </Text>

                        {categories.length > 0 && (
                            <View style={{ flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' }}>
                                {categories.map((category, categoryIndex) => (
                                    <GenreTag key={`${category}-${categoryIndex}`} genre={category.split('/')[0].trim()} />
                                ))}
                            </View>
                        )}

                        {volumeInfo.description ? (
                            <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 17, marginTop: 4 }} numberOfLines={2}>
                                {volumeInfo.description}
                            </Text>
                        ) : null}

                        {(volumeInfo.publishedDate || volumeInfo.pageCount) ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6, gap: 12 }}>
                                {volumeInfo.publishedDate ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                                        <Text style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 4, fontFamily: fonts.body }}>{volumeInfo.publishedDate.split('-')[0]}</Text>
                                    </View>
                                ) : null}
                                {volumeInfo.pageCount ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="document-text-outline" size={13} color={colors.textTertiary} />
                                        <Text style={{ fontSize: 11, color: colors.textTertiary, marginLeft: 4, fontFamily: fonts.body }}>{volumeInfo.pageCount} pages</Text>
                                    </View>
                                ) : null}
                            </View>
                        ) : null}

                        <RatingStars rating={volumeInfo.averageRating} count={volumeInfo.ratingsCount} />
                        <PriceBadge
                            price={book.saleInfo?.retailPrice?.amount}
                            currency={book.saleInfo?.retailPrice?.currencyCode}
                            saleability={book.saleInfo?.saleability}
                        />

                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 9, gap: 7 }}>
                            {!isInLibrary ? (
                                <TouchableOpacity
                                    onPress={() => onAdd(book)}
                                    disabled={isAdding}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Add ${volumeInfo.title} to library`}
                                    accessibilityState={{ disabled: isAdding }}
                                    style={{ backgroundColor: colors.accent, minHeight: 44, paddingHorizontal: 12, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', opacity: isAdding ? 0.7 : 1 }}
                                >
                                    {isAdding ? <ActivityIndicator size="small" color={colors.onAccent} /> : <>
                                        <Ionicons name="add" size={18} color={colors.onAccent} />
                                        <Text style={{ color: colors.onAccent, fontSize: 13, fontFamily: fonts.label, marginLeft: 4 }}>Add to library</Text>
                                    </>}
                                </TouchableOpacity>
                            ) : (
                                <View style={{ backgroundColor: colors.tagBackground, minHeight: 40, paddingHorizontal: 10, borderRadius: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border }}>
                                    <Ionicons name="checkmark" size={17} color={colors.tagText} />
                                    <Text style={{ color: colors.tagText, fontSize: 12, fontFamily: fonts.label, marginLeft: 3 }}>Added</Text>
                                </View>
                            )}

                            <View style={{ backgroundColor: colors.bgSecondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                                <WishlistButton
                                    isWishlisted={isInWishlist}
                                    isLoading={isTogglingWishlist}
                                    onToggle={() => onWishlistToggle(book)}
                                    accessibilityLabel={`${isInWishlist ? 'Remove' : 'Add'} ${volumeInfo.title} ${isInWishlist ? 'from' : 'to'} wishlist`}
                                    size={18}
                                    color={isInWishlist ? colors.error : colors.accent}
                                />
                            </View>

                            {volumeInfo.previewLink ? (
                                <TouchableOpacity
                                    onPress={() => onPreview(volumeInfo.previewLink)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Preview ${volumeInfo.title}`}
                                    accessibilityHint="Opens the catalogue preview"
                                    style={{ backgroundColor: colors.bgSecondary, width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                                >
                                    <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            ) : null}

                            <TouchableOpacity
                                onPress={() => onShare(book)}
                                accessibilityRole="button"
                                accessibilityLabel={`Share ${volumeInfo.title}`}
                                accessibilityHint="Opens the system share options"
                                style={{ backgroundColor: colors.bgSecondary, width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>

                        {recordDetails.length > 0 && (
                            <>
                                <TouchableOpacity
                                    onPress={() => setShowRecordDetails((visible) => !visible)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${showRecordDetails ? 'Hide' : 'Show'} record details for ${volumeInfo.title}`}
                                    accessibilityState={{ expanded: showRecordDetails }}
                                    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingRight: 8 }}
                                >
                                    <Ionicons name="information-circle-outline" size={16} color={colors.accent} />
                                    <Text style={{ color: colors.accent, fontSize: 12, fontFamily: fonts.label, marginLeft: 5 }}>
                                        {showRecordDetails ? 'Hide record details' : 'Record details'}
                                    </Text>
                                    <Ionicons name={showRecordDetails ? 'chevron-up' : 'chevron-down'} size={15} color={colors.accent} style={{ marginLeft: 3 }} />
                                </TouchableOpacity>
                                {showRecordDetails && (
                                    <View style={{ backgroundColor: colors.bgPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, marginBottom: 3 }}>
                                        {recordDetails.map((detail) => (
                                            <View key={detail.label} style={{ flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 3 }}>
                                                <Text style={{ color: colors.textTertiary, fontSize: 11, fontFamily: fonts.label }}>{detail.label}: </Text>
                                                <Text selectable style={{ color: colors.textSecondary, fontSize: 11, fontFamily: fonts.body }}>{detail.value}</Text>
                                            </View>
                                        ))}
                                        <Text style={{ color: colors.textTertiary, fontSize: 10, fontFamily: fonts.body, marginTop: 4 }}>
                                            Details available for this catalogue record; other editions may appear as separate results.
                                        </Text>
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
};
