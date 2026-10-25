import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useOrganising } from '@/features/books/organising/useOrganising';
import { OrganisingEntity, ORGANISING_LIMIT } from '@/features/books/organising/organisingGateway';
import { OrganisingSheet } from '@/components/library/organising/OrganisingSheet';
import { OrganisingBackground } from '@/components/library/organising/OrganisingBackground';
import { NoteScreen, ScrollView } from '@/components/notes/ManualNoteUi';
import { BookButton } from '@/components/library/ui';
import { LIBRARY_SPACING, useLibraryAppearance } from '@/components/library/LibraryAppearance';
import { LIBRARY_TEXT } from '@/components/library/LibraryTypography';

function CollectionListRow({ group, count, offline, onOpen, onManage }: { group: OrganisingEntity; count?: number; offline: boolean; onOpen: () => void; onManage: (step: 'rename' | 'delete', ref: React.RefObject<View | null>) => void }) {
  const colors = useLibraryAppearance(), rename = useRef<View>(null), remove = useRef<View>(null);
  return <View style={[styles.group, { borderColor: colors.divider }]}>
    <BookButton label={group.name} accessibilityLabel={`Open collection ${group.name}`} variant="text" onPress={onOpen} />
    <Text style={[LIBRARY_TEXT.caption, { color: colors.textSecondary }]}>{count === undefined ? 'Loading notes…' : `${count} ${count === 1 ? 'note' : 'notes'}`}</Text>
    <View style={styles.actions}>
      <BookButton ref={rename} label="Rename" accessibilityLabel={`Rename ${group.name}`} variant="text" disabled={offline} onPress={() => onManage('rename', rename)} />
      <BookButton ref={remove} label="Delete" accessibilityLabel={`Delete ${group.name}`} variant="text" disabled={offline} onPress={() => onManage('delete', remove)} />
    </View>
  </View>;
}

export default function CollectionsScreen() {
  const { user } = useAuth(), actor = user?.id ?? '', api = useOrganising(actor, 'collections');
  const router = useRouter(), colors = useLibraryAppearance(), opener = useRef<View>(null);
  const [sheet, setSheet] = useState<{ step: 'new' | 'rename' | 'delete'; original?: OrganisingEntity; opener?: React.RefObject<View | null> }>();
  useEffect(() => { setSheet(undefined); }, [actor]);
  const groups = [...(api.entities.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
  const ready = api.entities.data !== undefined;
  return <>
    <OrganisingBackground hidden={!!sheet}><NoteScreen title="Collections" backLabel="Back to Library" onBack={() => router.replace('/(tabs)/library')}>
      <ScrollView contentContainerStyle={styles.content}>
        {api.isOffline && <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>You&apos;re offline.</Text>}
        {!ready && !api.entities.isError && !api.members.isError && <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>Loading collections…</Text>}
        {(api.entities.isError || api.members.isError) && <><Text accessibilityRole="alert" style={[LIBRARY_TEXT.body, { color: colors.error }]}>Couldn&apos;t refresh collections.</Text><BookButton label="Try again" variant="text" onPress={api.refresh} /></>}
        {ready && !groups.length && <Text style={[LIBRARY_TEXT.body, { color: colors.textPrimary }]}>No collections yet.</Text>}
        <BookButton ref={opener} label="New collection" variant="primary" disabled={!ready || api.isOffline || groups.length >= ORGANISING_LIMIT} onPress={() => setSheet({ step: 'new' })} />
        {groups.length >= ORGANISING_LIMIT && <Text style={[LIBRARY_TEXT.body, { color: colors.textSecondary }]}>You have 25 collections. Delete one to create another.</Text>}
        {groups.map(group => <CollectionListRow key={group.id} group={group} count={api.members.data?.filter(row => row.entity_id === group.id).length} offline={api.isOffline}
          onOpen={() => router.push({ pathname: '/(tabs)/library/collection', params: { collectionId: group.id } })}
          onManage={(step, ref) => setSheet({ step, original: group, opener: ref })} />)}
      </ScrollView>
    </NoteScreen></OrganisingBackground>
    {sheet && <OrganisingSheet key={actor} actor={actor} kind="collections" mode="manage" initialStep={sheet.step} original={sheet.original} returnFocusRef={sheet.opener ?? opener} fallbackFocusRef={opener} onClose={() => setSheet(undefined)} />}
  </>;
}
const styles = StyleSheet.create({ content: { gap: LIBRARY_SPACING.md, padding: LIBRARY_SPACING.lg }, group: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: LIBRARY_SPACING.sm }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: LIBRARY_SPACING.sm } });
