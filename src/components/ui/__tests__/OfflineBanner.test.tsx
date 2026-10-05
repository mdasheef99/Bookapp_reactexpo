import React from 'react';
import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';
import { OfflineBanner } from '../OfflineBanner';

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: { accent: '#123' } }),
}));

describe('OfflineBanner accessibility', () => {
    it('keeps the translated-away banner out of the accessibility tree', () => {
        const screen = render(<OfflineBanner visible={false} />);
        const banner = screen.UNSAFE_getByType(Animated.View);

        expect(banner.props.accessible).toBe(false);
        expect(banner.props.accessibilityElementsHidden).toBe(true);
        expect(banner.props.importantForAccessibility).toBe('no-hide-descendants');
        expect(banner.props['aria-hidden']).toBe(true);
        expect(banner.props.pointerEvents).toBe('none');
    });

    it('announces the message only while visible', () => {
        const screen = render(<OfflineBanner visible />);
        const banner = screen.UNSAFE_getByType(Animated.View);

        expect(banner.props.accessible).toBe(true);
        expect(banner.props.accessibilityRole).toBe('alert');
        expect(banner.props.accessibilityLabel).toBe("You're offline. New catalogue searches need an internet connection.");
        expect(banner.props.accessibilityElementsHidden).toBe(false);
        expect(banner.props['aria-hidden']).toBe(false);
    });
});
