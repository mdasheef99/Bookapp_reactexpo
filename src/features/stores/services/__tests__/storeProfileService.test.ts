import { supabase } from '@/lib/supabase';
import { storeProfileService, RETURN_POLICY_TYPES, OPERATING_HOURS_DAYS } from '../storeProfileService';

jest.mock('@/lib/supabase');

function createBuilder(response: { data: unknown; error: Error | null }) {
    const builder: any = {
        select: jest.fn(() => builder),
        eq: jest.fn(() => builder),
        single: jest.fn(() => Promise.resolve(response)),
        maybeSingle: jest.fn(() => Promise.resolve(response)),
        update: jest.fn(() => builder),
        then: jest.fn((resolve: any) => resolve({ data: response.data, error: response.error })),
    };
    return builder;
}

const MOCK_STORE_ID = 'test-store-1';

const MOCK_DB_PROFILE = {
    id: MOCK_STORE_ID,
    display_name: 'My Bookstore',
    description: 'A cozy bookstore',
    logo_url: 'https://example.com/logo.png',
    cover_url: 'https://example.com/cover.png',
    operating_hours: {
        monday: { open: '09:00', close: '18:00', closed: false },
        tuesday: { open: '09:00', close: '18:00', closed: false },
        wednesday: { open: '09:00', close: '18:00', closed: false },
        thursday: { open: '09:00', close: '18:00', closed: false },
        friday: { open: '09:00', close: '18:00', closed: false },
        saturday: { open: '10:00', close: '17:00', closed: false },
        sunday: { open: '10:00', close: '16:00', closed: false },
        temporary_closure: false,
    },
    pickup_enabled: true,
    delivery_enabled: false,
    minimum_delivery_order_value_minor: null,
    return_policy_type: 'returns_within_7_days',
    payout_account_status: 'verified',
};

const EXPECTED_CAMEL_PROFILE = {
    storeId: MOCK_STORE_ID,
    displayName: 'My Bookstore',
    description: 'A cozy bookstore',
    logoUrl: 'https://example.com/logo.png',
    coverUrl: 'https://example.com/cover.png',
    operatingHours: MOCK_DB_PROFILE.operating_hours,
    pickupEnabled: true,
    deliveryEnabled: false,
    minimumDeliveryOrderValueMinor: null,
    returnPolicyType: 'returns_within_7_days',
    payoutAccountStatus: 'verified',
};

