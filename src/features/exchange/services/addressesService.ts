import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Address {
    id: string;
    user_id: string;
    name: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    is_default: boolean;
    created_at: string;
}

export interface CreateAddressInput {
    userId: string;
    name: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    isDefault?: boolean;
}

export interface UpdateAddressInput {
    name?: string;
    phone?: string;
    line1?: string;
    line2?: string | null;
    city?: string;
    state?: string;
    pincode?: string;
    is_default?: boolean;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const addressesService = {
    /**
     * Fetch all addresses for a user — default address first.
     */
    async getAddresses(userId: string): Promise<Address[]> {
        const { data, error } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data ?? []) as Address[];
    },

    /**
     * Fetch the single default address for a user. Returns null if none set.
     */
    async getDefaultAddress(userId: string): Promise<Address | null> {
        const { data, error } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .eq('is_default', true)
            .maybeSingle();

        if (error) throw error;
        return data as Address | null;
    },

    /**
     * Create a new address. If isDefault=true, clears existing defaults first.
     */
    async createAddress(input: CreateAddressInput): Promise<Address> {
        const { userId, name, phone, line1, line2, city, state, pincode, isDefault = false } = input;

        const { data, error } = await supabase
            .from('user_addresses')
            .insert({
                user_id: userId,
                name,
                phone,
                line1,
                line2: line2 ?? null,
                city,
                state,
                pincode,
                is_default: false,
            })
            .select()
            .single();

        if (error) throw error;

        if (isDefault) {
            await addressesService.setDefaultAddress(userId, data.id);
            return { ...data, is_default: true } as Address;
        }

        return data as Address;
    },

    /**
     * Update an existing address by id.
     */
    async updateAddress(id: string, input: UpdateAddressInput): Promise<Address> {
        const { is_default: shouldSetDefault, ...fields } = input;
        const updatePayload = shouldSetDefault === true ? fields : input;
        const hasAddressFields = Object.keys(updatePayload).length > 0;

        const { data, error } = hasAddressFields
            ? await supabase
                .from('user_addresses')
                .update(updatePayload)
                .eq('id', id)
                .select()
                .single()
            : await supabase
                .from('user_addresses')
                .select()
                .eq('id', id)
                .single();

        if (error) throw error;

        if (shouldSetDefault === true) {
            await addressesService.setDefaultAddress(data.user_id, id);
            return { ...data, is_default: true } as Address;
        }

        return data as Address;
    },

    /**
     * Delete an address by id.
     */
    async deleteAddress(id: string): Promise<void> {
        const { error } = await supabase
            .from('user_addresses')
            .delete()
            .eq('id', id);

        if (error) throw error;
    },

    /**
     * Set one address as the default, clearing is_default on all others for the user.
     */
    async setDefaultAddress(userId: string, addressId: string): Promise<void> {
        const { error } = await supabase.rpc('set_default_user_address', {
            p_user_id: userId,
            p_address_id: addressId,
        });

        if (error) throw error;
    },
};

