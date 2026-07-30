import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { useImageInventoryIdentity } from '../identity/imageInventoryIdentity';
import { InventoryAccessBoundary } from '../screens/InventoryAccessBoundary';

jest.mock('../identity/imageInventoryIdentity', () => ({
    useImageInventoryIdentity: jest.fn(),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({
        colors: {
            accent: '#0000ff',
            textPrimary: '#000000',
            textSecondary: '#444444',
        },
    }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => children,
}));

const mockIdentity = useImageInventoryIdentity as jest.Mock;

describe('Phase 9 Unit 6B route Owner guard foundation', () => {
    it('does not render private route content while access is loading', () => {
        mockIdentity.mockReturnValue({ status: 'loading', identity: null });
        const screen = render(
            <InventoryAccessBoundary>
                {() => <Text>private content</Text>}
            </InventoryAccessBoundary>,
        );
        expect(screen.getByText('Checking inventory access…')).toBeTruthy();
        expect(screen.queryByText('private content')).toBeNull();
    });

    it('fails closed for unauthorized and revoked deep links', () => {
        mockIdentity.mockReturnValue({ status: 'unauthorized', identity: null });
        const screen = render(
            <InventoryAccessBoundary>
                {() => <Text>private content</Text>}
            </InventoryAccessBoundary>,
        );
        expect(screen.getByText('Inventory unavailable')).toBeTruthy();
        expect(screen.queryByText('private content')).toBeNull();
    });

    it('passes only the authenticated user and server-resolved store identity', () => {
        mockIdentity.mockReturnValue({
            status: 'ready',
            identity: { userId: 'user-1', storeId: 'store-1' },
            storeName: 'Local Books',
        });
        const child = jest.fn((identity) => (
            <Text>{`${identity.userId}:${identity.storeId}`}</Text>
        ));
        const screen = render(<InventoryAccessBoundary>{child}</InventoryAccessBoundary>);
        expect(screen.getByText('user-1:store-1')).toBeTruthy();
        expect(child).toHaveBeenCalledWith({ userId: 'user-1', storeId: 'store-1' });
    });
});
