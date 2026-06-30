import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

const FILTER_GROUPS = [
    {
        label: 'Condition',
        testPrefix: 'filter-condition',
        options: [
            ['all', 'All'],
            ['new', 'New'],
            ['like_new', 'Like new'],
            ['good', 'Good'],
            ['fair', 'Fair'],
            ['damaged', 'Damaged'],
        ],
    },
    {
        label: 'Status',
        testPrefix: 'filter-status',
        options: [
            ['all', 'All'],
            ['draft', 'Draft'],
            ['published', 'Published'],
            ['paused', 'Paused'],
        ],
    },
    {
        label: 'Quantity',
        testPrefix: 'filter-quantity',
        options: [
            ['all', 'All'],
            ['available', 'Available'],
            ['low_stock', 'Low stock'],
            ['out_of_stock', 'Out'],
        ],
    },
    {
        label: 'Source',
        testPrefix: 'filter-source',
        options: [
            ['all', 'All'],
            ['manual', 'Manual'],
            ['image_extraction', 'Image'],
        ],
    },
    {
        label: 'Date',
        testPrefix: 'filter-date',
        options: [
            ['all', 'All'],
            ['last_7_days', '7 days'],
            ['last_30_days', '30 days'],
        ],
    },
] as const;

export interface InventoryFilterPanelProps {
    conditionFilter: string;
    setConditionFilter: (value: string) => void;
    statusFilter: string;
    setStatusFilter: (value: string) => void;
    quantityFilter: string;
    setQuantityFilter: (value: string) => void;
    sourceFilter: string;
    setSourceFilter: (value: string) => void;
    dateFilter: string;
    setDateFilter: (value: string) => void;
}

export default function InventoryFilterPanel({
    conditionFilter,
    setConditionFilter,
    statusFilter,
    setStatusFilter,
    quantityFilter,
    setQuantityFilter,
    sourceFilter,
    setSourceFilter,
    dateFilter,
    setDateFilter,
}: InventoryFilterPanelProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.filterPanel}>
            <FilterGroup
                label={FILTER_GROUPS[0].label}
                testPrefix={FILTER_GROUPS[0].testPrefix}
                options={FILTER_GROUPS[0].options}
                value={conditionFilter}
                onChange={setConditionFilter}
                colors={colors}
            />
            <FilterGroup
                label={FILTER_GROUPS[1].label}
                testPrefix={FILTER_GROUPS[1].testPrefix}
                options={FILTER_GROUPS[1].options}
                value={statusFilter}
                onChange={setStatusFilter}
                colors={colors}
            />
            <FilterGroup
                label={FILTER_GROUPS[2].label}
                testPrefix={FILTER_GROUPS[2].testPrefix}
                options={FILTER_GROUPS[2].options}
                value={quantityFilter}
                onChange={setQuantityFilter}
                colors={colors}
            />
            <FilterGroup
                label={FILTER_GROUPS[3].label}
                testPrefix={FILTER_GROUPS[3].testPrefix}
                options={FILTER_GROUPS[3].options}
                value={sourceFilter}
                onChange={setSourceFilter}
                colors={colors}
            />
            <FilterGroup
                label={FILTER_GROUPS[4].label}
                testPrefix={FILTER_GROUPS[4].testPrefix}
                options={FILTER_GROUPS[4].options}
                value={dateFilter}
                onChange={setDateFilter}
                colors={colors}
            />
        </View>
    );
}

function FilterGroup({
    label,
    testPrefix,
    options,
    value,
    onChange,
    colors,
}: {
    label: string;
    testPrefix: string;
    options: readonly (readonly [string, string])[];
    value: string;
    onChange: (value: string) => void;
    colors: ReturnType<typeof useTheme>['colors'];
}) {
    return (
        <View style={styles.filterGroup}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={styles.filterOptions}>
                {options.map(([optionValue, optionLabel]) => {
                    const isActive = value === optionValue;
                    return (
                        <TouchableOpacity
                            key={optionValue}
                            testID={`${testPrefix}-${optionValue}`}
                            style={[
                                styles.filterChip,
                                {
                                    borderColor: isActive ? colors.accent : colors.border,
                                    backgroundColor: isActive ? colors.accent : '#FFFFFF',
                                },
                            ]}
                            onPress={() => onChange(optionValue)}
                        >
                            <Text style={[
                                styles.filterChipText,
                                { color: isActive ? '#FFFFFF' : colors.textPrimary },
                            ]}>
                                {optionLabel}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    filterPanel: { gap: 10, marginBottom: 10 },
    filterGroup: { gap: 6 },
    filterLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterChip: {
        minHeight: 34,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    filterChipText: { fontSize: 12, fontWeight: '700' },
});