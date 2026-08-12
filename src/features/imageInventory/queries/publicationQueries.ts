import { onlineManager, useMutation, useQueryClient } from '@tanstack/react-query';
import { createCaptureUuid, createSemanticKey } from '../capture/captureIds';
import { publicationService, type PublicationIntent } from '../api/publicationService';
import { ownerInventoryReadKeys } from './ownerInventoryReadQueries';
import { imageInventoryKeys, type ImageInventoryIdentity } from './ownerUxQueries';

type Command = Readonly<{
    inventoryId: string;
    inventoryVersion: number;
    publicationIntentVersion: number;
    intent: PublicationIntent | 'retry';
}>;

export function usePublicationCommands(identity: ImageInventoryIdentity) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: async (command: Command) => {
            if (!onlineManager.isOnline()) throw new Error('Publication commands require a connection.');
            const identitySuffix = `${command.inventoryId}:${command.publicationIntentVersion}`;
            const common = {
                inventoryId: command.inventoryId,
                expectedPublicationIntentVersion: command.publicationIntentVersion,
                idempotencyKey: `${createSemanticKey(`publication-${command.intent}`)}:${identitySuffix}`.slice(0, 128),
                commandId: createCaptureUuid(),
            };
            return command.intent === 'retry'
                ? publicationService.retry(common)
                : publicationService.setState({
                    ...common,
                    expectedInventoryVersion: command.inventoryVersion,
                    intent: command.intent,
                });
        },
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ownerInventoryReadKeys.all });
            await client.invalidateQueries({ queryKey: imageInventoryKeys.all });
            await client.invalidateQueries({ queryKey: ['marketplace'] });
        },
        retry: false,
    });
}
