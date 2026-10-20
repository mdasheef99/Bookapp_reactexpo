import { View, Text, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { GoogleBook } from '@/features/books/services/booksService';
import { LIBRARY_RADIUS, LIBRARY_SPACING, MIN_TARGET, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';
import { BookCard, BookCardProps } from './BookCard';
import * as Haptics from 'expo-haptics';
interface SwipeableBookCardProps extends Omit<BookCardProps, 'onAdd' | 'onWishlistToggle'> {
    onSwipeAddToLibrary?: (book: GoogleBook) => void;
    onSwipeAddToWishlist?: (book: GoogleBook) => void;
}
export const SwipeableBookCard = ({
    book,
    onSwipeAddToLibrary,
    onSwipeAddToWishlist,
    ...bookCardProps
}: SwipeableBookCardProps) => {
    const swipeableRef = useRef<Swipeable>(null);
    const colors = useLibraryAppearance();
    // Render right swipe action (Add to Library)
    const renderRightActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 0],
            extrapolate: 'clamp',
        });
        const canAdd = !bookCardProps.isInLibrary;
        return (
            <Animated.View
                style={[
                    styles.rightAction,
                    {
                        transform: [{ translateX: trans }],
                        backgroundColor: canAdd ? colors.accent : colors.tagBackground,
                    },
                ]}
            >
                <View style={styles.actionContent}>
                    <Ionicons
                        name={canAdd ? "book" : "checkmark-circle"}
                        size={MIN_TARGET / 2}
                        color={canAdd ? colors.onAccent : colors.tagText}
                    />
                    <Text style={[styles.actionText, { color: canAdd ? colors.onAccent : colors.tagText }]}>
                        {canAdd ? "Add to\nLibrary" : "In\nLibrary"}
                    </Text>
                </View>
            </Animated.View>
        );
    };
    // Render left swipe action (Add to Wishlist)
    const renderLeftActions = (
        progress: Animated.AnimatedInterpolation<number>,
        dragX: Animated.AnimatedInterpolation<number>
    ) => {
        const trans = dragX.interpolate({
            inputRange: [0, 100],
            outputRange: [0, 0],
            extrapolate: 'clamp',
        });
        const inWishlist = bookCardProps.isInWishlist;
        return (
            <Animated.View
                style={[
                    styles.leftAction,
                    {
                        transform: [{ translateX: trans }],
                        backgroundColor: colors.accent,
                    },
                ]}
            >
                <View style={styles.actionContent}>
                    <Ionicons
                        name={inWishlist ? "heart-dislike" : "heart"}
                        size={MIN_TARGET / 2}
                        color={colors.onAccent}
                    />
                    <Text style={[styles.actionText, { color: colors.onAccent }]}>
                        {inWishlist ? "Remove\nWishlist" : "Add to\nWishlist"}
                    </Text>
                </View>
            </Animated.View>
        );
    };
    // Handle swipe open
    const handleSwipeableOpen = (direction: 'left' | 'right') => {
        // Prevent action if adding to library but already in library
        if (direction === 'right' && bookCardProps.isInLibrary) {
            setTimeout(() => {
                swipeableRef.current?.close();
            }, 100);
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (direction === 'right' && onSwipeAddToLibrary) {
            onSwipeAddToLibrary(book);
        } else if (direction === 'left' && onSwipeAddToWishlist) {
            onSwipeAddToWishlist(book);
        }
        // Close the swipeable after action
        setTimeout(() => {
            swipeableRef.current?.close();
        }, 300);
    };
    return (
        <Swipeable
            ref={swipeableRef}
            renderRightActions={renderRightActions}
            renderLeftActions={renderLeftActions}
            onSwipeableOpen={handleSwipeableOpen}
            overshootRight={false}
            overshootLeft={false}
            friction={2}
            rightThreshold={80}
            leftThreshold={80}
        >
            <BookCard
                book={book}
                {...bookCardProps}
                onAdd={onSwipeAddToLibrary || (() => { })}
                onWishlistToggle={onSwipeAddToWishlist || (() => { })}
            />
        </Swipeable>
    );
};
const styles = StyleSheet.create({
    rightAction: {
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: LIBRARY_SPACING.lg,
        marginBottom: LIBRARY_SPACING.md,
        marginHorizontal: LIBRARY_SPACING.xxs,
        borderRadius: LIBRARY_RADIUS.control,
        minWidth: MIN_TARGET * 2,
    },
    leftAction: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: LIBRARY_SPACING.lg,
        marginBottom: LIBRARY_SPACING.md,
        marginHorizontal: LIBRARY_SPACING.xxs,
        borderRadius: LIBRARY_RADIUS.control,
        minWidth: MIN_TARGET * 2,
    },
    actionContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        ...LIBRARY_TEXT.label,
        marginTop: LIBRARY_SPACING.xxs,
        textAlign: 'center',
    },
});
