import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { storeViewRoutes } from '@/features/storeView/navigation/storeViewRoutes';
import { inventoryRoutes } from '../navigation/inventoryRoutes';
import { InventoryHubFoundationScreen } from '../screens/InventoryFoundationScreens';

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockIdentity = { userId: 'owner-1', storeId: 'store-1' };
const openSessionId = '00000000-0000-4000-8000-000000000010';
let mockDiscovery: any;

jest.mock('expo-router', () => ({
    Link: ({ children, href }: { children: React.ReactElement; href: string }) =>
        require('react').cloneElement(children, { href }),
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    useNavigation: () => ({ addListener: () => () => {}, dispatch: jest.fn() }),
    useLocalSearchParams: () => ({}),
}));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-image-picker', () => ({
    getCameraPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    getMediaLibraryPermissionsAsync: jest.fn(),
    requestMediaLibraryPermissionsAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@/hooks/useTheme', () => ({
    useTheme: () => ({ colors: {
        accent: '#2563eb', accentLight: '#60a5fa', bg: '#ffffff', bgCard: '#ffffff',
        bgSecondary: '#f3f4f6', border: '#d1d5db', disabled: '#9ca3af',
        disabledLight: '#d1d5db', error: '#b91c1c', errorLight: '#ef4444',
        textPrimary: '#111827', textSecondary: '#4b5563', textTertiary: '#9ca3af',
    } }),
}));
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => ({ isOffline: false, isConnected: true }),
}));
jest.mock('@/components/ui/ScreenBackground', () => ({
    ScreenBackground: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/components/ui/GlassCard', () => ({
    GlassCard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../screens/InventoryAccessBoundary', () => ({
    InventoryAccessBoundary: ({ children }: {
        children: (value: typeof mockIdentity) => React.ReactNode;
    }) => <>{children(mockIdentity)}</>,
}));
jest.mock('../queries/ownerUxQueries', () => ({
    getResolvedImageInventoryIdentity: () => mockIdentity,
    imageInventoryKeys: {
        all: ['phase9', 'ownerInventory', 'phase9-owner-ux-v1'],
        identity: (who: { userId: string; storeId: string }) => [
            'phase9', 'ownerInventory', 'phase9-owner-ux-v1', 'identity', who.userId, who.storeId,
        ],
        discovery: (who: { userId: string; storeId: string }) => [
            'phase9', 'ownerInventory', 'phase9-owner-ux-v1', 'identity', who.userId, who.storeId,
            'discovery',
        ],
        session: (who: { userId: string; storeId: string }, sessionId: string) => [
            'phase9', 'ownerInventory', 'phase9-owner-ux-v1', 'identity', who.userId, who.storeId,
            'session', sessionId,
        ],
        inputs: (who: { userId: string; storeId: string }, sessionId: string) => [
            'phase9', 'ownerInventory', 'phase9-owner-ux-v1', 'identity', who.userId, who.storeId,
            'inputs', sessionId,
        ],
        candidate: (who: { userId: string; storeId: string }, sessionId: string, candidateId: string) => [
            'phase9', 'ownerInventory', 'phase9-owner-ux-v1', 'identity', who.userId, who.storeId,
            'candidate', sessionId, candidateId,
        ],
        readiness: (who: { userId: string; storeId: string }, sessionId: string) => [
            'phase9', 'ownerInventory', 'phase9-owner-ux-v1', 'identity', who.userId, who.storeId,
            'readiness', sessionId,
        ],
    },
    useOwnerInventoryDiscovery: () => mockDiscovery,
    useOwnerInventoryCandidate: () => ({
        data: undefined, isLoading: false, error: null, refetch: jest.fn(),
    }),
    useOwnerInventoryInputs: () => ({
        data: undefined, isLoading: false, error: null, refetch: jest.fn(),
    }),
}));
function discovery(activeSession: null | {
    sessionId: string;
    inputCount: number;
    attentionCount: number;
} = null) {
    return {
        data: { activeSession, needsReviewCount: 1 },
        isLoading: false,
        error: null,
        isFetchedAfterMount: true,
        refetch: jest.fn().mockResolvedValue({ isError: false, error: null }),
    };
}

describe('Inventory hub card', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDiscovery = discovery();
    });

    it('hub shows scan entry and Store View line only', () => {
        const screen = render(<InventoryHubFoundationScreen />);

        expect(screen.getByRole('header', { name: 'Scan book spines' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Start scan' })).toBeTruthy();
        expect(screen.getByText('Added books are in Store View')).toBeTruthy();
        expect(screen.queryByText(/Review books/u)).toBeNull();
        expect(screen.queryByTestId('owner-inventory-search')).toBeNull();
        expect(screen.queryByTestId('owner-inventory-refresh')).toBeNull();
        expect(screen.queryByTestId('owner-inventory-load-more')).toBeNull();

        const storeViewLink = screen.getByRole('link', { name: 'Added books are in Store View' });
        expect(storeViewLink.props.href).toBe(storeViewRoutes.root());
        expect(StyleSheet.flatten(storeViewLink.props.style).minHeight).toBeGreaterThanOrEqual(44);
    });

    it('offers Resume for an open session and Start otherwise', () => {
        const start = render(<InventoryHubFoundationScreen />);
        expect(start.getByRole('button', { name: 'Start scan' })).toBeTruthy();
        expect(start.queryByRole('button', { name: 'Resume scan' })).toBeNull();
        fireEvent.press(start.getByRole('button', { name: 'Start scan' }));
        expect(mockPush).toHaveBeenCalledWith(inventoryRoutes.scan());
        start.unmount();

        mockPush.mockClear();
        mockDiscovery = discovery({ sessionId: openSessionId, inputCount: 2, attentionCount: 1 });
        const resume = render(<InventoryHubFoundationScreen />);
        expect(resume.getByRole('button', { name: 'Resume scan' })).toBeTruthy();
        expect(resume.queryByRole('button', { name: 'Start scan' })).toBeNull();
        fireEvent.press(resume.getByRole('button', { name: 'Resume scan' }));
        expect(mockPush).toHaveBeenCalledWith(inventoryRoutes.session(openSessionId));
    });
});
