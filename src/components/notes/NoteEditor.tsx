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
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useTheme } from '@/hooks/useTheme';
import { useQueryClient } from '@tanstack/react-query';
import { NoteTag, ReadingNote, NOTE_TAG_CONFIG } from '@/features/books/services/notesService';
import { TagSelector } from './TagSelector';
import { ocrService, OcrLanguageHint, OcrError, ocrErrorMessage, boundedReview, OCR_REVIEW_LIMIT } from '@/features/books/services/ocrService';
import { useAuthStore } from '@/features/auth/store/authStore';
import * as Crypto from 'expo-crypto';
import { userBookPagesService } from '@/features/books/services/userBookPagesService';
import { getWordCount, NOTE_WORD_LIMIT, capToVaultLimits } from '@/features/books/utils/ocrWordCap';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

interface NoteEditorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (content: string, tag: NoteTag | null, pageNumber?: number) => Promise<void>;
    /** Pass a note to edit; null for creating a new note */
    editingNote?: ReadingNote | null;
    bookTitle?: string;
    /** SDD-03: vault context — when provided shows Save to Vault + enables OCR page flow */
    userId?: string;
    userBookId?: string;
    /** Optional OCR prefill from parent (e.g. BookDetail scan button) */
    initialOcrText?: string;
}

