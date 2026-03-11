import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type ThemeColors } from '@/hooks/useTheme';
import type { ClubMemberWithProfile } from '../services/clubsService';

interface ClubMemberListProps {
    members: ClubMemberWithProfile[];
    colors: ThemeColors;
}

function formatRole(role: ClubMemberWithProfile['role']) {
    if (role === 'admin') return 'Admin';
    if (role === 'moderator') return 'Moderator';
    return 'Member';
}

export function ClubMemberList({ members, colors }: ClubMemberListProps) {
    return (
        <View style={styles.container}>
            {members.map((member) => {
                const initials = (member.profile?.display_name || 'Reader')
                    .split(' ')
                    .slice(0, 2)
                    .map((part) => part.charAt(0).toUpperCase())
                    .join('') || 'R';

                return (
                    <View key={member.id} style={[styles.row, { borderColor: colors.border, backgroundColor: colors.bgSecondary }]}> 
                        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                            <Text style={styles.avatarText}>{initials}</Text>
                        </View>

                        <View style={styles.body}>
                            <Text style={[styles.name, { color: colors.textPrimary }]}>{member.profile?.display_name || 'BookTalks Reader'}</Text>
                            <View style={styles.metaRow}>
                                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formatRole(member.role)}</Text>
                                {member.profile?.city ? <Text style={[styles.metaText, { color: colors.textTertiary }]}>{member.profile.city}</Text> : null}
                            </View>
                        </View>

                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                    </View>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 10, gap: 10 },
    row: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    body: {
        flex: 1,
    },
    name: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '500',
    },
});