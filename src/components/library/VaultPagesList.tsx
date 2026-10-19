import React, { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LIBRARY_SPACING, useLibraryAppearance } from './LibraryAppearance';
import { LIBRARY_TEXT } from './LibraryTypography';
import { BookButton, useBookFeedback } from './ui';
import { UserBookPage, userBookPagesService } from '@/features/books/services/userBookPagesService';

export interface VaultPagesListProps {
  userBookId: string;
  disabled?: boolean;
}

export function useVaultPages(userBookId: string) {
  return useQuery({
    queryKey: ['vault-pages', userBookId],
    queryFn: () => userBookPagesService.getPagesForBook(userBookId),
    enabled: !!userBookId,
  });
}

export function VaultPagesList({ userBookId, disabled = false }: VaultPagesListProps) {
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const { notify, confirm } = useBookFeedback();
  const colors = useLibraryAppearance();
  const queryClient = useQueryClient();

  const { data: pages, isError, refetch } = useVaultPages(userBookId);

  const deleteMutation = useMutation({
    mutationFn: (pageId: string) => userBookPagesService.deletePage(pageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vault-pages', userBookId] }),
    onError: (e: any) => notify({ kind: 'error', message: e.message || 'Failed to delete page' }),
  });

  const handleDelete = useCallback(
    async (page: UserBookPage) => {
      const ok = await confirm({
        title: `Delete page ${page.page_number}?`,
        message: 'This will remove the saved page from your vault.',
        keep: 'Cancel',
        confirm: 'Delete',
        destructive: true,
      });
      if (!ok || disabledRef.current) return;
      deleteMutation.mutate(page.id);
    },
    [confirm, deleteMutation],
  );

  if (!pages || pages.length === 0) {
    return null;
  }

  return (
    <View style={styles.list}>
      {isError && (
        <View style={styles.refreshNotice}>
          <Text accessibilityLiveRegion="polite" style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>
            Couldn&apos;t refresh saved pages.
          </Text>
          <BookButton label="Try again" variant="text" onPress={() => { void refetch(); }} />
        </View>
      )}
      {pages.map((page) => (
        <View key={page.id} style={styles.page}>
          <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>
            {`Page ${page.page_number}`}
          </Text>
          <Text style={[LIBRARY_TEXT.bodySerif, { color: colors.textPrimary }]}>
            {page.content_excerpt.split('\n')[0]}
          </Text>
          <BookButton
            label={`Delete page ${page.page_number}`}
            variant="text"
            disabled={disabled || deleteMutation.isPending}
            onPress={() => { void handleDelete(page); }}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: LIBRARY_SPACING.md,
  },
  refreshNotice: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: LIBRARY_SPACING.sm,
  },
  page: {
    gap: LIBRARY_SPACING.xxs,
  },
});
