import { View, Text, StyleSheet, Animated } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { GoogleBook } from '@/features/books/services/booksService';
import { ThemeColors } from '@/hooks/useTheme';
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
                        backgroundColor: canAdd ? '#10B981' : '#9CA3AF',
                    },
                ]}
            >
                <View style={styles.actionContent}>
                    <Ionicons
                        name={canAdd ? "book" : "checkmark-circle"}
                        size={28}
                        color="#fff"
                    />
                    <Text style={styles.actionText}>
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
                        backgroundColor: inWishlist ? '#EF4444' : '#F472B6',
                    },
                ]}
            >
                <View style={styles.actionContent}>
                    <Ionicons
                        name={inWishlist ? "heart-dislike" : "heart"}
                        size={28}
                        color="#fff"
                    />
                    <Text style={styles.actionText}>
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
        paddingLeft: 20,
        marginBottom: 16,
        marginHorizontal: 4,
        borderRadius: 20,
        minWidth: 120,
    },
    leftAction: {
        justifyContent: 'center',
        alignItems: 'flex-end',
        paddingRight: 20,
        marginBottom: 16,
        marginHorizontal: 4,
        borderRadius: 20,
        minWidth: 120,
    },
    actionContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
        textAlign: 'center',
    },
});
