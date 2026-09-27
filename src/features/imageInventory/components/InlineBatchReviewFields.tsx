import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { normalizeSafeText } from '../contracts/ownerUxValidation';
import type { CompactReviewEdits } from '../review/compactReviewDraft';
import { SourceBadge } from './BatchReviewFieldSummary';


type InlineReviewIdentityProps = Readonly<{
    ordinal: number;
    title: string;
    authors: readonly string[];
    titleSourceCode: string;
    authorsSourceCode: string;
    titleLocal: boolean;
    authorsLocal: boolean;
    errorFields: ReadonlySet<string>;
    disabled: boolean;
    holdBuffered?: boolean;
    resetKey?: number;
    onBufferedChange?: (field: 'originalTitle' | 'authors',
        value: string | string[] | undefined, active: boolean) => void;
    onChange: (patch: CompactReviewEdits) => void;
}>;

function sameSafeText(left: string, right: string, maximum: number): boolean {
    if (left === right) return true;
    try {
        return normalizeSafeText(left, maximum) === normalizeSafeText(right, maximum);
    } catch {
        return false;
    }
}

function sameSafeTextList(left: readonly string[], right: readonly string[], maximum: number): boolean {
    return left.length === right.length
        && left.every((value, index) => sameSafeText(value, right[index], maximum));
}