describe('storeProfileService', () => {
    beforeEach(() => { jest.clearAllMocks(); });

    describe('getProfile', () => {
        it('queries stores table by storeId and returns camelCase StoreProfile', async () => {
            const builder = createBuilder({ data: MOCK_DB_PROFILE, error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            const result = await storeProfileService.getProfile(MOCK_STORE_ID);

            expect(supabase.from).toHaveBeenCalledWith('stores');
            expect(builder.select).toHaveBeenCalled();
            expect(builder.eq).toHaveBeenCalledWith('id', MOCK_STORE_ID);
            expect(builder.single).toHaveBeenCalled();
            expect(result).toEqual(EXPECTED_CAMEL_PROFILE);
        });

        it('throws if store is not found', async () => {
            const builder = createBuilder({ data: null, error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await expect(storeProfileService.getProfile(MOCK_STORE_ID))
                .rejects.toThrow('Store not found');
        });

        it('throws on database error', async () => {
            const dbError = new Error('Database connection failed');
            const builder = createBuilder({ data: null, error: dbError });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await expect(storeProfileService.getProfile(MOCK_STORE_ID))
                .rejects.toThrow('Database connection failed');
        });

        it('never selects private columns like internal_notes', async () => {
            const builder = createBuilder({ data: MOCK_DB_PROFILE, error: null });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await storeProfileService.getProfile(MOCK_STORE_ID);

            const selectArg = (builder.select as jest.Mock).mock.calls[0][0];
            expect(selectArg).not.toContain('internal_notes');
            expect(selectArg).not.toContain('seller_agreement');
            expect(selectArg).toContain('display_name');
            expect(selectArg).toContain('operating_hours');
            expect(selectArg).toContain('return_policy_type');
        });
    });

    describe('updateProfile', () => {
        it('updates stores table with provided fields and returns updated profile', async () => {
            const updateBuilder = createBuilder({ data: null, error: null });
            const getBuilder = createBuilder({ data: MOCK_DB_PROFILE, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(updateBuilder)
                .mockReturnValueOnce(getBuilder);

            const result = await storeProfileService.updateProfile(MOCK_STORE_ID, {
                displayName: 'My Bookstore',
                description: 'A cozy bookstore',
            });

            expect(updateBuilder.update).toHaveBeenCalledWith({
                display_name: 'My Bookstore',
                description: 'A cozy bookstore',
            });
            expect(updateBuilder.eq).toHaveBeenCalledWith('id', MOCK_STORE_ID);
            expect(result).toEqual(EXPECTED_CAMEL_PROFILE);
        });

        it('rejects invalid return_policy_type', async () => {
            await expect(storeProfileService.updateProfile(MOCK_STORE_ID, {
                returnPolicyType: 'invalid_policy',
            })).rejects.toThrow('Invalid return_policy_type');
        });

        it('rejects operating_hours missing required day keys', async () => {
            await expect(storeProfileService.updateProfile(MOCK_STORE_ID, {
                operatingHours: {
                    monday: { open: '09:00', close: '18:00', closed: false },
                    temporary_closure: false,
                },
            })).rejects.toThrow('operating_hours must include all 7 days');
        });

        it('rejects operating_hours where a day entry is missing open/close/closed', async () => {
            await expect(storeProfileService.updateProfile(MOCK_STORE_ID, {
                operatingHours: {
                    monday: { open: '09:00', close: '18:00', closed: false },
                    tuesday: { open: '09:00', close: '18:00', closed: false },
                    wednesday: { open: '09:00', close: '18:00', closed: false },
                    thursday: { open: '09:00', close: '18:00', closed: false },
                    friday: { open: '09:00', close: '18:00', closed: false },
                    saturday: { open: '10:00', close: '17:00', closed: false },
                    sunday: { open: null, close: null, closed: true },
                },
            })).rejects.toThrow('operating_hours must include temporary_closure');
        });

        it('rejects operating_hours with non-boolean temporary_closure', async () => {
            await expect(storeProfileService.updateProfile(MOCK_STORE_ID, {
                operatingHours: {
                    monday: { open: '09:00', close: '18:00', closed: false },
                    tuesday: { open: '09:00', close: '18:00', closed: false },
                    wednesday: { open: '09:00', close: '18:00', closed: false },
                    thursday: { open: '09:00', close: '18:00', closed: false },
                    friday: { open: '09:00', close: '18:00', closed: false },
                    saturday: { open: '10:00', close: '17:00', closed: false },
                    sunday: { open: '10:00', close: '16:00', closed: false },
                    temporary_closure: 'yes',
                },
            })).rejects.toThrow('temporary_closure must be a boolean');
        });

        it('rejects operating_hours with missing open time on an open day', async () => {
            await expect(storeProfileService.updateProfile(MOCK_STORE_ID, {
                operatingHours: {
                    monday: { open: '09:00', close: '18:00', closed: false },
                    tuesday: { open: '09:00', close: '18:00', closed: false },
                    wednesday: { open: '', close: '18:00', closed: false },
                    thursday: { open: '09:00', close: '18:00', closed: false },
                    friday: { open: '09:00', close: '18:00', closed: false },
                    saturday: { open: '10:00', close: '17:00', closed: false },
                    sunday: { open: '10:00', close: '16:00', closed: false },
                    temporary_closure: false,
                },
            })).rejects.toThrow(/mismatch|required|invalid|operating_hours/i);
        });

        it('accepts valid operating_hours with closed days using null times', async () => {
            const updateBuilder = createBuilder({ data: null, error: null });
            const getBuilder = createBuilder({ data: MOCK_DB_PROFILE, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(updateBuilder)
                .mockReturnValueOnce(getBuilder);

            const result = await storeProfileService.updateProfile(MOCK_STORE_ID, {
                operatingHours: MOCK_DB_PROFILE.operating_hours,
            });

            expect(result).toEqual(EXPECTED_CAMEL_PROFILE);
        });

        it('accepts valid return_policy_type values', async () => {
            const updateBuilder = createBuilder({ data: null, error: null });
            const getBuilder = createBuilder({ data: MOCK_DB_PROFILE, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(updateBuilder)
                .mockReturnValueOnce(getBuilder);

            const result = await storeProfileService.updateProfile(MOCK_STORE_ID, {
                returnPolicyType: 'no_returns_except_wrong_item',
            });

            expect(result).toEqual(EXPECTED_CAMEL_PROFILE);
        });

        it('converts camelCase input to snake_case for the DB update', async () => {
            const updateBuilder = createBuilder({ data: null, error: null });
            const getBuilder = createBuilder({ data: MOCK_DB_PROFILE, error: null });

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(updateBuilder)
                .mockReturnValueOnce(getBuilder);

            await storeProfileService.updateProfile(MOCK_STORE_ID, {
                displayName: 'Updated Name',
                pickupEnabled: true,
                deliveryEnabled: true,
            });

            expect(updateBuilder.update).toHaveBeenCalledWith({
                display_name: 'Updated Name',
                pickup_enabled: true,
                delivery_enabled: true,
            });
        });

        it('throws on database update error', async () => {
            const dbError = new Error('Update failed');
            const builder = createBuilder({ data: null, error: dbError });
            (supabase.from as jest.Mock).mockReturnValue(builder);

            await expect(storeProfileService.updateProfile(MOCK_STORE_ID, {
                displayName: 'Updated',
            })).rejects.toThrow('Update failed');
        });
    });

    describe('constants', () => {
        it('exports RETURN_POLICY_TYPES with expected values', () => {
            expect(RETURN_POLICY_TYPES).toEqual([
                'no_returns',
                'no_returns_except_wrong_item',
                'returns_within_3_days',
                'returns_within_7_days',
            ]);
        });

        it('exports OPERATING_HOURS_DAYS with all 7 weekdays', () => {
            expect(OPERATING_HOURS_DAYS).toEqual([
                'monday', 'tuesday', 'wednesday', 'thursday',
                'friday', 'saturday', 'sunday',
            ]);
        });
    });
});
