import { render } from '@testing-library/react-native';
import StoreOwnerLayout from '../_layout';

jest.mock('expo-router', () => {
    const MockTabs = Object.assign(
        jest.fn(({ children }: { children?: React.ReactNode }) => children ?? null),
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

    it('exposes Store View as the primary rich-management tab and keeps profile secondary', () => {
        render(<StoreOwnerLayout />);

        const screenProps = (require('expo-router').Tabs.Screen as jest.Mock).mock.calls
            .map(([props]) => props);
        const byName = (name: string) => screenProps.find((props: { name: string }) => props.name === name);
        const primaryNames = screenProps
            .filter((props: { options?: { href?: unknown } }) => props.options?.href !== null)
            .map((props: { name: string }) => props.name);

        expect(primaryNames).toEqual(['dashboard', 'inventory', 'store-view', 'orders/index', 'subscription']);
        expect(byName('store-view').options).toEqual(expect.objectContaining({ title: 'Store View' }));
        expect(byName('store-view').options.href).not.toBe(null);
        expect(byName('storefront').options.href).toBe(null);
        expect(byName('store-profile').options.href).toBe(null);
    });

    it('renders without crashing', () => {
        expect(() => render(<StoreOwnerLayout />)).not.toThrow();
    });
});
