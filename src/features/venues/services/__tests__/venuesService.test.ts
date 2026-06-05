jest.mock('@/lib/supabase');

import { venuesService } from '../venuesService';
import { supabase } from '@/lib/supabase';

function mockQuery(response: Record<string, any>) {
    const builder: any = {};
    const methods = ['select', 'eq', 'ilike', 'or', 'order', 'range', 'single'];
    methods.forEach((method) => { builder[method] = jest.fn(() => builder); });
    builder.then = jest.fn((resolve: any) => resolve(response));
    return builder;
}

function expectExplicitSelect(builder: any, expectedColumn: string) {
    const selectArg = builder.select.mock.calls[0]?.[0];
    expect(selectArg).toEqual(expect.stringContaining(expectedColumn));
    expect(selectArg).not.toContain('*');
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe('venuesService', () => {
    it('reads approved venues with city, type, search, and pagination filters', async () => {
        const builder = mockQuery({
            data: [{ id: 'venue-1', name: 'Central Library', city: 'Bengaluru', venue_type: 'library', verification_status: 'approved' }],
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await venuesService.getApprovedVenues({
            city: 'Bengaluru',
            venueType: 'library',
            search: 'Central',
            limit: 12,
            offset: 6,
        });

        expect(supabase.from).toHaveBeenCalledWith('venues');
        expectExplicitSelect(builder, 'operating_hours');
        expect(builder.eq).toHaveBeenCalledWith('verification_status', 'approved');
        expect(builder.eq).toHaveBeenCalledWith('city', 'Bengaluru');
        expect(builder.eq).toHaveBeenCalledWith('venue_type', 'library');
        expect(builder.or).toHaveBeenCalledWith('name.ilike.%Central%,description.ilike.%Central%,address_line1.ilike.%Central%,address_line2.ilike.%Central%,city.ilike.%Central%');
        expect(builder.range).toHaveBeenCalledWith(6, 17);
        expect(result[0].name).toBe('Central Library');
    });

    it('sanitizes venue search terms before building the PostgREST or filter', async () => {
        const builder = mockQuery({ data: [], error: null });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        await venuesService.getApprovedVenues({ search: ' Central),name.ilike.%% ' });

        expect(builder.or).toHaveBeenCalledWith('name.ilike.%Central name ilike%,description.ilike.%Central name ilike%,address_line1.ilike.%Central name ilike%,address_line2.ilike.%Central name ilike%,city.ilike.%Central name ilike%');
    });

    it('reads a single approved venue by id', async () => {
        const builder = mockQuery({
            data: { id: 'venue-1', name: 'Central Library', verification_status: 'approved' },
            error: null,
        });
        (supabase.from as jest.Mock).mockReturnValueOnce(builder);

        const result = await venuesService.getVenueById('venue-1');

        expect(supabase.from).toHaveBeenCalledWith('venues');
        expect(builder.eq).toHaveBeenCalledWith('id', 'venue-1');
        expect(builder.eq).toHaveBeenCalledWith('verification_status', 'approved');
        expect(builder.single).toHaveBeenCalled();
        expect(result.id).toBe('venue-1');
    });
});
