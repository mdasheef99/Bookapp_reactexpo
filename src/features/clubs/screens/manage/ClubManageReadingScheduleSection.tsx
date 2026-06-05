import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubReadingSchedule, ClubReadingScheduleMilestone } from '@/features/clubs/services/clubsService';
import type { FeedbackState } from './manageUtils';

interface Props {
    bookId: string | null;
    schedule: ClubReadingSchedule | null | undefined;
    isLoading: boolean;
    isSaving: boolean;
    onSave: (milestones: ClubReadingScheduleMilestone[]) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

function createEmptyMilestone(index: number): ClubReadingScheduleMilestone {
    return {
        id: `milestone-${Date.now()}-${index}`,
        label: '',
        target: '',
        dueDate: null,
    };
}

const SCHEDULE_TEMPLATES: Array<{ label: string; milestones: Array<Omit<ClubReadingScheduleMilestone, 'id' | 'dueDate'>> }> = [
    {
        label: '3 parts',
        milestones: [
            { label: 'Part 1', target: 'Opening chapters' },
            { label: 'Part 2', target: 'Middle chapters' },
            { label: 'Part 3', target: 'Final chapters' },
        ],
    },
    {
        label: '4 weeks',
        milestones: [
            { label: 'Week 1', target: 'First quarter' },
            { label: 'Week 2', target: 'Second quarter' },
            { label: 'Week 3', target: 'Third quarter' },
            { label: 'Week 4', target: 'Finish the book' },
        ],
    },
];

function isValidDueDate(value: string | null) {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function hasChronologicalDueDates(milestones: ClubReadingScheduleMilestone[]) {
    let previousDueDate: string | null = null;
    for (const milestone of milestones) {
        if (!milestone.dueDate) continue;
        if (previousDueDate && milestone.dueDate < previousDueDate) return false;
        previousDueDate = milestone.dueDate;
    }
    return true;
}

function extractChapterStart(target: string) {
    const match = target.match(/\bchapters?\s+(\d+)/i);
    return match ? Number(match[1]) : null;
}

function hasChronologicalChapterTargets(milestones: ClubReadingScheduleMilestone[]) {
    let previousChapter: number | null = null;
    for (const milestone of milestones) {
        const chapter = extractChapterStart(milestone.target);
        if (chapter === null) continue;
        if (previousChapter !== null && chapter < previousChapter) return false;
        previousChapter = chapter;
    }
    return true;
}

export function ClubManageReadingScheduleSection({ bookId, schedule, isLoading, isSaving, onSave, onFeedback }: Props) {
    const { colors } = useTheme();
    const [draftMilestones, setDraftMilestones] = useState<ClubReadingScheduleMilestone[]>([createEmptyMilestone(1)]);

    useEffect(() => {
        if (schedule?.milestones?.length) {
            setDraftMilestones(schedule.milestones);
        } else {
            setDraftMilestones([createEmptyMilestone(1)]);
        }
    }, [schedule]);

    const updateMilestone = (id: string, updates: Partial<ClubReadingScheduleMilestone>) => {
        setDraftMilestones((current) => current.map((milestone) => milestone.id === id ? { ...milestone, ...updates } : milestone));
    };

    const removeMilestone = (id: string) => {
        setDraftMilestones((current) => current.length <= 1 ? current : current.filter((milestone) => milestone.id !== id));
    };

    const applyTemplate = (template: (typeof SCHEDULE_TEMPLATES)[number]) => {
        setDraftMilestones(template.milestones.map((milestone, index) => ({
            ...milestone,
            id: `template-${Date.now()}-${index + 1}`,
            dueDate: null,
        })));
    };

    const handleSave = async () => {
        const normalized = draftMilestones
            .map((milestone, index) => ({
                ...milestone,
                id: milestone.id || `milestone-${index + 1}`,
                label: milestone.label.trim(),
                target: milestone.target.trim(),
                dueDate: milestone.dueDate?.trim() || null,
            }))
            .filter((milestone) => milestone.label || milestone.target);

        if (!bookId) {
            onFeedback({ type: 'error', message: 'Set a current book before creating a reading schedule.' });
            return;
        }
        if (normalized.length === 0) {
            onFeedback({ type: 'error', message: 'Add at least one milestone with a label or target.' });
            return;
        }
        if (normalized.some((milestone) => !isValidDueDate(milestone.dueDate))) {
            onFeedback({ type: 'error', message: 'Due dates must use a valid YYYY-MM-DD format.' });
            return;
        }
        if (!hasChronologicalDueDates(normalized)) {
            onFeedback({ type: 'error', message: 'Due dates must stay in chronological order.' });
            return;
        }
        if (!hasChronologicalChapterTargets(normalized)) {
            onFeedback({ type: 'error', message: 'Chapter targets must stay in reading order.' });
            return;
        }

        try {
            onFeedback(null);
            await onSave(normalized);
            onFeedback({ type: 'success', message: 'Reading schedule saved.' });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to save the reading schedule right now.' });
        }
    };

    if (isLoading) {
        return <View style={styles.loadingContainer}><ActivityIndicator size="small" color={colors.accent} /></View>;
    }

    if (!bookId) {
        return (
            <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Reading schedule</Text>
                <Text style={[styles.body, { color: colors.textSecondary }]}>Set a current book first, then build the milestone timeline for members.</Text>
            </View>
        );
    }

    return (
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Reading schedule</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>Create milestones that members can follow on the reading progress screen.</Text>
            <Text style={[styles.guidanceText, { color: colors.textSecondary }]}>One active schedule is stored per current book; reminder delivery is deferred to the app-wide notification pipeline.</Text>

            <View style={styles.templateRow}>
                {SCHEDULE_TEMPLATES.map((template) => (
                    <TouchableOpacity
                        key={template.label}
                        onPress={() => applyTemplate(template)}
                        style={[styles.templateButton, { borderColor: colors.accent }]}
                        testID={`schedule-template-${template.label.replace(/\s+/g, '-').toLowerCase()}`}
                    >
                        <Text style={[styles.templateButtonText, { color: colors.accent }]}>{template.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {draftMilestones.map((milestone, index) => (
                <View key={milestone.id} style={[styles.milestoneCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <View style={styles.rowHeader}>
                        <Text style={[styles.milestoneTitle, { color: colors.textPrimary }]}>Milestone {index + 1}</Text>
                        {draftMilestones.length > 1 ? (
                            <TouchableOpacity onPress={() => removeMilestone(milestone.id)} testID={`schedule-remove-${milestone.id}`}>
                                <Text style={[styles.removeText, { color: colors.error }]}>Remove</Text>
                            </TouchableOpacity>
                        ) : null}
                    </View>
                    <TextInput
                        value={milestone.label}
                        onChangeText={(value) => updateMilestone(milestone.id, { label: value })}
                        placeholder="Label, e.g. Week 1"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
                        testID={`schedule-label-${index}`}
                    />
                    <TextInput
                        value={milestone.target}
                        onChangeText={(value) => updateMilestone(milestone.id, { target: value })}
                        placeholder="Target, e.g. Chapters 1-5"
                        placeholderTextColor={colors.textTertiary}
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
                        testID={`schedule-target-${index}`}
                    />
                    <TextInput
                        value={milestone.dueDate ?? ''}
                        onChangeText={(value) => updateMilestone(milestone.id, { dueDate: value || null })}
                        placeholder="Due date YYYY-MM-DD"
                        placeholderTextColor={colors.textTertiary}
                        autoCapitalize="none"
                        style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bgCard }]}
                        testID={`schedule-due-${index}`}
                    />
                </View>
            ))}

            <View style={styles.actionRow}>
                <TouchableOpacity
                    onPress={() => setDraftMilestones((current) => [...current, createEmptyMilestone(current.length + 1)])}
                    style={[styles.secondaryButton, { borderColor: colors.accent }]}
                    testID="schedule-add-milestone"
                >
                    <Text style={[styles.secondaryButtonText, { color: colors.accent }]}>Add milestone</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isSaving}
                    style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: isSaving ? 0.65 : 1 }]}
                    testID="schedule-save"
                >
                    <Text style={styles.primaryButtonText}>{isSaving ? 'Saving...' : 'Save schedule'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { paddingVertical: 20, alignItems: 'center' },
    card: { padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 14 },
    sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
    body: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
    guidanceText: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
    milestoneCard: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10 },
    rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    milestoneTitle: { fontSize: 14, fontWeight: '700' },
    removeText: { fontSize: 13, fontWeight: '700' },
    input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
    actionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    templateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
    templateButton: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
    templateButtonText: { fontSize: 13, fontWeight: '800' },
    secondaryButton: { flex: 1, minWidth: 130, borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    secondaryButtonText: { fontSize: 14, fontWeight: '800' },
    primaryButton: { flex: 1, minWidth: 130, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
    primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
