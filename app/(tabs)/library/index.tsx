import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { booksService } from '@/features/books/services/booksService';
import { useTheme } from '@/hooks/useTheme';
import { GlassCard } from '@/components/ui/GlassCard';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { Button } from '@/components/ui/Button';

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

                <ActivityIndicator size="large" color={colors.accent} />
            </View>
        );
    }

    return (
        <ScreenBackground>
            {/* Content */}
            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>My Library</Text>
                    <Button
                        title="+ Add Book"
                        onPress={() => router.push('/(tabs)/library/search')}
                        variant="primary"
                        size="sm"
                        accessibilityLabel="Add a new book to your library"
                    />
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
                            <GlassCard style={{ marginBottom: 16 }} padding={16} borderRadius={20}>
                                <View style={{ flexDirection: 'row' }}>
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
                            </GlassCard>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="library" size={64} color={colors.textTertiary} style={{ marginBottom: 16 }} accessibilityLabel="Empty library" />
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
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({

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

    listContent: {
        paddingBottom: 100,
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
