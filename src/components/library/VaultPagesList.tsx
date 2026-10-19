import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useLibraryAppearance } from './LibraryAppearance';
import { useBookFeedback } from './ui';
import { userBookPagesService, UserBookPage } from '@/features/books/services/userBookPagesService';

interface VaultPagesListProps {
    userBookId: string;
    onEmpty?: () => void;
}

export function VaultPagesList({ userBookId }: VaultPagesListProps) {
    const { notify, confirm } = useBookFeedback();
    const colors = useLibraryAppearance();
    const queryClient = useQueryClient();

    const { data: pages, isLoading, isError, isFetching, refetch } = useQuery({
        queryKey: ['vault-pages', userBookId],
        queryFn: () => userBookPagesService.getPagesForBook(userBookId),
        enabled: !!userBookId,
    });

    const deleteMutation = useMutation({
        mutationFn: (pageId: string) => userBookPagesService.deletePage(pageId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault-pages', userBookId] }),
        onError: (e: any) => notify({ kind: 'error', message: e.message || 'Failed to delete page' }),
    });

    const handleDelete = useCallback(async (page: UserBookPage) => {
        const ok = await confirm({ title: `Delete page ${page.page_number}?`, message: 'This will remove the saved page from your vault.', keep: 'Cancel', confirm: 'Delete', destructive: true });
        if (ok) deleteMutation.mutate(page.id);
    }, [confirm, deleteMutation]);

    if (isLoading) {
        return <View style={styles.center}><ActivityIndicator size="small" color={colors.accent} /></View>;
    }

    const retry = <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry saved pages" disabled={isFetching}
        onPress={() => { void refetch(); }} style={styles.retryBtn}>
        <Text style={{ color: colors.accent }}>Retry saved pages</Text>
    </TouchableOpacity>;
    if (!pages) {
        return (
            <View style={styles.empty}><Text accessibilityRole="alert" style={[styles.emptyText, { color: colors.error }]}>Couldn't load saved pages.</Text>{retry}</View>
        );
    }

    return (
        <View>
            {isError && <View style={styles.empty}>
                <Text accessibilityRole="alert" style={[styles.emptyText, { color: colors.error }]}>Couldn't refresh saved pages. Previously loaded pages are still shown.</Text>{retry}
            </View>}
            {pages.length === 0 && <View style={styles.empty}>
                <Ionicons name="bookmark-outline" size={24} color={colors.textTertiary} />
                <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No saved pages yet.</Text>
            </View>}
            {pages.map((page) => (
                <View key={page.id} style={[styles.card, { backgroundColor: colors.bgSecondary, borderColor: colors.divider }]}>
                    <View style={styles.header}>
                        <Text style={[styles.pageNum, { color: colors.accent }]}>Page {page.page_number}</Text>
                        <Text style={[styles.meta, { color: colors.textTertiary }]}>{page.word_count} words • {new Date(page.updated_at).toLocaleDateString()}</Text>
                    </View>
                    <Text style={[styles.excerpt, { color: colors.textPrimary }]} numberOfLines={3}>{page.content_excerpt}</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete page ${page.page_number}`} disabled={deleteMutation.isPending} onPress={() => handleDelete(page)} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={14} color={colors.error} />
                        <Text style={[styles.deleteText, { color: colors.error }]}>{deleteMutation.isPending && deleteMutation.variables === page.id ? 'Deleting…' : 'Delete'}</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    center: { padding: 12, alignItems: 'center' },
    empty: { alignItems: 'center', gap: 6, paddingVertical: 16 },
    emptyText: { fontSize: 13, textAlign: 'center' },
    card: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
    header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    pageNum: { fontSize: 13, fontWeight: '700' },
    meta: { fontSize: 11 },
    excerpt: { fontSize: 14, lineHeight: 20 },
    deleteBtn: { minHeight: 48, minWidth: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-end' },
    retryBtn: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
    deleteText: { fontSize: 12, fontWeight: '600' },
});
