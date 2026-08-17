import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { createCaptureAttempt } from '@/features/imageInventory/capture/captureIds';
import { ownerInventoryReadKeys } from '@/features/imageInventory/queries/ownerInventoryReadQueries';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { storeViewManagementService } from '../api/storeViewManagementService';
import type { StoreViewChanges } from '../contracts/storeViewManagementContracts';
import { storeViewKeys } from './storeViewQueries';

type SaveCommand = Readonly<{
    kind: 'save';
    inventoryId: string;
    inventoryVersion: number;
    changes: StoreViewChanges;
}>;

type StockCommand = Readonly<{
    kind: 'stock';
    inventoryId: string;
    inventoryVersion: number;
    delta: number;
}>;

export type StoreViewManagementCommand = SaveCommand | StockCommand;

export function useStoreViewManagementCommands(identity: ImageInventoryIdentity) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (command: StoreViewManagementCommand) => {
            if (!onlineManager.isOnline()) {
                throw new Error('Store View changes require a connection.');
            }
            const attempt = createCaptureAttempt(
                command.kind === 'save' ? 'store-view-save' : 'store-view-stock',
            );
            const common = {
                inventoryId: command.inventoryId,
                expectedInventoryVersion: command.inventoryVersion,
                idempotencyKey: attempt.key,
                commandId: attempt.commandId,
            };
            return command.kind === 'save'
                ? storeViewManagementService.save({ ...common, changes: command.changes })
                : storeViewManagementService.adjustStock({ ...common, delta: command.delta });
        },
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: storeViewKeys.all });
            await client.invalidateQueries({ queryKey: ownerInventoryReadKeys.all });
        },
        retry: false,
    });
}
