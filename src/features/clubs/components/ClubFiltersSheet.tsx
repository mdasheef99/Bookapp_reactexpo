import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radii, touchTarget, typography } from '../theme';
import type { AccessLevel, ClubType, MeetingType } from '../services/clubsService';

const CLUB_TYPE_OPTIONS: Array<{ label: string; value: ClubType | undefined }> = [
    { label: 'All', value: undefined },
    { label: 'Public', value: 'public' },
    { label: 'Approval', value: 'approval' },
    { label: 'Invite only', value: 'invite_only' },
    { label: 'Author clubs', value: 'author_club' },
];

const MEETING_TYPE_OPTIONS: Array<{ label: string; value: MeetingType | undefined }> = [
    { label: 'Any', value: undefined },
    { label: 'Online', value: 'online_only' },
    { label: 'Venue', value: 'venue_based' },
    { label: 'Hybrid', value: 'hybrid' },
];

const ACCESS_LEVEL_OPTIONS: Array<{ label: string; value: AccessLevel | undefined }> = [
    { label: 'All access', value: undefined },
    { label: 'All members', value: 'all' },
    { label: 'Pro', value: 'pro' },
    { label: 'Pro+', value: 'pro_plus' },
];

interface ClubFiltersSheetProps {
    visible: boolean;
    onClose: () => void;
    clubType: ClubType | undefined;
    meetingType: MeetingType | undefined;
    accessLevel: AccessLevel | undefined;
    onSelectClubType: (value: ClubType | undefined) => void;
    onSelectMeetingType: (value: MeetingType | undefined) => void;
    onSelectAccessLevel: (value: AccessLevel | undefined) => void;
    onReset: () => void;
}

export function ClubFiltersSheet({
    visible,
    onClose,
    clubType,
    meetingType,
    accessLevel,
    onSelectClubType,
    onSelectMeetingType,
    onSelectAccessLevel,
    onReset,
}: ClubFiltersSheetProps) {
    const activeCount = [clubType, meetingType, accessLevel].filter((value) => value !== undefined).length;

    const renderOption = <T extends string | undefined>({
        label,
        value,
        selectedValue,
        onSelect,
        testID,
    }: {
        label: string;
        value: T;
        selectedValue: T;
        onSelect: (value: T) => void;
        testID: string;
    }) => {
        const selected = value === selectedValue;
        return (
            <TouchableOpacity
                key={label}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onSelect(value)}
                style={[
                    styles.option,
                    {
                        backgroundColor: selected ? colors.accent : colors.surface,
                        borderColor: selected ? colors.accent : colors.border,
                    },
                ]}
                testID={testID}
            >
                <Text style={[styles.optionText, { color: selected ? '#FFFFFF' : colors.textPrimary }]}>{label}</Text>
            </TouchableOpacity>
        );
    };

    const renderSection = <T extends string | undefined>({
        title,
        options,
        selectedValue,
        onSelect,
        testPrefix,
    }: {
        title: string;
        options: Array<{ label: string; value: T }>;
        selectedValue: T;
        onSelect: (value: T) => void;
        testPrefix: string;
    }) => (
        <View style={styles.section}>
            <Text style={typography.kicker}>{title}</Text>
            <View style={styles.optionGroup}>
                {options.map(({ label, value }) => renderOption({
                    label,
                    value,
                    selectedValue,
                    onSelect,
                    testID: `${testPrefix}-${value ?? 'all'}`,
                }))}
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
                    <View style={styles.handle} />
                    <View style={styles.header}>
                        <View style={styles.headerTitleRow}>
                            <Text style={styles.sheetTitle}>Filters</Text>
                            {activeCount > 0 ? (
                                <View style={styles.activeBadge} testID="clubs-filters-sheet-count">
                                    <Text style={styles.activeBadgeText}>{activeCount}</Text>
                                </View>
                            ) : null}
                        </View>
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={onReset}
                            hitSlop={12}
                            testID="clubs-filters-reset"
                        >
                            <Text style={styles.resetText}>Reset</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                        {renderSection({
                            title: 'Club type',
                            options: CLUB_TYPE_OPTIONS,
                            selectedValue: clubType,
                            onSelect: onSelectClubType,
                            testPrefix: 'clubs-filter-type',
                        })}
                        {renderSection({
                            title: 'Meeting format',
                            options: MEETING_TYPE_OPTIONS,
                            selectedValue: meetingType,
                            onSelect: onSelectMeetingType,
                            testPrefix: 'clubs-filter-meeting',
                        })}
                        {renderSection({
                            title: 'Access',
                            options: ACCESS_LEVEL_OPTIONS,
                            selectedValue: accessLevel,
                            onSelect: onSelectAccessLevel,
                            testPrefix: 'clubs-filter-access',
                        })}
                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={onClose}
                            style={styles.applyButton}
                            testID="clubs-filters-apply"
                        >
                            <Text style={styles.applyButtonText}>Show clubs</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(17, 20, 24, 0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        backgroundColor: colors.bg,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: colors.border,
        maxHeight: '85%',
        paddingTop: 8,
    },
    handle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        marginBottom: 4,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.divider,
    },
    headerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sheetTitle: {
        fontFamily: 'Inter_600SemiBold',
        fontSize: 18,
        lineHeight: 24,
        color: colors.textPrimary,
    },
    activeBadge: {
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        paddingHorizontal: 6,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeBadgeText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Inter_600SemiBold',
    },
    resetText: {
        color: colors.accent,
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 8,
    },
    section: {
        marginBottom: 20,
    },
    optionGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 12,
    },
    option: {
        minHeight: touchTarget,
        justifyContent: 'center',
        borderWidth: 1,
        borderRadius: radii.large,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    optionText: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    footer: {
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 24,
    },
    applyButton: {
        minHeight: 52,
        borderRadius: radii.large,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
    },
    applyButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
    },
});
