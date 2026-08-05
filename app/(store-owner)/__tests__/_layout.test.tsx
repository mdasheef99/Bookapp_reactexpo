import { render } from '@testing-library/react-native';
import StoreOwnerLayout from '../_layout';

jest.mock('expo-router', () => {
    const MockTabs = Object.assign(
        jest.fn(({ children }: { children: unknown }) => children),
        { Screen: jest.fn(() => null) },
    );
    return { Tabs: MockTabs };
});
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

describe('StoreOwner tab navigator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('uses Tabs navigator', () => {
        render(<StoreOwnerLayout />);
        expect(require('expo-router').Tabs).toHaveBeenCalled();
    });

    it('renders without crashing', () => {
        expect(() => render(<StoreOwnerLayout />)).not.toThrow();
    });

    it('registers the concrete orders index route instead of a missing parent route', () => {
        render(<StoreOwnerLayout />);
        const screenNames = (require('expo-router').Tabs.Screen as jest.Mock).mock.calls.map(
            ([props]: [{ name: string }]) => props.name,
        );

        expect(screenNames).toContain('orders/index');
        expect(screenNames).not.toContain('orders');
    });
});
