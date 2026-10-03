import { getLibraryAppearance } from '../LibraryAppearance';

const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};

describe('Library appearance variants', () => {
    it.each(['daylight', 'golden', 'midnight'] as const)('%s keeps text readable on page, cards, selections and badges', (phase) => {
        const colors = getLibraryAppearance(phase);
        for (const [foreground, background] of [
            [colors.textPrimary, colors.bgPrimary],
            [colors.textSecondary, colors.bgPrimary],
            [colors.textPrimary, colors.bgCard],
            [colors.textSecondary, colors.bgCard],
            [colors.onAccent, colors.accent],
            [colors.tagText, colors.tagBackground],
        ]) {
            const light = Math.max(luminance(foreground), luminance(background));
            const dark = Math.min(luminance(foreground), luminance(background));
            expect((light + 0.05) / (dark + 0.05)).toBeGreaterThanOrEqual(4.5);
        }
    });
});
