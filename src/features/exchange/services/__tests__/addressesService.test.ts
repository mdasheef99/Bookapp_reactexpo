jest.mock('@/lib/supabase');

import { supabase } from '@/lib/supabase';
import { addressesService } from '../addressesService';

function mockQuery(response: Record<string, unknown>) {
    const builder: any = {};
    ['select', 'insert', 'update', 'eq', 'single'].forEach((method) => {
        builder[method] = jest.fn(() => builder);
    });
    builder.then = jest.fn((resolve: (value: unknown) => unknown) => resolve(response));
    return builder;
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('addressesService default address handling', () => {
    it('creates a requested default address through the atomic default-address RPC', async () => {
        const insertBuilder = mockQuery({
            data: {
                id: 'address-1',
                user_id: 'reader-1',
                name: 'Home',
                phone: '9876543210',
                line1: 'Flat 4',
                line2: null,
                city: 'Delhi',
                state: 'Delhi',
                pincode: '110001',
                is_default: false,
                created_at: '2026-05-22T05:30:00.000Z',
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(insertBuilder);
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

        const address = await addressesService.createAddress({
            userId: 'reader-1',
            name: 'Home',
            phone: '9876543210',
            line1: 'Flat 4',
            city: 'Delhi',
            state: 'Delhi',
            pincode: '110001',
            isDefault: true,
        });

        expect(insertBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
            user_id: 'reader-1',
            is_default: false,
        }));
        expect(supabase.rpc).toHaveBeenCalledWith('set_default_user_address', {
            p_user_id: 'reader-1',
            p_address_id: 'address-1',
        });
        expect(address.is_default).toBe(true);
    });

    it('sets the default address through the atomic default-address RPC', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

        await addressesService.setDefaultAddress('reader-1', 'address-2');

        expect(supabase.rpc).toHaveBeenCalledWith('set_default_user_address', {
            p_user_id: 'reader-1',
            p_address_id: 'address-2',
        });
    });

    it('promotes an edited address through the atomic default-address RPC', async () => {
        const updateBuilder = mockQuery({
            data: {
                id: 'address-3',
                user_id: 'reader-1',
                name: 'Updated Home',
                phone: '9876543210',
                line1: 'Flat 5',
                line2: null,
                city: 'Delhi',
                state: 'Delhi',
                pincode: '110001',
                is_default: false,
                created_at: '2026-05-22T05:30:00.000Z',
            },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(updateBuilder);
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

        const address = await addressesService.updateAddress('address-3', {
            name: 'Updated Home',
            is_default: true,
        });

        expect(updateBuilder.update).toHaveBeenCalledWith({ name: 'Updated Home' });
        expect(supabase.rpc).toHaveBeenCalledWith('set_default_user_address', {
            p_user_id: 'reader-1',
            p_address_id: 'address-3',
        });
        expect(address.is_default).toBe(true);
    });
});