export function InlineReviewIdentity({
    ordinal, title, authors, titleSourceCode, authorsSourceCode, titleLocal, authorsLocal,
    errorFields, disabled, holdBuffered = false, resetKey = 0,
    onBufferedChange, onChange,
}: InlineReviewIdentityProps) {
    const { colors } = useTheme();
    const [editingTitle, setEditingTitle] = useState(false);
    const [editingAuthors, setEditingAuthors] = useState(false);
    const [titleDraft, setTitleDraft] = useState(title);
    const [authorDrafts, setAuthorDrafts] = useState<string[]>([...authors]);
    const previousResetKey = useRef(resetKey);
    const authorsKey = authors.join('\u001f');

    useEffect(() => {
        if (!editingTitle) setTitleDraft(title);
    }, [title, editingTitle]);

    useEffect(() => {
        if (!editingAuthors) setAuthorDrafts([...authors]);
    }, [authorsKey, editingAuthors]);

    useEffect(() => {
        if (previousResetKey.current === resetKey) return;
        previousResetKey.current = resetKey;
        setTitleDraft(title);
        setAuthorDrafts([...authors]);
        setEditingTitle(false);
        setEditingAuthors(false);
        onBufferedChange?.('originalTitle', undefined, false);
        onBufferedChange?.('authors', undefined, false);
    }, [resetKey, title, authorsKey]);

    const finishTitle = () => {
        if (holdBuffered) return;
        if (!sameSafeText(titleDraft, title, 512)) onChange({ originalTitle: titleDraft });
        onBufferedChange?.('originalTitle', undefined, false);
        setEditingTitle(false);
    };

    const commitAuthors = (nextAuthors: string[]) => {
        setAuthorDrafts(nextAuthors);
        const normalized = nextAuthors.map((author) => author.trim()).filter(Boolean).slice(0, 20);
        onBufferedChange?.('authors', normalized, true);
    };

    const finishAuthors = () => {
        if (holdBuffered) return;
        const nextAuthors = authorDrafts.map((author) => author.trim()).filter(Boolean).slice(0, 20);
        setAuthorDrafts(nextAuthors);
        if (!sameSafeTextList(nextAuthors, authors, 256)) onChange({ authors: nextAuthors });
        onBufferedChange?.('authors', undefined, false);
        setEditingAuthors(false);
    };

    return (
        <View style={{ gap: 6 }}>
            {editingTitle ? (
                <TextInput
                    testID="card-title-input"
                    accessibilityLabel={`Book ${ordinal} title`}
                    value={titleDraft}
                    maxLength={512}
                    onChangeText={(value) => {
                        setTitleDraft(value);
                        onBufferedChange?.('originalTitle', value, true);
                    }}
                    onBlur={finishTitle}
                    autoFocus
                    editable={!disabled}
                    style={{
                        color: colors.textPrimary,
                        fontSize: 18,
                        fontWeight: '800',
                        lineHeight: 23,
                        borderWidth: 1,
                        borderColor: errorFields.has('originalTitle') ? colors.error : colors.accent,
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        backgroundColor: colors.bgSecondary,
                        width: '100%',
                        minHeight: 44,
                    }}
                />
            ) : (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit title for Book ${ordinal}: ${title || 'Not set'}`}
                    accessibilityHint="Opens an inline title editor"
                    onPress={() => {
                        if (disabled) return;
                        setTitleDraft(title);
                        setEditingTitle(true);
                        onBufferedChange?.('originalTitle', title, true);
                    }}
                    disabled={disabled}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text selectable
                            style={{
                                flexShrink: 1,
                                color: colors.textPrimary,
                                fontSize: 18,
                                fontWeight: '800',
                                lineHeight: 23,
                            }}>
                            {title || 'Add title'}
                        </Text>
                        {!disabled ? (
                            <Ionicons name="create-outline" size={17} color={colors.accent} accessible={false} />
                        ) : null}
                    </View>
                </Pressable>
            )}
            {editingAuthors ? (
                <View testID="card-authors-editor" style={{ gap: 6, padding: 8, borderWidth: 1,
                    borderColor: colors.border, borderRadius: 12, backgroundColor: colors.bgSecondary }}>
                    {authorDrafts.map((author, index) => (
                        <View key={`card-author-${index}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <TextInput
                                testID={`card-author-${index}`}
                                accessibilityLabel={`Book ${ordinal} author ${index + 1}`}
                                value={author}
                                maxLength={256}
                                onChangeText={(value) => commitAuthors(authorDrafts.map(
                                    (item, itemIndex) => itemIndex === index ? value : item,
                                ))}
                                autoFocus={index === 0}
                                editable={!disabled}
                                style={{
                                    color: colors.textSecondary,
                                    fontSize: 14,
                                    lineHeight: 20,
                                    borderWidth: 1,
                                    borderColor: errorFields.has('authors') ? colors.error : colors.border,
                                    borderRadius: 8,
                                    paddingHorizontal: 8,
                                    paddingVertical: 8,
                                    backgroundColor: colors.bgSecondary,
                                    flex: 1,
                                    minWidth: 0,
                                    minHeight: 44,
                                }}
                            />
                            <Pressable accessibilityRole="button" accessibilityLabel={`Remove author ${index + 1}`}
                                onPress={() => commitAuthors(authorDrafts.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                ))} disabled={disabled}
                                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                                <Ionicons name="close-outline" size={20} color={colors.textSecondary} accessible={false} />
                            </Pressable>
                        </View>
                    ))}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    {authorDrafts.length < 20 ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="Add author"
                            onPress={() => commitAuthors([...authorDrafts, ''])}
                            disabled={disabled} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="add-outline" size={17} color={colors.accent} accessible={false} />
                            <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}>Add author</Text>
                        </Pressable>
                    ) : null}
                    <Pressable accessibilityRole="button" accessibilityLabel="Done editing authors"
                        onPress={finishAuthors} disabled={disabled} style={{ marginLeft: 'auto', minHeight: 44,
                            paddingHorizontal: 14, justifyContent: 'center', borderRadius: 8, backgroundColor: colors.bgPrimary }}>
                        <Text style={{ color: colors.accent, fontSize: 13, fontWeight: '700' }}>Done</Text>
                    </Pressable>
                    </View>
                </View>
            ) : (
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Edit authors for Book ${ordinal}: ${authors.join(', ') || 'Author unknown'}`}
                    accessibilityHint="Opens ordered author fields with add and remove controls"
                    onPress={() => {
                        if (disabled) return;
                        setAuthorDrafts([...authors]);
                        setEditingAuthors(true);
                        onBufferedChange?.('authors', [...authors], true);
                    }}
                    disabled={disabled}
                    style={{ minHeight: 44, justifyContent: 'center' }}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text selectable style={{ flexShrink: 1, color: colors.textSecondary, lineHeight: 20 }}>
                            {authors.join(', ') || 'Add authors'}
                        </Text>
                        {!disabled ? (
                            <Ionicons name="create-outline" size={16} color={colors.accent} accessible={false} />
                        ) : null}
                    </View>
                </Pressable>
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <SourceBadge code={titleSourceCode} local={titleLocal} />
                <SourceBadge code={authorsSourceCode} local={authorsLocal} />
            </View>
        </View>
    );
}

export { InlineReviewValueFields } from './InlineReviewValueFields';
