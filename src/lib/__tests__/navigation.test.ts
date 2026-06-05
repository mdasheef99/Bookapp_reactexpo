import { navigateBackOrFallback } from '@/lib/navigation';

describe('navigateBackOrFallback', () => {
    it('uses the section fallback even when router history exists', () => {
        const router = {
            back: jest.fn(),
            canGoBack: jest.fn(() => true),
            replace: jest.fn(),
        };
        const fallbackHref = '/(tabs)/exchange' as Parameters<typeof navigateBackOrFallback>[1];

        navigateBackOrFallback(router, fallbackHref);

        expect(router.replace).toHaveBeenCalledWith(fallbackHref);
        expect(router.back).not.toHaveBeenCalled();
    });
});
