import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { booksService } from '@/features/books/services/booksService';
import { useTheme } from '@/hooks/useTheme';

export default function LibraryScreen() {
    const { session } = useAuth();
    const { colors } = useTheme();

    const { data: books, isLoading, refetch } = useQuery({
        queryKey: ['library', session?.user?.id],
        queryFn: () => booksService.getUserLibrary(session!.user.id),
        enabled: !!session?.user?.id,
    });

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>

                <ActivityIndicator size="large" color="#91C55E" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Whimsical gradient background */}
            <LinearGradient
                colors={['#d9f99d', '#fef08a', '#bae6fd']}
                style={styles.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />


            {/* Decorative book elements */}
            <View style={[styles.bookDecor, styles.bookDecor1]} />
            <View style={[styles.bookDecor, styles.bookDecor2]} />

            {/* Content */}
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>My Library</Text>
                    <TouchableOpacity
                        onPress={() => router.push('/(tabs)/library/search')}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#84cc16', '#eab308']}
                            style={styles.addButton}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                        >
                            <Text style={styles.addButtonText}>+ Add Book</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Book List */}
                <FlatList
                    data={books}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.accent} />
                    }
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={() => router.push(`/(tabs)/library/${item.id}`)}
                        >
                            <View style={styles.bookCardContainer}>
                                {/* Glassmorphism overlay */}
                                <LinearGradient
                                    colors={['rgba(255, 255, 255, 0.9)', 'rgba(255, 255, 255, 0.7)']}
                                    style={styles.bookCardOverlay}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 0, y: 1 }}
                                />

                                <View style={styles.bookCard}>
                                    <Image
                                        source={{ uri: item.book.cover_url || 'https://via.placeholder.com/100x150' }}
                                        style={styles.bookCover}
                                        contentFit="cover"
                                    />
                                    <View style={styles.bookInfo}>
                                        <Text style={styles.bookTitle} numberOfLines={2}>
                                            {item.book.title}
                                        </Text>
                                        <Text style={styles.bookAuthor} numberOfLines={1}>
                                            {item.book.authors?.join(', ')}
                                        </Text>
                                        <View style={styles.tagContainer}>
                                            <View style={styles.tag}>
                                                <Text style={styles.tagText}>
                                                    {item.reading_status.replace(/_/g, ' ')}
                                                </Text>
                                            </View>
                                            <View style={styles.tag}>
                                                <Text style={styles.tagText}>
                                                    {item.ownership}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyTitle}>📚</Text>
                            <Text style={styles.emptySubtitle}>Your library is empty</Text>
                            <Text style={styles.emptyText}>
                                Tap the "+ Add Book" button to start building your collection.
                            </Text>
                        </View>
                    }
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    bookDecor: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 8,
        transform: [{ rotate: '-15deg' }],
    },
    bookDecor1: {
        width: 100,
        height: 140,
        top: 100,
        left: -30,
        opacity: 0.4,
    },
    bookDecor2: {
        width: 80,
        height: 110,
        bottom: 150,
        right: -20,
        opacity: 0.3,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#1A1A1A',
        letterSpacing: -0.5,
    },
    addButton: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        shadowColor: '#84cc16',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    listContent: {
        paddingBottom: 100,
    },
    bookCardContainer: {
        marginBottom: 16,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 8,
    },
    bookCardOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
    },
    bookCard: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    bookCover: {
        width: 80,
        height: 120,
        borderRadius: 12,
        backgroundColor: '#E8E8E8',
    },
    bookInfo: {
        flex: 1,
        marginLeft: 16,
        justifyContent: 'center',
    },
    bookTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 6,
        letterSpacing: -0.3,
    },
    bookAuthor: {
        fontSize: 14,
        fontWeight: '500',
        color: '#666666',
        marginBottom: 12,
    },
    tagContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    tag: {
        backgroundColor: 'rgba(145, 197, 94, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(145, 197, 94, 0.3)',
    },
    tagText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#84cc16',
        textTransform: 'capitalize',
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 100,
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptySubtitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1A1A1A',
        marginBottom: 12,
    },
    emptyText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#666666',
        textAlign: 'center',
        lineHeight: 22,
    },
});
