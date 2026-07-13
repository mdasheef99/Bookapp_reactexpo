/**
 * Marketplace disclosure copy for Phase 5 Consumer Discovery.
 *
 * These messages are displayed to consumers before any checkout/payment
 * interaction. Phase 5 does NOT implement cart/order/payment — these
 * disclosures are shown on the marketplace surface so customers understand
 * the marketplace model before Phase 6 (order request) is built.
 */

export const MARKETPLACE_DISCLOSURES = {
    confirmationBeforePayment:
        'Bookstore confirms availability before payment. You will not be charged until the store accepts your request.',
    sellerStorePolicy:
        'Each bookstore sets its own pickup, delivery, and return policies. Review store policies before requesting.',
    supportPositioning:
        'BookConnect facilitates the marketplace and provides support for disputes, refunds, and grievances.',
    availabilityDisclaimer:
        'Listed inventory is visible because the store uploaded it, but availability is not guaranteed until the store confirms.',
} as const;

export const CONFIRMATION_BEFORE_PAYMENT_MESSAGE = MARKETPLACE_DISCLOSURES.confirmationBeforePayment;
export const SELLER_STORE_POLICY_MESSAGE = MARKETPLACE_DISCLOSURES.sellerStorePolicy;
export const SUPPORT_POSITIONING_MESSAGE = MARKETPLACE_DISCLOSURES.supportPositioning;
export const AVAILABILITY_DISCLAIMER_MESSAGE = MARKETPLACE_DISCLOSURES.availabilityDisclaimer;