export const NoteEditor = ({ visible, onClose, onSave, editingNote, bookTitle, userId, userBookId, initialOcrText }: NoteEditorProps) => {
    const { colors, phase } = useTheme();
    const queryClient = useQueryClient();
    const contentRef = useRef<TextInput>(null);

    const [content, setContent] = useState('');
    const [tag, setTag] = useState<NoteTag | null>('reflect');
    const [pageNumber, setPageNumber] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [isVaultSaving, setIsVaultSaving] = useState(false);
    const [reviewOverflow, setReviewOverflow] = useState(false);
    const [partialReviewAccepted, setPartialReviewAccepted] = useState(false);
    const reviewRevision = useRef(0);
    const setOverflow = (overflow: boolean) => {
        reviewRevision.current += 1;
        setReviewOverflow(overflow);
        setPartialReviewAccepted(false);
    };
    const incompleteReview = reviewOverflow && !partialReviewAccepted;
    const acceptPartialReview = () => {
        const revision = reviewRevision.current;
        Alert.alert('Use incomplete OCR text?', 'Some extracted text is missing. Saving will use only the text visible in this editor.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Use partial text', onPress: () => {
                if (reviewRevision.current === revision) setPartialReviewAccepted(true);
            } },
        ]);
    };
    const [ocrLanguage, setOcrLanguage] = useState<OcrLanguageHint>('en');
    const [hasCloudImage, setHasCloudImage] = useState(false);
    const captureRef = useRef<{ userId: string; imageBase64?: string; languageHint: OcrLanguageHint; controller: AbortController } | null>(null);
    const invalidateCapture = () => {
        reviewRevision.current += 1;
        setPartialReviewAccepted(false);
        captureRef.current?.controller.abort();
        captureRef.current = null;
        setHasCloudImage(false);
        setIsOcrLoading(false);
    };
    // Close, account/book change and unmount invalidate both image consent and late output.
    useEffect(() => {
        invalidateCapture();
        return () => { reviewRevision.current += 1; captureRef.current?.controller.abort(); captureRef.current = null; };
    }, [visible, userId, userBookId, editingNote?.id]);
    useEffect(() => useAuthStore.subscribe((state, previous) => {
        if (state.session?.user.id !== previous.session?.user.id || state.status !== 'authenticated') invalidateCapture();
    }), []);
    const closeEditor = () => { invalidateCapture(); onClose(); };

    // Pre-fill when editing or OCR prefill
    useEffect(() => {
        if (editingNote) {
            setContent(editingNote.content);
            setTag(editingNote.tag);
            setPageNumber(editingNote.page_number?.toString() || '');
            setOverflow(false);
        } else if (initialOcrText?.trim() && visible) {
            const review = boundedReview(initialOcrText, 'en', 'on-device');
            setContent(review.reviewText);
            setTag('quote');
            setOverflow(review.reviewOverflow);
            // keep pageNumber as-is or empty for user to fill
        } else if (visible) {
            setContent('');
            setTag('reflect');
            setPageNumber('');
            setOverflow(false);
            setOcrLanguage('en');
        }
    }, [editingNote, visible, initialOcrText]);

    // Auto-focus the text input when modal opens
    useEffect(() => {
        if (visible) {
            const timer = setTimeout(() => contentRef.current?.focus(), 300);
            return () => clearTimeout(timer);
        }
    }, [visible]);

    const handleSave = async () => {
        if (incompleteReview) return;
        const trimmed = content.trim();
        if (!trimmed) return;
        if (getWordCount(trimmed) > NOTE_WORD_LIMIT) {
            Alert.alert('Choose a shorter passage', 'Notes can contain up to 500 words. Your text has been kept for editing.');
            return;
        }

        setIsSaving(true);
        try {
            const page = pageNumber ? parseInt(pageNumber, 10) : undefined;
            await onSave(trimmed, tag, page);
            setContent('');
            setTag('reflect');
            setPageNumber('');
            onClose();
        } catch (err: any) {
            Alert.alert('Note save failed', 'Your text has been kept. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // SDD-03 §8: on-device ML Kit native module cannot load in Expo Go — gate with guidance
    const isExpoGo =
        Constants.appOwnership === 'expo' ||
        Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

    const handleOcrScan = async () => {
        try {
            if (content.trim() && content.trim() !== editingNote?.content) {
                Alert.alert('Replace current text?', 'Scanning a page will replace the text you have typed.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Scan', style: 'destructive', onPress: () => { void runOcrCapture(); } },
                ]);
                return;
            }
            await runOcrCapture();
        } catch (e: any) {
            Alert.alert('Scan failed', ocrErrorMessage(e));
        }
    };

    const runOcrCapture = async () => {
        invalidateCapture();
        const actor = useAuthStore.getState().session?.user.id;
        if (!actor || actor !== userId) return;
        const capture = { userId: actor, languageHint: ocrLanguage, controller: new AbortController(), imageBase64: undefined as string | undefined };
        captureRef.current = capture;
        const current = () => captureRef.current === capture && !capture.controller.signal.aborted && useAuthStore.getState().session?.user.id === actor;
        setIsOcrLoading(true);
        try {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!current()) return;
            if (!perm.granted) {
                Alert.alert('Camera permission needed', 'Allow camera access in Settings to scan pages.');
                return;
            }
            // Downscale to <=1600px JPEG before base64 so the cloud fallback body stays small
            const res = await ImagePicker.launchCameraAsync({ quality: 0.5, exif: false });
            if (!current()) return;
            if (res.canceled || !res.assets?.[0]) return;
            const asset = res.assets[0];
            let imageBase64: string | undefined;
            try {
                const manipulated = await ImageManipulator.manipulateAsync(
                    asset.uri,
                    asset.width > 1600 ? [{ resize: { width: 1600 } }] : [],
                    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
                );
                imageBase64 = manipulated.base64 ?? undefined;
            } catch {
                // Manipulation unavailable (e.g. web edge cases) — fall back to raw capture
            }
            if (!current()) return;
            capture.imageBase64 = imageBase64;
            setHasCloudImage(!!imageBase64);
            if (isExpoGo) throw new OcrError('ON_DEVICE_UNAVAILABLE');
            const result = await ocrService.recognizePageText(asset.uri, {
                languageHint: ocrLanguage,
                signal: capture.controller.signal,
            });
            if (!current()) return;
            setContent(result.reviewText);
            setTag('quote');
            setOverflow(result.reviewOverflow);
        } catch (e: any) {
            if (current() && !(e instanceof OcrError && e.code === 'CANCELED')) Alert.alert('Scan failed', ocrErrorMessage(e));
        } finally {
            if (current()) setIsOcrLoading(false);
        }
    };

    const handleCloudRetry = () => {
        const capture = captureRef.current;
        if (!capture?.imageBase64 || isOcrLoading) return;
        Alert.alert('Recognize with cloud?', 'This page image will be sent to Google Cloud Vision to extract text. A successful result will replace the editor text. Nothing is saved automatically.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Upload and recognize', onPress: async () => {
                const current = () => captureRef.current === capture && !capture.controller.signal.aborted && useAuthStore.getState().session?.user.id === capture.userId;
                if (!current()) return;
                setIsOcrLoading(true);
                try {
                    const result = await ocrService.recognizePageViaCloud({ imageBase64: capture.imageBase64!, languageHint: capture.languageHint, userId: capture.userId, requestId: Crypto.randomUUID(), consent: true, signal: capture.controller.signal });
                    if (!current()) return;
                    setContent(result.reviewText); setTag('quote'); setOverflow(result.reviewOverflow);
                } catch (error) {
                    if (current() && !(error instanceof OcrError && error.code === 'CANCELED')) Alert.alert('Cloud recognition failed', ocrErrorMessage(error));
                } finally { if (current()) setIsOcrLoading(false); }
            } },
        ]);
    };

    const handleSaveToVault = async () => {
        if (incompleteReview) return;
        if (!userId || !userBookId) return;
        const page = pageNumber ? parseInt(pageNumber, 10) : NaN;
        if (!page || page <= 0) {
            Alert.alert('Page number required', 'Enter a positive page number to save this page to your vault.');
            return;
        }
        const trimmed = content.trim();
        if (!trimmed) return; // Save button already disabled for empty content
        setIsVaultSaving(true);
        try {
            const { wasTrimmed } = capToVaultLimits(trimmed);
            await userBookPagesService.upsertPage(userId, userBookId, page, trimmed);
            queryClient.invalidateQueries({ queryKey: ['vault-pages', userBookId] });
            setOverflow(false);
            onClose();
            if (wasTrimmed) {
                Alert.alert('Page trimmed', 'The saved page exceeded the 4,000-character vault limit and was shortened at a word boundary.');
            }
        } catch (e: any) {
            Alert.alert('Vault save failed', 'Your text has been kept. Please try again.');
        } finally {
            setIsVaultSaving(false);
        }
    };

    const handleContentChange = (text: string) => {
        invalidateCapture();
        setContent(text);

    };

    const tagConfig = tag ? NOTE_TAG_CONFIG[tag] : {
        color: colors.accent, description: 'This note has no category.',
    };
    const isEditing = !!editingNote;
    const canSave = !incompleteReview && content.trim().length > 0 && !isSaving && !isOcrLoading && getWordCount(content) <= NOTE_WORD_LIMIT;
    const wordCount = getWordCount(content);
    const canVaultSave = !incompleteReview && !!userId && !!userBookId && /^[1-9]\d*$/.test(pageNumber) && wordCount > 0 && !capToVaultLimits(content).wasTrimmed && !isVaultSaving && !isOcrLoading;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={closeEditor}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <TouchableOpacity style={styles.backdrop} onPress={closeEditor} activeOpacity={1} />

                <View style={[styles.sheet, { backgroundColor: colors.bgPrimary }]}>
                    {/* Handle bar */}
                    <View style={styles.handleBar}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={closeEditor} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
                            <TagSelector selected={tag} onChange={setTag} allowDeselect />
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
                                                : tag === 'question'
                                                    ? 'What are you still wondering?'
                                                    : tag === 'apply'
                                                        ? 'What will you do with this?'
                                                        : 'Write your note...'
                                }
                                placeholderTextColor={colors.textTertiary}
                                multiline
                                accessibilityLabel="Note text"
                                editable={!isOcrLoading}
                                textAlignVertical="top"
                                value={content}
                                onChangeText={handleContentChange}
                                autoFocus={false}
                            />
                            {reviewOverflow && (
                                <Text style={[styles.truncationBanner, { color: '#D97706', backgroundColor: 'rgba(217,119,6,0.12)' }]}>
                                    OCR kept only the first {OCR_REVIEW_LIMIT.toLocaleString('en-US')} characters. Some text is missing. Scan a smaller area or explicitly use this partial text.{partialReviewAccepted ? ' Partial text accepted.' : ''}
                                </Text>
                            )}
                        </View>

                        {incompleteReview && (
                            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Use partial OCR text" onPress={acceptPartialReview} disabled={isOcrLoading} style={styles.ocrButton}>
                                <Text style={{ color: colors.accent }}>Use partial OCR text</Text>
                            </TouchableOpacity>
                        )}

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

                        {/* Word count + OCR */}
                        <View style={styles.section}>
                            <Text style={[styles.wordCount, { color: wordCount > NOTE_WORD_LIMIT || reviewOverflow ? '#D97706' : colors.textTertiary }]}>
                                {wordCount} / {NOTE_WORD_LIMIT} words{reviewOverflow ? ' — extraction exceeded the review limit; recrop to see more' : wordCount > NOTE_WORD_LIMIT ? ' — choose a shorter passage to save a note' : ''}
                            </Text>
                            {/* Language hint for hi|kn|ml fallback */}
                            <View style={styles.langRow}>
                                {(['en','hi','kn','ml'] as OcrLanguageHint[]).map((lang) => (
                                    <TouchableOpacity
                                        key={lang}
                                        onPress={() => { invalidateCapture(); setOcrLanguage(lang); }}
                                        disabled={isOcrLoading}
                                        style={[styles.langChip, { backgroundColor: ocrLanguage===lang ? colors.accent : colors.bgSecondary, borderColor: colors.border }]}
                                    >
                                        <Text style={[styles.langText, { color: ocrLanguage===lang ? '#fff' : colors.textSecondary }]}>{lang.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <TouchableOpacity
                                onPress={handleOcrScan}
                                accessibilityRole="button"
                                accessibilityLabel="Scan page"
                                disabled={isOcrLoading}
                                style={[styles.ocrButton, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}
                            >
                                {isOcrLoading ? (
                                    <ActivityIndicator size="small" color={colors.accent} />
                                ) : (
                                    <Ionicons name="scan-outline" size={16} color={colors.accent} />
                                )}
                                <Text style={[styles.ocrText, { color: colors.accent }]}>Scan Page ({ocrLanguage.toUpperCase()})</Text>
                            </TouchableOpacity>
                            {hasCloudImage && (
                                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry with cloud" onPress={handleCloudRetry} disabled={isOcrLoading} style={styles.ocrButton}>
                                    <Text style={{ color: colors.accent }}>Retry with cloud</Text>
                                </TouchableOpacity>
                            )}
                            {content.trim() && capToVaultLimits(content).wasTrimmed && <Text style={{ color: colors.textSecondary }}>Choose a shorter passage for the vault: up to 800 words and 4,000 characters.</Text>}
                            {userId && userBookId && (
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Save to Vault"
                                    onPress={handleSaveToVault}
                                    disabled={!canVaultSave}
                                    style={[styles.vaultButton, { backgroundColor: canVaultSave ? colors.accent : colors.bgSecondary, borderColor: colors.border }]}
                                >
                                    {isVaultSaving ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Ionicons name="bookmark-outline" size={16} color={canVaultSave ? '#fff' : colors.textTertiary} />
                                    )}
                                    <Text style={[styles.vaultText, { color: canVaultSave ? '#fff' : colors.textTertiary }]}>Save to Vault (page {pageNumber || '?'})</Text>
                                </TouchableOpacity>
                            )}
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
    wordCount: {
        fontSize: 12,
        marginBottom: 8,
    },
    truncationBanner: {
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        fontSize: 12,
        fontWeight: '600',
        overflow: 'hidden',
    },
    langRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    langChip: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    langText: {
        fontSize: 12,
        fontWeight: '700',
    },
    ocrButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 4,
    },
    ocrText: {
        fontSize: 13,
        fontWeight: '600',
    },
    vaultButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 8,
    },
    vaultText: {
        fontSize: 13,
        fontWeight: '700',
    },
});
