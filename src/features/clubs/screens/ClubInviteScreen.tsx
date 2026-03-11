import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useClubInvitations, useClubMembership, useClubPublicDetail, useCreateClubInvitation } from '@/features/clubs/hooks/useClubs';
import { getClubsEntitlementErrorMessage } from '@/features/clubs/services/clubsEntitlement';

export default function ClubInviteScreen() {
    const { clubId } = useLocalSearchParams<{ clubId: string }>();
    const { colors } = useTheme();
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
    if (club.club_type !== 'invite_only') return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>This club does not use invitations</Text><TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => router.back()}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity></View>;
    if (!isManager) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Moderator access required</Text><Text style={[styles.body, { color: colors.textSecondary }]}>Only eligible moderators and admins can send invite-only club invitations.</Text><TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => router.back()}><Text style={[styles.secondaryButtonText, { color: colors.textPrimary }]}>Go back</Text></TouchableOpacity></View>;
    if (isInvitationsError) return <View style={[styles.loadingContainer, { backgroundColor: colors.bgPrimary, paddingHorizontal: 24 }]}><Text style={[styles.title, { color: colors.textPrimary }]}>Unable to load invitations</Text><Text style={[styles.body, { color: colors.textSecondary }]}>{getClubsEntitlementErrorMessage(invitationsError, 'Unable to load club invitations right now.')}</Text><TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => refetchInvitations()}><Text style={styles.primaryButtonText}>Retry</Text></TouchableOpacity></View>;

    return (
        <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={styles.contentContainer}>
            <View style={styles.headerRow}><TouchableOpacity onPress={() => router.back()} style={[styles.iconButton, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Ionicons name="arrow-back" size={20} color={colors.textPrimary} /></TouchableOpacity><Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>Invite readers</Text><View style={styles.headerSpacer} /></View>
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.textPrimary }]}>{club.name}</Text><Text style={[styles.body, { color: colors.textSecondary }]}>This screen supports username-based invitation creation and invitation history. Revoke, resend, and read-state flows still depend on backend workflows that are not exposed live yet.</Text></View>
            {feedback ? <View style={[styles.feedbackBanner, { backgroundColor: feedback.type === 'success' ? '#DCFCE7' : '#FEE2E2', borderColor: feedback.type === 'success' ? '#22C55E' : '#EF4444' }]}><Text style={[styles.feedbackText, { color: feedback.type === 'success' ? '#166534' : '#991B1B' }]}>{feedback.message}</Text></View> : null}
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Send a new invitation</Text>
                <TextInput value={username} onChangeText={setUsername} placeholder="Username" autoCapitalize="none" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="invite-username-input" />
                <TextInput value={note} onChangeText={setNote} placeholder="Optional note" placeholderTextColor={colors.textTertiary} style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgPrimary }]} testID="invite-note-input" />
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: createInvitation.isPending ? 0.7 : 1 }]} onPress={handleCreateInvitation} disabled={createInvitation.isPending} testID="send-invitation-button"><Text style={styles.primaryButtonText}>{createInvitation.isPending ? 'Sending…' : 'Send invitation'}</Text></TouchableOpacity>
            </View>
            {isInvitationsLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={colors.accent} /><Text style={[styles.body, { color: colors.textSecondary }]}>Loading invitations…</Text></View> : null}
            {invitations.map((invitation) => <View key={invitation.id} style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}><Text style={[styles.title, { color: colors.textPrimary }]}>{invitation.inviteeProfile?.display_name || invitation.invitee_user_id}</Text><Text style={[styles.meta, { color: colors.textSecondary }]}>@{invitation.inviteeProfile?.username || 'unknown'} • {invitation.status}</Text>{invitation.note ? <Text style={[styles.body, { color: colors.textSecondary }]}>{invitation.note}</Text> : null}</View>)}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 }, contentContainer: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 48 }, loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }, loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }, headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 }, iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }, headerTitle: { flex: 1, marginHorizontal: 12, fontSize: 18, fontWeight: '700' }, headerSpacer: { width: 40 }, card: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 14 }, title: { fontSize: 18, fontWeight: '800', marginBottom: 6 }, meta: { fontSize: 13, fontWeight: '500', marginBottom: 8 }, body: { fontSize: 14, lineHeight: 20 }, input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, marginBottom: 12 }, primaryButton: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' }, primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }, secondaryButton: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' }, secondaryButtonText: { fontSize: 15, fontWeight: '800' }, feedbackBanner: { marginBottom: 14, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }, feedbackText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});