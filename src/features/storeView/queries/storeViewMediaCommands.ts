import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { createCaptureAttempt } from '@/features/imageInventory/capture/captureIds';
import type { ImageInventoryIdentity } from '@/features/imageInventory/queries/ownerUxQueries';
import { storeViewMediaService } from '../api/storeViewMediaService';
import { storeViewKeys } from './storeViewQueries';
import { storeViewHistoryKeys } from './storeViewHistoryQueries';
import { storeViewMediaKeys } from './storeViewMediaQueries';

type ReorderCommand = Readonly<{
    kind: 'reorder';
    inventoryId: string;
    inventoryVersion: number;
    orderedLinkIds: string[];
}>;

type RemoveCommand = Readonly<{
    kind: 'remove';
    inventoryId: string;
    inventoryVersion: number;
    linkId: string;
}>;

type ReplaceCommand = Readonly<{
    kind: 'replace';
    inventoryId: string;
    inventoryVersion: number;
    capabilityId: string;
    mediaAssetId: string;
    targetLinkId: string;
}>;

export type StoreViewMediaCommand = ReorderCommand | RemoveCommand | ReplaceCommand;

export function useStoreViewMediaCommands(identity: ImageInventoryIdentity) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (command: StoreViewMediaCommand) => {
            if (!onlineManager.isOnline()) {
                throw new Error('Photo changes require a connection.');
            }
            const attempt = createCaptureAttempt(`store-view-${command.kind}`);
            const common = {
                inventoryId: command.inventoryId,
                expectedInventoryVersion: command.inventoryVersion,
                idempotencyKey: attempt.key,
                commandId: attempt.commandId,
            };
            if (command.kind === 'reorder') {
                return storeViewMediaService.reorder({ ...common, orderedLinkIds: command.orderedLinkIds });
            }
            if (command.kind === 'remove') {
                return storeViewMediaService.remove({ ...common, linkId: command.linkId });
            }
            return storeViewMediaService.replace({
                ...common,
                capabilityId: command.capabilityId,
                mediaAssetId: command.mediaAssetId,
                targetLinkId: command.targetLinkId,
            });
        },
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: storeViewKeys.all });
            await client.invalidateQueries({ queryKey: storeViewMediaKeys.all });
            await client.invalidateQueries({ queryKey: storeViewHistoryKeys.all });
        },
        retry: false,
    });
}
