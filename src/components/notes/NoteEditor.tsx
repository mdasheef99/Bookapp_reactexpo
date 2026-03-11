import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    Modal,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Keyboard,
    ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/hooks/useTheme';
import { NoteTag, ReadingNote, NOTE_TAG_CONFIG } from '@/features/books/services/notesService';
import { TagSelector } from './TagSelector';

interface NoteEditorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (content: string, tag: NoteTag, pageNumber?: number) => Promise<void>;
    /** Pass a note to edit; null for creating a new note */
    editingNote?: ReadingNote | null;
    bookTitle?: string;
}

export const NoteEditor = ({ visible, onClose, onSave, editingNote, bookTitle }: NoteEditorProps) => {
    const { colors, phase } = useTheme();
    const contentRef = useRef<TextInput>(null);

    const [content, setContent] = useState('');
    const [tag, setTag] = useState<NoteTag>('reflect');
    const [pageNumber, setPageNumber] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Pre-fill when editing
    useEffect(() => {
        if (editingNote) {
            setContent(editingNote.content);
            setTag(editingNote.tag);
            setPageNumber(editingNote.page_number?.toString() || '');
        } else {
            setContent('');
            setTag('reflect');
            setPageNumber('');
        }
    }, [editingNote, visible]);

    // Auto-focus the text input when modal opens
    useEffect(() => {
        if (visible) {
            setTimeout(() => contentRef.current?.focus(), 300);
        }
    }, [visible]);

    const handleSave = async () => {
        const trimmed = content.trim();
        if (!trimmed) return;

        setIsSaving(true);
        try {
            const page = pageNumber ? parseInt(pageNumber, 10) : undefined;
            await onSave(trimmed, tag, page);
            setContent('');
            setTag('reflect');
            setPageNumber('');
            onClose();
        } catch (err: any) {
            console.error('Error saving note:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const tagConfig = NOTE_TAG_CONFIG[tag];
    const isEditing = !!editingNote;
    const canSave = content.trim().length > 0 && !isSaving;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />

                <View style={[styles.sheet, { backgroundColor: colors.bgPrimary }]}>
                    {/* Handle bar */}
                    <View style={styles.handleBar}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            {isEditing ? 'Edit Note' : 'New Note'}
                        </Text>
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={!canSave}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            {isSaving ? (
                                <ActivityIndicator size="small" color={colors.accent} />
                            ) : (
                                <Text style={[
                                    styles.saveText,
                                    { color: canSave ? tagConfig.color : colors.textTertiary }
                                ]}>
                                    Save
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Book context */}
                    {bookTitle && (
                        <Text style={[styles.bookContext, { color: colors.textTertiary }]} numberOfLines={1}>
                            📖 {bookTitle}
                        </Text>
                    )}

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Tag Selector */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                                Tag
                            </Text>
                            <TagSelector selected={tag} onChange={setTag} />
                            <Text style={[styles.tagDescription, { color: colors.textTertiary }]}>
                                {tagConfig.description}
                            </Text>
                        </View>

                        {/* Content Input */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                                {tag === 'quote' ? 'Passage' : 'Your thoughts'}
                            </Text>
                            <TextInput
                                ref={contentRef}
                                style={[
                                    styles.contentInput,
                                    {
                                        backgroundColor: colors.bgSecondary,
                                        color: colors.textPrimary,
                                        borderColor: colors.border,
                                    },
                                    tag === 'quote' && {
                                        fontStyle: 'italic',
                                        borderLeftWidth: 3,
                                        borderLeftColor: tagConfig.color,
                                    },
                                ]}
                                placeholder={
                                    tag === 'quote'
                                        ? 'Type or paste the passage...'
                                        : tag === 'reflect'
                                            ? "What are you thinking about?"
                                            : tag === 'distill'
                                                ? 'What\'s the core idea?'
                                                : 'What will you do with this?'
                                }
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                textAlignVertical="top"
                                value={content}
                                onChangeText={setContent}
                                autoFocus={false}
                            />
                        </View>

                        {/* Page Number (Optional) */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                                Page number (optional)
                            </Text>
                            <TextInput
                                style={[
                                    styles.pageInput,
                                    {
                                        backgroundColor: colors.bgSecondary,
                                        color: colors.textPrimary,
                                        borderColor: colors.border,
                                    },
                                ]}
                                placeholder="e.g. 42"
                                placeholderTextColor={colors.textTertiary}
                                keyboardType="number-pad"
                                value={pageNumber}
                                onChangeText={setPageNumber}
                                maxLength={5}
                            />
                        </View>
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 10,
    },
    handleBar: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '500',
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
    },
    saveText: {
        fontSize: 15,
        fontWeight: '700',
    },
    bookContext: {
        fontSize: 13,
        marginBottom: 16,
    },
    section: {
        marginBottom: 20,
    },
    sectionLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tagDescription: {
        fontSize: 12,
        marginTop: 4,
        fontStyle: 'italic',
    },
    contentInput: {
        borderRadius: 16,
        padding: 14,
        minHeight: 140,
        borderWidth: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    pageInput: {
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        fontSize: 15,
        width: 100,
    },
});
