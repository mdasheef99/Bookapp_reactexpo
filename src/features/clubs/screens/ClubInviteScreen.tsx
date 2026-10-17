import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { navigateBackOrFallback } from '@/lib/navigation';
import { clubHomeHref } from '@/features/clubs/navigation';
import { useClubInvitations, useClubMembership, useClubPublicDetail, useCreateClubInvitation } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';

const colors = {
    bgPrimary: '#FAF6EE', bgCard: '#FFFEFC', bgSecondary: '#F8EBE7',
    border: '#E7DCD1', accent: '#8B322C', textPrimary: '#1A1412',
    textSecondary: '#6E645F', textTertiary: '#746860',
} as const;

export default function ClubInviteScreen() {
    const { clubId, clubOrigin } = useLocalSearchParams<{ clubId: string; clubOrigin?: string }>();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const { data: club, isLoading, isError, refetch } = useClubPublicDetail(clubId ?? null);
    const { data: membership, isLoading: isMembershipLoading } = useClubMembership(clubId ?? null, userId);
    const isManager = !!userId && !!club && (club.admin_id === userId || membership?.role === 'admin' || membership?.role === 'moderator');
    const { data: invitations = [], isLoading: isInvitationsLoading, isError: isInvitationsError, error: invitationsError, refetch: refetchInvitations } = useClubInvitations(clubId ?? null, !!club && club.club_type === 'invite_only' && isManager);
    const createInvitation = useCreateClubInvitation();
    const [username, setUsername] = useState('');
    const [note, setNote] = useState('');
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const handleCreateInvitation = async () => {
        if (!clubId || !username.trim()) return;
        try {
            setFeedback(null);
            await createInvitation.mutateAsync({ clubId, inviteeUsername: username, note });
            setUsername('');
            setNote('');
            setFeedback({ type: 'success', message: 'Invitation sent.' });
            await refetchInvitations();
        } catch (error) {
            setFeedback({ type: 'error', message: getClubsEntitlementErrorMessage(error, 'Unable to send this invitation right now.') });
        }
    };

    if (isLoading || isMembershipLoading) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary }]}><ActivityIndicator size="large" color={colors.accent} /></View>;
    if (isError || !club) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Unable to load invitations</Text><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => refetch()}><Text style={styles.primaryButtonText}>Retry</Text></TouchableOpacity></View>;
    if (club.club_type !== 'invite_only') return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>This club does not use invitations</Text><TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => navigateBackOrFallback(router, clubHomeHref(clubId, clubOrigin))}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity></View>;
    if (!isManager) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Moderator access required</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Only eligible moderators and admins can send invite-only club invitations.</Text><TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => navigateBackOrFallback(router, clubHomeHref(clubId, clubOrigin))}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity></View>;
    if (isInvitationsError) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Unable to load invitations</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(invitationsError, 'Unable to load club invitations right now.')}</Text><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => refetchInvitations()}><Text style={styles.primaryButtonText}>Retry</Text></TouchableOpacity></View>;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
            <View style={styles.headerRow}>
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to club" onPress={() => navigateBackOrFallback(router, clubHomeHref(clubId, clubOrigin))} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]} testID="invite-readers-back">
                    <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text accessibilityRole="header" style={[styles.headerTitle, { color: colors.textPrimary }]}>Invite readers</Text>
            </View>
            <View style={styles.clubContext}>
                <View style={styles.clubIcon}><Ionicons name="mail-outline" size={22} color={colors.accent} /></View>
                <View style={styles.clubContextText}>
                    <Text style={[styles.clubName, { color: colors.textPrimary }]}>{club.name}</Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>Invite a reader by username and add a personal welcome.</Text>
                </View>
            </View>
            {feedback ? <View accessibilityRole="alert" style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#EAF3EB' : '#FCEDEA', borderColor: feedback.type === 'success' ? '#BED4C0' : '#E7B6AF' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#24623B' : '#A12D28' }]}>{feedback.message}</Text></View> : null}
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>Send a new invitation</Text>
                <Text style={styles.label}>Username <Text style={styles.fieldHint}>· Required</Text></Text>
                <TextInput accessibilityLabel="Username to invite, required" value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} testID="invite-username-input" />
                <Text style={styles.label}>Note <Text style={styles.fieldHint}>· Optional</Text></Text>
                <TextInput accessibilityLabel="Invitation note, optional" value={note} onChangeText={setNote} placeholder="A few words to welcome them" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]} testID="invite-note-input" />
                <TouchableOpacity accessibilityRole="button" style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: createInvitation.isPending ? 0.7 : 1 }]} onPress={handleCreateInvitation} disabled={createInvitation.isPending} testID="send-invitation-button"><Ionicons name="paper-plane-outline" size={17} color="#FFFFFF" /><Text style={styles.primaryButtonText}>{createInvitation.isPending ? 'Sending…' : 'Send invitation'}</Text></TouchableOpacity>
            </View>
            <Text accessibilityRole="header" style={styles.historyHeading}>Invitation history</Text>
            <Text style={styles.historyHelper}>Pending invitations can be revoked from Manage Club.</Text>
            {isInvitationsLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading invitations…</Text></View> : null}
            {!isInvitationsLoading && invitations.length === 0 ? <View style={styles.emptyCard}><Ionicons name="mail-open-outline" size={22} color={colors.accent} /><Text style={styles.emptyTitle}>No invitations sent yet.</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Your invitations will appear here.</Text></View> : null}
            {invitations.map((invitation) => (
                <View key={invitation.id} style={[styles.historyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                    <View style={styles.historyTopRow}>
                        <View style={styles.readerText}>
                            <Text style={styles.readerName}>{invitation.inviteeProfile?.display_name || invitation.invitee_user_id}</Text>
                            <Text style={[styles.meta, { color: colors.textSecondary }]}>@{invitation.inviteeProfile?.username || 'unknown'}</Text>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: invitation.status === 'pending' ? colors.bgSecondary : invitation.status === 'accepted' ? '#EAF3EB' : '#F1EDE7' }]}>
                            <Text style={[styles.statusText, { color: invitation.status === 'pending' ? colors.accent : invitation.status === 'accepted' ? '#24623B' : colors.textSecondary }]}>{invitation.status}</Text>
                        </View>
                    </View>
                    {invitation.note ? <Text style={[styles.historyNote, { color: colors.textSecondary }]}>{invitation.note}</Text> : null}
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    contentContainer: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 32 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 20 },
    iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { flex: 1, fontFamily: 'Newsreader_600SemiBold', fontSize: 28, lineHeight: 34 },
    clubContext: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    clubIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.bgSecondary, alignItems: 'center', justifyContent: 'center' },
    clubContextText: { flex: 1 },
    clubName: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, lineHeight: 28, marginBottom: 3 },
    card: { borderWidth: 1, borderRadius: 16, padding: 18, marginBottom: 22 },
    title: { fontFamily: 'Newsreader_600SemiBold', fontSize: 21, lineHeight: 27, marginBottom: 10 },
    meta: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
    body: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    label: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.textPrimary, marginBottom: 7 },
    fieldHint: { fontFamily: 'Inter_400Regular', color: colors.textSecondary, fontSize: 12 },
    input: { minHeight: 46, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, marginBottom: 16 },
    primaryButton: { minHeight: 48, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
    primaryButtonText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    secondaryButton: { minHeight: 44, borderWidth: 1, borderRadius: 22, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
    secondaryButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 20 },
    feedbackBanner: { marginBottom: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
    feedbackText: { fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
    historyHeading: { fontFamily: 'Newsreader_600SemiBold', fontSize: 22, lineHeight: 28, color: colors.textPrimary, marginBottom: 4 },
    historyHelper: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, color: colors.textSecondary, marginBottom: 14 },
    emptyCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 20, alignItems: 'center', gap: 6, backgroundColor: colors.bgCard },
    emptyTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 21, color: colors.textPrimary, marginTop: 4 },
    historyCard: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
    historyTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    readerText: { flex: 1, minWidth: 0 },
    readerName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, lineHeight: 22, color: colors.textPrimary, marginBottom: 2 },
    statusPill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
    statusText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 16, textTransform: 'capitalize' },
    historyNote: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 10, paddingTop: 10 },
});
