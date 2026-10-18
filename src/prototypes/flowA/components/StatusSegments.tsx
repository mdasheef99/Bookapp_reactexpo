import React, { useRef, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SPACE, STACK_STATUS_BELOW, STATUS_SEGMENT_BORDER, styles, usePrototypeText, webFocusStyle } from '../prototypeTokens';
import type { Appearance } from '../prototypeTokens';
import type { ReadingStatus } from '../fixtures';

const statuses: readonly { label: string; value: ReadingStatus }[] = [
    { label: 'Want to read', value: 'want_to_read' },
    { label: 'Reading', value: 'reading' },
    { label: 'Finished', value: 'completed' },
];

export function StatusSegments({ initialStatus, colors, disabled = false }: { initialStatus: ReadingStatus; colors: Appearance; disabled?: boolean }) {
    const text = usePrototypeText();
    const [width, setWidth] = useState(0);
    const [labelWidths, setLabelWidths] = useState<number[]>([]);
    const labelSpace = (width - SPACE.xxs * 2) / statuses.length - (SPACE.xxs + STATUS_SEGMENT_BORDER) * 2;
    const vertical = width < STACK_STATUS_BELOW || statuses.some((_, index) =>
        labelWidths[index] == null || labelWidths[index] > labelSpace);
    const [selected, setSelected] = useState(initialStatus);
    const [focused, setFocused] = useState<number | null>(null);
    const refs = useRef<(View | null)[]>([]);
    return <View accessibilityRole="radiogroup" accessibilityLabel="Reading status"
        onLayout={event => setWidth(event.nativeEvent.layout.width)}
        aria-disabled={disabled} accessibilityState={{ disabled }} aria-orientation={vertical ? 'vertical' : 'horizontal'}
        style={[styles.track, vertical && styles.verticalTrack, { backgroundColor: colors.bgSecondary }, disabled && styles.disabled]}>
        {/* Measure the bold label in one line, independently of the visible rows. */}
        <View accessible={false} aria-hidden importantForAccessibility="no-hide-descendants" style={styles.measurementClip}>
            <View style={styles.measurementRow}>
                {statuses.map(({ label, value }, index) => <Text key={value} testID={`fa-status-measure-${value}`}
                    numberOfLines={1} style={[text.label, styles.measurementLabel]}
                    onLayout={event => {
                        const nextWidth = event.nativeEvent.layout.width;
                        setLabelWidths(current => {
                            if (current[index] === nextWidth) return current;
                            const next = [...current];
                            next[index] = nextWidth;
                            return next;
                        });
                    }}>{label}</Text>)}
            </View>
        </View>
        {statuses.map(({ label, value }, index) => {
            const checked = selected === value;
            const keyboard = { onKeyDown: (event: { key?: string; nativeEvent?: { key: string }; preventDefault: () => void }) => {
                const key = event.nativeEvent?.key ?? event.key;
                if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key ?? '')) return;
                event.preventDefault();
                const next = (index + (key === 'ArrowRight' || key === 'ArrowDown' ? 1 : statuses.length - 1)) % statuses.length;
                setSelected(statuses[next].value);
                refs.current[next]?.focus();
            } };
            return <Pressable key={value} ref={node => { refs.current[index] = node; }}
                accessibilityRole="radio" accessibilityLabel={label} aria-checked={checked} aria-disabled={disabled}
                accessibilityState={{ checked, disabled }} disabled={disabled}
                tabIndex={!disabled && checked ? 0 : -1} {...keyboard} onPress={disabled ? undefined : () => setSelected(value)}
                onFocus={() => setFocused(index)} onBlur={() => setFocused(null)}
                style={[styles.segment, vertical && styles.verticalSegment, { backgroundColor: checked ? colors.bgCard : colors.bgSecondary,
                    borderColor: checked ? colors.controlBorder : colors.bgSecondary }, webFocusStyle(focused === index, colors)]}>
                <Text style={[checked ? text.label : text.body, styles.segmentLabel, Platform.OS === 'web' && styles.wrapWords,
                    { color: checked ? colors.textPrimary : colors.textSecondary }]}>{label}</Text>
            </Pressable>;
        })}
    </View>;
}
