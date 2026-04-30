import { useState, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import type { ClubJoinQuestion } from '@/features/clubs/services/clubsService';
import type { FeedbackState } from './manageUtils';

interface Props {
    clubId: string;
    questions: ClubJoinQuestion[];
    isLoading: boolean;
    onCreate: (input: { question: string; isRequired: boolean; orderIndex: number }) => Promise<void>;
    onUpdate: (questionId: string, input: { question: string; isRequired: boolean }) => Promise<void>;
    onDelete: (questionId: string) => Promise<void>;
    onFeedback: (feedback: FeedbackState) => void;
}

export function ClubManageJoinQuestionsSection({ clubId, questions, isLoading, onCreate, onUpdate, onDelete, onFeedback }: Props) {
    const { colors } = useTheme();
    const [draftQuestion, setDraftQuestion] = useState('');
    const [draftRequired, setDraftRequired] = useState(true);
    const [edits, setEdits] = useState<Record<string, { question: string; isRequired: boolean }>>({});
    const [activeId, setActiveId] = useState<string | null>(null);

    const nextOrderIndex = useMemo(() => questions.reduce((max, q) => Math.max(max, q.order_index), -1) + 1, [questions]);

    const getEdit = (id: string, fallbackQ: string, fallbackR: boolean | null) => edits[id] ?? { question: fallbackQ, isRequired: fallbackR ?? true };

    const handleCreate = async () => {
        if (!clubId || !draftQuestion.trim()) return;
        try {
            onFeedback(null);
            await onCreate({ question: draftQuestion, isRequired: draftRequired, orderIndex: nextOrderIndex });
            setDraftQuestion('');
            setDraftRequired(true);
            onFeedback({ type: 'success', message: 'Join question added.' });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to add this question right now.' });
        }
    };

    const handleUpdate = async (questionId: string, question: string, isRequired: boolean) => {
        if (!clubId || !question.trim()) return;
        try {
            onFeedback(null);
            setActiveId(questionId);
            await onUpdate(questionId, { question, isRequired });
            onFeedback({ type: 'success', message: 'Join question updated.' });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to update this question right now.' });
        } finally {
            setActiveId(null);
        }
    };

    const handleDelete = async (questionId: string) => {
        if (!clubId) return;
        try {
            onFeedback(null);
            setActiveId(questionId);
            await onDelete(questionId);
            onFeedback({ type: 'success', message: 'Join question removed.' });
        } catch (error) {
            onFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Unable to remove this question right now.' });
        } finally {
            setActiveId(null);
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
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Join questions</Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>Add questions that prospective members will be asked when joining an approval-based club.</Text>

            <View style={[styles.row, { borderBottomColor: colors.border }]}>
                <TextInput
                    testID="new-question-input"
                    value={draftQuestion}
                    onChangeText={setDraftQuestion}
                    placeholder="New question..."
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
                />
                <TouchableOpacity
                    testID="create-question-button"
                    onPress={handleCreate}
                    disabled={!draftQuestion.trim() || activeId !== null}
                    style={[styles.createButton, { backgroundColor: colors.accent, opacity: !draftQuestion.trim() || activeId !== null ? 0.5 : 1 }]}>
                    <Text style={styles.createButtonText}>Add</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.toggleRow}>
                <Switch testID="toggle-new-required" value={draftRequired} onValueChange={setDraftRequired} />
                <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{draftRequired ? 'Required' : 'Optional'}</Text>
            </View>

            {questions.map((question) => {
                const edit = getEdit(question.id, question.question, question.is_required);
                return (
                    <View key={question.id} style={[styles.row, { borderBottomColor: colors.border }]}>
                        <TextInput
                            testID={`edit-question-${question.id}`}
                            value={edit.question}
                            onChangeText={(text) => setEdits((prev) => ({ ...prev, [question.id]: { ...prev[question.id], question: text } }))}
                            placeholder="Question..."
                            placeholderTextColor={colors.textTertiary}
                            style={[styles.textInput, { borderColor: colors.border, color: colors.textPrimary }]}
                        />
                        <View style={styles.actionRow}>
                            <Switch testID={`toggle-required-${question.id}`} value={edit.isRequired} onValueChange={(val) => setEdits((prev) => ({ ...prev, [question.id]: { ...prev[question.id], isRequired: val } }))} />
                            <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>{edit.isRequired ? 'Required' : 'Optional'}</Text>
                            <TouchableOpacity testID={`delete-question-${question.id}`} onPress={() => handleDelete(question.id)} disabled={activeId === question.id}>
                                <Text style={{ color: colors.error, fontWeight: '700' }}>Delete</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                testID={`save-question-${question.id}`}
                                onPress={() => handleUpdate(question.id, edit.question, edit.isRequired)}
                                disabled={activeId === question.id || !edit.question.trim()}>
                                <Text style={{ color: colors.accent, fontWeight: '700' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            })}
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
        marginBottom: 6,
    },
    sectionDesc: {
        fontSize: 13,
        marginBottom: 10,
    },
    row: {
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    textInput: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        marginBottom: 6,
    },
    createButton: {
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    createButtonText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    toggleLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 6,
    },
});
