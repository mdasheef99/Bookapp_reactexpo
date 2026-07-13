import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassCard } from '@/components/ui/GlassCard';
import { useTheme } from '@/hooks/useTheme';
import type { MarketplaceBookCondition, StoreInventoryItem } from '../types';

const DEFAULT_CONDITION: MarketplaceBookCondition = 'good';
const CONDITION_OPTIONS: MarketplaceBookCondition[] = ['new', 'like_new', 'good', 'fair', 'damaged'];

export interface AddInventoryFormProps {
    onSaveDraft: (input: {
        title: string;
        author: string;
        isbn13: string;
        price: string;
        quantity: string;
        condition: MarketplaceBookCondition;
        publicNotes: string;
        shelfLocation: string;
    }) => Promise<void>;
    onCheckDuplicates: (isbn13: string, title: string, author: string) => Promise<void>;
    duplicates: StoreInventoryItem[];
    isSaving: boolean;
    message: string | null;
    onImageToLLM?: () => void;
}

export default function AddInventoryForm({
    onSaveDraft,
    onCheckDuplicates,
    duplicates,
    isSaving,
    message,
    onImageToLLM,
}: AddInventoryFormProps) {
    const { colors } = useTheme();
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [isbn13, setIsbn13] = useState('');
    const [price, setPrice] = useState('');
    const [quantity, setQuantity] = useState('1');
    const [condition, setCondition] = useState<MarketplaceBookCondition>(DEFAULT_CONDITION);
    const [publicNotes, setPublicNotes] = useState('');
    const [shelfLocation, setShelfLocation] = useState('');

    async function handleSaveDraft() {
        await onSaveDraft({
            title,
            author,
            isbn13,
            price,
            quantity,
            condition,
            publicNotes,
            shelfLocation,
        });
        setTitle('');
        setAuthor('');
        setIsbn13('');
        setPrice('');
        setQuantity('1');
        setCondition(DEFAULT_CONDITION);
        setPublicNotes('');
        setShelfLocation('');
    }

    function handleCheckDuplicates() {
        onCheckDuplicates(isbn13, title, author);
    }

    return (
        <GlassCard padding={18} borderRadius={16}>
            <View style={styles.sectionHeader}>
                <Ionicons name="book-outline" size={22} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Manual book entry</Text>
            </View>
            <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Title"
                value={title}
                onChangeText={setTitle}
            />
            <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Author"
                value={author}
                onChangeText={setAuthor}
            />
            <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="ISBN-13"
                value={isbn13}
                onChangeText={setIsbn13}
                keyboardType="number-pad"
            />
            <View style={styles.conditionRow}>
                {CONDITION_OPTIONS.map((option) => (
                    <TouchableOpacity
                        key={option}
                        testID={`condition-${option}`}
                        style={[
                            styles.conditionChip,
                            {
                                borderColor: condition === option ? colors.accent : colors.border,
                                backgroundColor: condition === option ? colors.accent : '#FFFFFF',
                            },
                        ]}
                        onPress={() => setCondition(option)}
                    >
                        <Text
                            style={[
                                styles.conditionText,
                                { color: condition === option ? '#FFFFFF' : colors.textPrimary },
                            ]}
                        >
                            {option.replace('_', ' ')}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
            <View style={styles.row}>
                <TextInput
                    style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder="Price in rupees"
                    value={price}
                    onChangeText={setPrice}
                    keyboardType="decimal-pad"
                />
                <TextInput
                    style={[styles.input, styles.rowInput, { borderColor: colors.border, color: colors.textPrimary }]}
                    placeholder="Quantity"
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="number-pad"
                />
            </View>
            <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Public notes"
                value={publicNotes}
                onChangeText={setPublicNotes}
            />
            <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.textPrimary }]}
                placeholder="Shelf location"
                value={shelfLocation}
                onChangeText={setShelfLocation}
            />

            <TouchableOpacity
                testID="check-duplicates"
                style={[styles.secondaryAction, { borderColor: colors.border }]}
                onPress={handleCheckDuplicates}
            >
                <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>Check duplicates</Text>
            </TouchableOpacity>
            <TouchableOpacity
                testID="save-inventory-draft"
                style={[styles.primaryAction, { backgroundColor: colors.accent }]}
                onPress={handleSaveDraft}
                disabled={isSaving}
            >
                <Text style={styles.primaryText}>{isSaving ? 'Saving...' : 'Save draft'}</Text>
            </TouchableOpacity>

            {onImageToLLM ? (
                <TouchableOpacity
                    testID="image-to-llm"
                    style={[styles.disabledAction, { borderColor: colors.border }]}
                    onPress={onImageToLLM}
                    disabled
                >
                    <Ionicons name="camera-outline" size={18} color={colors.textTertiary} style={{ marginRight: 6 }} />
                    <Text style={[styles.disabledText, { color: colors.textTertiary }]}>
                        Image-to-LLM (coming soon)
                    </Text>
                </TouchableOpacity>
            ) : null}

            {message ? (
                <Text style={[styles.body, { color: colors.textSecondary }]}>{message}</Text>
            ) : null}

            {duplicates.length > 0 ? (
                <View style={styles.duplicates}>
                    {duplicates.map((item) => (
                        <Text key={item.id} style={[styles.duplicateText, { color: colors.textPrimary }]}>
                            Potential duplicate: {item.title}
                        </Text>
                    ))}
                </View>
            ) : null}
        </GlassCard>
    );
}

const styles = StyleSheet.create({
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '800' },
    row: { flexDirection: 'row', gap: 10 },
    conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    conditionChip: {
        minHeight: 34,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    conditionText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
    rowInput: { flex: 1 },
    input: {
        minHeight: 48,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 10,
        backgroundColor: '#FFFFFF',
    },
    primaryAction: {
        minHeight: 50,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    secondaryAction: {
        minHeight: 46,
        borderWidth: 1,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    secondaryText: { fontSize: 15, fontWeight: '700' },
    disabledAction: {
        minHeight: 46,
        borderWidth: 1,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        flexDirection: 'row',
        opacity: 0.6,
    },
    disabledText: { fontSize: 14, fontWeight: '600' },
    body: { fontSize: 14, lineHeight: 20, marginTop: 10 },
    duplicates: { marginTop: 16, gap: 8 },
    duplicateText: { fontSize: 14, fontWeight: '700' },
});