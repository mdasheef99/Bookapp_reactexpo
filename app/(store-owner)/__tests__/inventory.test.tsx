import { render } from '@testing-library/react-native';
import StoreOwnerInventoryRoute from '../inventory';
import StoreInventoryScreen from '@/features/stores/screens/StoreInventoryScreen';

jest.mock('@/features/stores/screens/StoreInventoryScreen', () => jest.fn(() => null));

describe('Store Owner inventory route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the Store Inventory screen', () => {
        render(<StoreOwnerInventoryRoute />);

        expect(StoreInventoryScreen).toHaveBeenCalled();
    });
});
