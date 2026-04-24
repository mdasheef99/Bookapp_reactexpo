import { View, Text, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRef, useEffect } from 'react';
import { GoogleBook } from '@/features/books/services/booksService';
import { useTheme } from '@/hooks/useTheme';
import { RatingStars, PriceBadge, GenreTag, InLibraryBadge, WishlistButton } from './index';

// Props interface
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

// Animated wrapper for stagger effect
const AnimatedWrapper = ({ index, children }: { index: number; children: React.ReactNode }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: (index % 20) * 60, useNativeDriver: true }),
            Animated.timing(translateY, { toValue: 0, duration: 400, delay: (index % 20) * 60, useNativeDriver: true }),
        ]).start();
    }, []);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }] }}>
            {children}
        </Animated.View>
    );
};

// Helper to get high-res image
const getHighResImage = (imageLinks?: { thumbnail?: string }) => {
    if (!imageLinks?.thumbnail) return 'https://via.placeholder.com/150x220?text=No+Cover';
    return imageLinks.thumbnail.replace('http:', 'https:').replace('zoom=1', 'zoom=2');
};

export const BookCard = ({
    book,
    index,
    isInLibrary,
    isAdding,
    isInWishlist,
    isTogglingWishlist,
    onAdd,
    onPreview,
    onShare,
    onWishlistToggle,
}: BookCardProps) => {
    const { colors } = useTheme();
    const imageUrl = getHighResImage(book.volumeInfo.imageLinks);
    const categories = book.volumeInfo.categories?.slice(0, 2) || [];

    return (
        <AnimatedWrapper index={index}>
            <View
                style={{
                    marginBottom: 16,
                    marginHorizontal: 4,
                }}
            >
                <View
                    style={{
                        backgroundColor: colors.bgCard,
                        borderRadius: 20,
                        padding: 14,
                        flexDirection: 'row',
                        borderWidth: 1,
                        borderColor: isInLibrary ? colors.accent : colors.border,
                        shadowColor: colors.shadow,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.15,
                        shadowRadius: 12,
                        elevation: 5,
                    }}
                >
                    {/* Cover Image */}
                    <View style={{ borderRadius: 12, overflow: 'hidden' }}>
                        <Image
                            source={{ uri: imageUrl }}
                            style={{ width: 95, height: 145, borderRadius: 12 }}
                            contentFit="cover"
                            transition={300}
                        />
                        {book.volumeInfo.previewLink && (
                            <View style={{
                                position: 'absolute',
                                bottom: 6,
                                right: 6,
                                backgroundColor: 'rgba(0,0,0,0.7)',
                                borderRadius: 12,
                                padding: 4,
                            }}>
                                <Ionicons name="eye" size={14} color="#fff" />
                            </View>
                        )}
                    </View>

                    {/* Book Details */}
                    <View style={{ flex: 1, marginLeft: 16, justifyContent: 'space-between', paddingVertical: 2 }}>
                        <View>
                            {isInLibrary && <InLibraryBadge />}
                            <Text
                                style={{
                                    fontSize: 17,
                                    fontWeight: '700',
                                    color: colors.textPrimary,
                                    lineHeight: 22,
                                    marginBottom: 4,
                                    marginTop: isInLibrary ? 6 : 0,
                                }}
                                numberOfLines={2}
                            >
                                {book.volumeInfo.title}
                            </Text>
                            <Text style={{ fontSize: 14, color: colors.textSecondary, fontWeight: '500' }} numberOfLines={1}>
                                by {book.volumeInfo.authors?.[0] || 'Unknown Author'}
                            </Text>

                            {/* Genre Tags */}
                            {categories.length > 0 && (
                                <View style={{ flexDirection: 'row', marginTop: 6, flexWrap: 'wrap' }}>
                                    {categories.map((cat, i) => (
                                        <GenreTag key={i} genre={cat.split('/')[0].trim()} />
                                    ))}
                                </View>
                            )}

                            {/* Description */}
                            {book.volumeInfo.description && (
                                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 6, lineHeight: 18 }} numberOfLines={2}>
                                    {book.volumeInfo.description}
                                </Text>
                            )}

                            {/* Metadata Row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                                {book.volumeInfo.publishedDate && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                                        <Ionicons name="calendar-outline" size={13} color={colors.textTertiary} />
                                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                                            {book.volumeInfo.publishedDate.split('-')[0]}
                                        </Text>
                                    </View>
                                )}
                                {book.volumeInfo.pageCount && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="document-text-outline" size={13} color={colors.textTertiary} />
                                        <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 4 }}>
                                            {book.volumeInfo.pageCount} pages
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {/* Rating & Price */}
                            <RatingStars rating={book.volumeInfo.averageRating} count={book.volumeInfo.ratingsCount} />
                            <PriceBadge
                                price={book.saleInfo?.retailPrice?.amount}
                                currency={book.saleInfo?.retailPrice?.currencyCode}
                                saleability={book.saleInfo?.saleability}
                            />
                        </View>

                        {/* Action Buttons */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                            {!isInLibrary ? (
                                <TouchableOpacity
                                    onPress={() => onAdd(book)}
                                    disabled={isAdding}
                                    style={{
                                        backgroundColor: colors.accent,
                                        flexDirection: 'row',
                                        paddingHorizontal: 14,
                                        paddingVertical: 10,
                                        borderRadius: 14,
                                        alignItems: 'center',
                                        opacity: isAdding ? 0.7 : 1,
                                        marginRight: 8,
                                    }}
                                >
                                    {isAdding ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <>
                                            <Ionicons name="add" size={18} color="#fff" />
                                            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700', marginLeft: 4 }}>Add</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View style={{
                                    backgroundColor: colors.bgSecondary,
                                    paddingHorizontal: 14,
                                    paddingVertical: 10,
                                    borderRadius: 14,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    marginRight: 8,
                                }}>
                                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                                    <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>Added</Text>
                                </View>
                            )}

                            {/* Wishlist Button */}
                            <View style={{
                                backgroundColor: colors.bgSecondary,
                                borderRadius: 14,
                                borderWidth: 1,
                                borderColor: colors.border,
                                marginRight: 8,
                            }}>
                                <WishlistButton
                                    isWishlisted={isInWishlist}
                                    isLoading={isTogglingWishlist}
                                    onToggle={() => onWishlistToggle(book)}
                                    size={18}
                                    color={colors.accent}
                                />
                            </View>

                            {book.volumeInfo.previewLink && (
                                <TouchableOpacity
                                    onPress={() => onPreview(book.volumeInfo.previewLink)}
                                    style={{
                                        backgroundColor: colors.bgSecondary,
                                        padding: 10,
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                        marginRight: 8,
                                    }}
                                >
                                    <Ionicons name="eye-outline" size={18} color={colors.textSecondary} />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                onPress={() => onShare(book)}
                                style={{
                                    backgroundColor: colors.bgSecondary,
                                    padding: 10,
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                }}
                            >
                                <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </AnimatedWrapper>
    );
};
