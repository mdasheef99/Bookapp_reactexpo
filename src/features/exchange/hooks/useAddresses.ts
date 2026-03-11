import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    addressesService,
    type CreateAddressInput,
    type UpdateAddressInput,
} from '../services/addressesService';

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const addressKeys = {
    all: ['addresses'] as const,
    list: (userId: string) => [...addressKeys.all, 'list', userId] as const,
    default: (userId: string) => [...addressKeys.all, 'default', userId] as const,
};

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Get all addresses for a user (default address first).
 */
export function useAddresses(userId: string | null) {
    return useQuery({
        queryKey: addressKeys.list(userId ?? ''),
        queryFn: () => addressesService.getAddresses(userId!),
        enabled: !!userId,
    });
}

/**
 * Get the default address for a user. Returns null if none set.
 */
export function useDefaultAddress(userId: string | null) {
    return useQuery({
        queryKey: addressKeys.default(userId ?? ''),
        queryFn: () => addressesService.getDefaultAddress(userId!),
        enabled: !!userId,
    });
}

/**
 * Mutation to create a new address.
 * Invalidates address list and default on success.
 */
export function useCreateAddress() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (input: CreateAddressInput) => addressesService.createAddress(input),
        onSuccess: (_data, vars) => {
            queryClient.invalidateQueries({ queryKey: addressKeys.list(vars.userId) });
            queryClient.invalidateQueries({ queryKey: addressKeys.default(vars.userId) });
        },
    });
}

/**
 * Mutation to update an existing address.
 * Invalidates all address queries on success.
 */
export function useUpdateAddress() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: UpdateAddressInput }) =>
            addressesService.updateAddress(id, input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addressKeys.all });
        },
    });
}

/**
 * Mutation to delete an address.
 * Invalidates all address queries on success.
 */
export function useDeleteAddress() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => addressesService.deleteAddress(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: addressKeys.all });
        },
    });
}

/**
 * Mutation to set an address as the user's default.
 * Invalidates address list and default on success.
 */
export function useSetDefaultAddress() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ userId, addressId }: { userId: string; addressId: string }) =>
            addressesService.setDefaultAddress(userId, addressId),
        onSuccess: (_data, { userId }) => {
            queryClient.invalidateQueries({ queryKey: addressKeys.list(userId) });
            queryClient.invalidateQueries({ queryKey: addressKeys.default(userId) });
        },
    });
}

