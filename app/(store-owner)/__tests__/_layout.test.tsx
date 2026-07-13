import { render } from '@testing-library/react-native';
import StoreOwnerLayout from '../_layout';

jest.mock('expo-router', () => {
    const MockTabs = Object.assign(
        jest.fn(() => null),
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
});