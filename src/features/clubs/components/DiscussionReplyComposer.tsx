import { useCallback, useEffect, useState, type RefObject } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Props = {
    topicId: string;
    targetId: string | null;
    targetLabel: string;
    preview: string;
    value: string;
    posting: boolean;
    unavailable: boolean;
    error: string | null;
    colors: { bgPrimary: string; bgCard: string; bgSecondary: string; border: string; accent: string; textPrimary: string; textSecondary: string; textTertiary: string };
    containerRef: RefObject<View | null>;
    inputRef: RefObject<TextInput | null>;
    onLayout: () => void;
    onChange: (value: string) => void;
    onCancel: () => void;
    onSwitchToTopic: () => void;
    onQuote: () => void;
    onSubmit: () => void;
};

/** A stable component keeps focus while the screen's controlled draft changes. */
export function DiscussionReplyComposer({ topicId, targetId, targetLabel, preview, value, posting, unavailable, error, colors, containerRef, inputRef, onLayout, onChange, onCancel, onSwitchToTopic, onQuote, onSubmit }: Props) {
    const [inputHeight, setInputHeight] = useState(64);
    const hasText = value.length > 0;
    useEffect(() => {
        if (!hasText) setInputHeight(64);
    }, [hasText]);
    const handleContentSizeChange = useCallback(({ nativeEvent }: { nativeEvent: { contentSize: { height: number } } }) => {
        const height = Math.max(64, Math.min(180, Math.ceil(nativeEvent.contentSize.height)));
        // Web scrollHeight excludes borders and follows the assigned height.
        // Grow monotonically while typing to avoid resize/shrink feedback loops.
        setInputHeight(previous => hasText ? Math.max(previous, height) : 64);
    }, [hasText]);
    return (
        <View ref={containerRef} onLayout={onLayout} style={[styles.composer, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]} testID="discussion-inline-composer">
            <View style={styles.heading}>
                <View style={styles.target}>
                    <View style={[styles.targetDot, { backgroundColor: colors.accent }]} />
                    <Text style={[styles.targetText, { color: colors.accent }]}>{targetLabel}</Text>
                </View>
                <TouchableOpacity onPress={onCancel} disabled={posting} style={styles.cancel} accessibilityRole="button" accessibilityLabel="Cancel reply" testID="discussion-reply-close">
                    <Ionicons name="close-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.controlText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>
            </View>
            <View style={[styles.preview, { borderLeftColor: colors.accent }]} testID={targetId ? `discussion-reply-preview-${targetId}` : 'discussion-topic-preview'}>
                <Text style={[styles.previewText, { color: colors.textSecondary }]} numberOfLines={1}>{preview}</Text>
            </View>
            <TextInput ref={inputRef} value={value} onChangeText={onChange} onContentSizeChange={handleContentSizeChange} placeholder="Add to the conversation…" placeholderTextColor={colors.textTertiary} multiline editable={!posting && !unavailable} accessibilityLabel="Your reply" style={[styles.input, { height: inputHeight, color: colors.textPrimary, backgroundColor: colors.bgCard, borderColor: colors.border }]} testID={`discussion-reply-body-${topicId}`} />
            {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={[styles.error, { color: colors.accent }]}>{error}</Text> : null}
            <View style={styles.footer}>
                <TouchableOpacity onPress={onQuote} disabled={posting || unavailable} style={styles.quoteButton} accessibilityRole="button" accessibilityLabel="Insert a plain text quote" testID="discussion-reply-quote">
                    <Ionicons name="chatbox-outline" size={16} color={colors.textSecondary} />
                    <Text style={[styles.controlText, { color: colors.textSecondary }]}>Quote</Text>
                </TouchableOpacity>
                {targetId ? <TouchableOpacity onPress={onSwitchToTopic} disabled={posting} style={styles.switchTarget} accessibilityRole="button" accessibilityLabel="Reply to topic instead" testID={`discussion-reply-cancel-${targetId}`}><Text style={[styles.controlText, { color: colors.textSecondary }]}>To topic</Text><Ionicons name="arrow-forward-outline" size={14} color={colors.textSecondary} /></TouchableOpacity> : null}
                <TouchableOpacity onPress={onSubmit} disabled={posting || unavailable || !value.trim()} style={[styles.submit, { backgroundColor: colors.accent, opacity: posting || unavailable || !value.trim() ? 0.55 : 1 }]} accessibilityRole="button" accessibilityState={{ busy: posting, disabled: posting || unavailable || !value.trim() }} testID={`discussion-reply-submit-${topicId}`}>
                    <Text style={styles.submitText}>{posting ? 'Posting…' : 'Post reply'}</Text>
                    <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    composer: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingBottom: 6, gap: 4, marginTop: 4, marginBottom: 4 },
    heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    target: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
    targetDot: { width: 5, height: 5, borderRadius: 3 },
    targetText: { flexShrink: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18 },
    cancel: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 3 },
    controlText: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    preview: { borderLeftWidth: 2, paddingLeft: 9 },
    previewText: { fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21 },
    input: { minHeight: 64, borderWidth: 1, borderRadius: 8, padding: 8, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, textAlignVertical: 'top' },
    error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 18 },
    switchTarget: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', columnGap: 4, rowGap: 0, flexWrap: 'wrap' },
    quoteButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
    submit: { minHeight: 44, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, gap: 5 },
    submitText: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontSize: 12, lineHeight: 18 },
});
