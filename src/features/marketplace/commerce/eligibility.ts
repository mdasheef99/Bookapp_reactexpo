import { CommerceErrorCode } from './vocabulary';

export type EligibilityOperation =
    | 'cart_mutation'
    | 'submit_request'
    | 'owner_progression'
    | 'customer_acceptance'
    | 'customer_cancellation'
    | 'owner_support_request'
    | 'service_cleanup'
    | 'history_read';

export type EligibilityOutcome =
    | 'allow'
    | 'block_no_effects'
    | 'escalation_support'
    | 'cleanup_only'
    | 'history_only';

type StoreEligibility = {
    status: 'draft' | 'pending_verification' | 'approved_pending_setup' | 'active'
        | 'selling_restricted' | 'suspended' | 'closed' | 'rejected';
    verificationStatus: 'unverified' | 'pending' | 'approved' | 'rejected';
    setupStatus: 'incomplete' | 'complete';
    sellingStatus: 'not_allowed' | 'allowed' | 'restricted';
};

type RolloutEligibility = {
    marketplaceEnabled: boolean;
    cartOrderRequestEnabled: boolean;
    localityPilotEnabled: boolean;
    storeAllowlisted: boolean;
    pickupEnabled: boolean;
    deliveryEnabled: boolean;
};

export type CommerceEligibilityItem = {
    listingStatus: 'active' | 'owner_paused' | 'removed';
    moderationClear: boolean;
    belongsToDerivedStore: boolean;
    requestedQuantity: number;
    availableQuantity: number;
    pickupEligible: boolean;
    deliveryEligible: boolean;
    activeHoldValid?: boolean;
};

export type DeliveryPolicy = {
    minimumSubtotalMinor: number;
    fixedTariffMinor: number;
    freeThresholdMinor: number;
    version: number;
};

export type CommerceEligibilityContext = {
    operation: EligibilityOperation;
    store: StoreEligibility;
    subscriptionStatus: 'trialing' | 'active' | 'past_due' | 'grace_period'
        | 'restricted' | 'cancelled' | 'expired';
    commerceEntitled: boolean;
    cartEntitled: boolean;
    actorHasOwnerCapability: boolean;
    entitledOwnerAvailable: boolean;
    rollout: RolloutEligibility;
    items: CommerceEligibilityItem[];
    fulfillmentMethod: 'pickup' | 'delivery';
    subtotalMinor: number;
    deliveryPolicy: DeliveryPolicy | null;
};

export type CommerceEligibilityResult = {
    outcome: EligibilityOutcome;
    errorCode?: CommerceErrorCode;
    deliveryTariffMinor?: number;
    deliveryTariffVersion?: number;
};

const allowedSubscriptions = new Set([
    'trialing', 'active', 'past_due', 'grace_period',
]);

const blocked = (errorCode: CommerceErrorCode): CommerceEligibilityResult => ({
    outcome: 'block_no_effects',
    errorCode,
});

const storeCanProgress = (store: StoreEligibility): boolean => (
    store.status === 'active'
    && store.verificationStatus === 'approved'
    && store.setupStatus === 'complete'
    && store.sellingStatus === 'allowed'
);

const isValidPolicy = (policy: DeliveryPolicy): boolean => (
    Number.isInteger(policy.minimumSubtotalMinor)
    && Number.isInteger(policy.fixedTariffMinor)
    && Number.isInteger(policy.freeThresholdMinor)
    && Number.isInteger(policy.version)
    && policy.minimumSubtotalMinor >= 0
    && policy.fixedTariffMinor >= 0
    && policy.freeThresholdMinor >= policy.minimumSubtotalMinor
    && policy.version >= 1
);

function validateItems(context: CommerceEligibilityContext): CommerceEligibilityResult | null {
    if (context.items.length === 0) return blocked('COMMERCE_ENTITY_UNAVAILABLE');

    for (const item of context.items) {
        if (!item.belongsToDerivedStore || !item.moderationClear) {
            return blocked('COMMERCE_ENTITY_UNAVAILABLE');
        }
        const activeEnough = context.operation === 'cart_mutation'
            ? item.listingStatus === 'active'
            : item.listingStatus === 'active' || item.listingStatus === 'owner_paused';
        if (!activeEnough) return blocked('COMMERCE_ENTITY_UNAVAILABLE');

        const methodEligible = context.fulfillmentMethod === 'pickup'
            ? item.pickupEligible
            : item.deliveryEligible;
        if (!methodEligible) return blocked('INVALID_FULFILMENT');

        if (context.operation === 'customer_acceptance') {
            if (item.activeHoldValid !== true) return blocked('HOLD_EXPIRED');
        } else if (item.requestedQuantity <= 0 || item.availableQuantity < item.requestedQuantity) {
            return blocked('INSUFFICIENT_INVENTORY');
        }
    }
    return null;
}

function resolveDelivery(context: CommerceEligibilityContext): CommerceEligibilityResult {
    if (context.fulfillmentMethod === 'pickup') {
        return { outcome: 'allow', deliveryTariffMinor: 0 };
    }
    const policy = context.deliveryPolicy;
    if (!policy) return blocked('DELIVERY_TARIFF_UNAVAILABLE');
    if (!isValidPolicy(policy)) return blocked('POLICY_CONFIGURATION_INVALID');
    if (context.subtotalMinor < policy.minimumSubtotalMinor) {
        return blocked('INVALID_FULFILMENT');
    }
    return {
        outcome: 'allow',
        deliveryTariffMinor: context.subtotalMinor >= policy.freeThresholdMinor
            ? 0
            : policy.fixedTariffMinor,
        deliveryTariffVersion: policy.version,
    };
}

export function evaluateCommerceEligibility(
    context: CommerceEligibilityContext,
): CommerceEligibilityResult {
    if (context.operation === 'history_read') return { outcome: 'history_only' };
    if (context.operation === 'customer_cancellation' || context.operation === 'service_cleanup') {
        return { outcome: 'cleanup_only' };
    }
    if (context.operation === 'owner_support_request') {
        return context.actorHasOwnerCapability
            ? { outcome: 'escalation_support' }
            : blocked('STORE_COMMAND_NOT_ENTITLED');
    }

    if (!storeCanProgress(context.store)) return blocked('COMMERCE_ENTITY_UNAVAILABLE');
    if (!allowedSubscriptions.has(context.subscriptionStatus)) {
        return blocked('STORE_COMMAND_NOT_ENTITLED');
    }
    const entitlement = context.operation === 'cart_mutation'
        ? context.cartEntitled
        : context.commerceEntitled;
    if (!entitlement) return blocked('STORE_COMMAND_NOT_ENTITLED');
    if (context.operation === 'owner_progression' && !context.actorHasOwnerCapability) {
        return blocked('STORE_COMMAND_NOT_ENTITLED');
    }
    const rollout = context.rollout;
    if (!rollout.marketplaceEnabled || !rollout.cartOrderRequestEnabled
        || !rollout.localityPilotEnabled || !rollout.storeAllowlisted) {
        return blocked('COMMERCE_ROLLOUT_DISABLED');
    }
    if ((context.operation === 'submit_request' || context.operation === 'owner_progression')
        && !context.entitledOwnerAvailable) {
        return blocked('ENTITLED_OWNER_UNAVAILABLE');
    }
    if ((context.fulfillmentMethod === 'pickup' && !rollout.pickupEnabled)
        || (context.fulfillmentMethod === 'delivery' && !rollout.deliveryEnabled)) {
        return blocked('INVALID_FULFILMENT');
    }
    const itemFailure = validateItems(context);
    return itemFailure ?? resolveDelivery(context);
}
