import { render } from '@testing-library/react-native';
import StoreOwnerInventoryRoute from '../inventory';
import { InventoryHubFoundationScreen } from '@/features/imageInventory/screens/InventoryFoundationScreens';

jest.mock('@/features/imageInventory/screens/InventoryFoundationScreens', () => ({
    InventoryHubFoundationScreen: jest.fn(() => null),
}));

describe('Store Owner inventory route', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders the guarded nested Inventory hub', () => {
        render(<StoreOwnerInventoryRoute />);

        expect(InventoryHubFoundationScreen).toHaveBeenCalled();
    });
});
