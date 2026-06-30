import { render } from '@testing-library/react-native';
import StorefrontRoute from '../storefront';
import StoreProfileScreen from '@/features/stores/screens/StoreProfileScreen';

jest.mock('@/features/stores/screens/StoreProfileScreen', () => jest.fn(() => null));

describe('Store Owner storefront route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the Store Profile screen', () => {
        render(<StorefrontRoute />);

        expect(StoreProfileScreen).toHaveBeenCalled();
    });
});