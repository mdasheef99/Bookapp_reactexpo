import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubInvitation } from '@/features/clubs/services/clubsService';
import type { FeedbackState } from './manageUtils';

interface Props {
    invitations: ClubInvitation[];
    isLoading: boolean;
    isCreating: boolean;
    onCreate: (username: string) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

export function ClubManageInvitationsSection({ invitations, isLoading, isCreating, onCreate, onFeedback }: Props) {
    const { colors } = useTheme();
    const [username, setUsername] = useState('');

    const handleCreate = async () => {
        const trimmed = username.trim();
        if (!trimmed) return;
        try {
            onFeedback(null);
            await onCreate(trimmed);
            setUsername('');
            onFeedback({ type: 'success', message: 'Invitation sent.' });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to send invitation right now.' });
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.accent} />
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Invitations</Text>

            <View style={styles.row}>
                <TextInput
                    testID="manage-invite-username-input"
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Username to invite..."
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
                    autoCapitalize="none"
                    autoCorrect={false}
                />
                <TouchableOpacity
                    onPress={handleCreate}
                    disabled={!username.trim() || isCreating}
                    style={[styles.createButton, { backgroundColor: colors.accent, opacity: !username.trim() || isCreating ? 0.5 : 1 }]}>
                    <Text style={styles.createButtonText}>{isCreating ? 'Sending…' : 'Invite'}</Text>
                </TouchableOpacity>
            </View>

            {invitations.length === 0 ? (
                <Text style={[styles.placeholder, { color: colors.textSecondary }]}>No invitations sent yet.</Text>
            ) : (
                invitations.map((inv) => (
                    <View key={inv.id} style={[styles.invRow, { borderBottomColor: colors.border }]}>
                        <View style={styles.invInfo}>
                            <Text style={[styles.invName, { color: colors.textPrimary }]}>
                                {inv.invitee_profile?.display_name || inv.invitee_username || 'Unknown'}
                            </Text>
                            <Text style={[styles.invMeta, { color: colors.textSecondary }]}>
                                {inv.status} · {new Date(inv.created_at).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                ))
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    card: {
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
        alignItems: 'center',
    },
    textInput: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
    },
    createButton: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 8,
    },
    createButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    placeholder: {
        fontSize: 14,
        fontStyle: 'italic',
        paddingVertical: 6,
    },
    invRow: {
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    invInfo: {
        flex: 1,
    },
    invName: {
        fontSize: 15,
        fontWeight: '600',
    },
    invMeta: {
        fontSize: 12,
        marginTop: 2,
    },
});
