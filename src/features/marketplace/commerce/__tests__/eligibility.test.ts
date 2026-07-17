import {
    CommerceEligibilityContext,
    evaluateCommerceEligibility,
} from '../eligibility';

const eligible = (overrides: Partial<CommerceEligibilityContext> = {}): CommerceEligibilityContext => ({
    operation: 'submit_request',
    store: {
        status: 'active',
        verificationStatus: 'approved',
        setupStatus: 'complete',
        sellingStatus: 'allowed',
    },
    subscriptionStatus: 'active',
    commerceEntitled: true,
    cartEntitled: true,
    actorHasOwnerCapability: true,
    entitledOwnerAvailable: true,
    rollout: {
        marketplaceEnabled: true,
        cartOrderRequestEnabled: true,
        localityPilotEnabled: true,
        storeAllowlisted: true,
        pickupEnabled: true,
        deliveryEnabled: true,
    },
    items: [{
        listingStatus: 'active',
        moderationClear: true,
        belongsToDerivedStore: true,
        requestedQuantity: 1,
        availableQuantity: 2,
        pickupEligible: true,
        deliveryEligible: true,
    }],
    fulfillmentMethod: 'pickup',
    subtotalMinor: 1000,
    deliveryPolicy: {
        minimumSubtotalMinor: 500,
        fixedTariffMinor: 100,
        freeThresholdMinor: 2000,
        version: 1,
    },
    ...overrides,
});

describe('Phase 6 canonical policy and eligibility resolver', () => {
    it.each(['trialing', 'active', 'past_due', 'grace_period'] as const)(
        'allows the %s subscription status',
        (subscriptionStatus) => {
            expect(evaluateCommerceEligibility(eligible({ subscriptionStatus }))).toMatchObject({
                outcome: 'allow',
            });
        },
    );

    it('fails closed in deterministic store, subscription, rollout, and owner order', () => {
        expect(evaluateCommerceEligibility(eligible({
            store: { ...eligible().store, verificationStatus: 'pending' },
            subscriptionStatus: 'cancelled',
            entitledOwnerAvailable: false,
        }))).toMatchObject({ errorCode: 'COMMERCE_ENTITY_UNAVAILABLE' });

        expect(evaluateCommerceEligibility(eligible({ subscriptionStatus: 'cancelled' })))
            .toMatchObject({ errorCode: 'STORE_COMMAND_NOT_ENTITLED' });
        expect(evaluateCommerceEligibility(eligible({
            rollout: { ...eligible().rollout, localityPilotEnabled: false },
        }))).toMatchObject({ errorCode: 'COMMERCE_ROLLOUT_DISABLED' });
        expect(evaluateCommerceEligibility(eligible({ entitledOwnerAvailable: false })))
            .toMatchObject({ errorCode: 'ENTITLED_OWNER_UNAVAILABLE' });
    });

    it('permits owner-paused listings for submission but not cart mutation', () => {
        const items = [{ ...eligible().items[0], listingStatus: 'owner_paused' as const }];
        expect(evaluateCommerceEligibility(eligible({ items }))).toMatchObject({ outcome: 'allow' });
        expect(evaluateCommerceEligibility(eligible({ operation: 'cart_mutation', items })))
            .toMatchObject({ outcome: 'block_no_effects', errorCode: 'COMMERCE_ENTITY_UNAVAILABLE' });
    });

    it('rejects manager/staff-equivalent owner commands and missing inventory', () => {
        expect(evaluateCommerceEligibility(eligible({
            operation: 'owner_progression',
            actorHasOwnerCapability: false,
        }))).toMatchObject({ errorCode: 'STORE_COMMAND_NOT_ENTITLED' });
        expect(evaluateCommerceEligibility(eligible({
            items: [{ ...eligible().items[0], availableQuantity: 0 }],
        }))).toMatchObject({ errorCode: 'INSUFFICIENT_INVENTORY' });
    });

    it('derives the fixed/free BookConnect delivery tariff and validates fulfilment', () => {
        expect(evaluateCommerceEligibility(eligible({ fulfillmentMethod: 'delivery' })))
            .toMatchObject({ outcome: 'allow', deliveryTariffMinor: 100, deliveryTariffVersion: 1 });
        expect(evaluateCommerceEligibility(eligible({
            fulfillmentMethod: 'delivery',
            subtotalMinor: 2000,
        }))).toMatchObject({ deliveryTariffMinor: 0 });
        expect(evaluateCommerceEligibility(eligible({
            fulfillmentMethod: 'delivery',
            subtotalMinor: 400,
        }))).toMatchObject({ errorCode: 'INVALID_FULFILMENT' });
        expect(evaluateCommerceEligibility(eligible({
            fulfillmentMethod: 'delivery',
            deliveryPolicy: null,
        }))).toMatchObject({ errorCode: 'DELIVERY_TARIFF_UNAVAILABLE' });
    });

    it('keeps history, customer cancellation, cleanup, and owner support available', () => {
        const ineligible = {
            store: { ...eligible().store, status: 'suspended' as const },
            subscriptionStatus: 'cancelled' as const,
            rollout: { ...eligible().rollout, marketplaceEnabled: false },
        };
        expect(evaluateCommerceEligibility(eligible({ operation: 'history_read', ...ineligible })))
            .toMatchObject({ outcome: 'history_only' });
        expect(evaluateCommerceEligibility(eligible({ operation: 'customer_cancellation', ...ineligible })))
            .toMatchObject({ outcome: 'cleanup_only' });
        expect(evaluateCommerceEligibility(eligible({ operation: 'service_cleanup', ...ineligible })))
            .toMatchObject({ outcome: 'cleanup_only' });
        expect(evaluateCommerceEligibility(eligible({ operation: 'owner_support_request', ...ineligible })))
            .toMatchObject({ outcome: 'escalation_support' });
    });
});
