import { z } from 'zod';
import type {
    BookstoreSearchPage,
    PublicListingDetail,
    StorefrontCataloguePage,
} from '../types';

const condition = z.enum(['new', 'like_new', 'very_good', 'good', 'acceptable']);
const availability = z.enum(['available', 'low_stock', 'confirmation_required']);
const returnPolicy = z.enum([
    'no_returns',
    'no_returns_except_wrong_item',
    'returns_within_3_days',
    'returns_within_7_days',
]);
const pageInfo = z.object({
    nextCursor: z.string().min(1).nullable(),
    hasNextPage: z.boolean(),
}).strict();
const bookstore = z.object({
    publicStoreId: z.string().uuid(),
    displayName: z.string().trim().min(1),
    logo: z.string().nullable(),
    locality: z.string().nullable(),
    city: z.string().nullable(),
    state: z.string().nullable(),
    pickup: z.boolean(),
    delivery: z.boolean(),
    returnPolicy,
}).strict();
const titlePresentation = z.object({
    originalTitle: z.string().trim().min(1),
    authors: z.array(z.string()),
    language: z.string().nullable(),
    publicIsbn: z.string().nullable(),
    cover: z.string().min(1),
}).strict();
const storefrontOffer = z.object({
    listingId: z.string().uuid(),
    priceMinor: z.number().int().positive(),
    currency: z.literal('INR'),
    condition,
    hasDamage: z.boolean(),
    publicDamageNote: z.string().nullable(),
    damageTypes: z.array(z.string()),
    availabilityStatus: availability,
    fulfillmentOptions: z.array(z.string()),
    confirmationBeforePayment: z.literal(true),
}).strict();
const titleGroup = z.object({
    safeTitlePresentation: titlePresentation,
    offers: z.array(storefrontOffer).min(1),
}).strict();

const operatingTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const operatingDay = z.union([
    z.object({ open: operatingTime, close: operatingTime, closed: z.literal(false) }).strict(),
    z.object({ open: z.null(), close: z.null(), closed: z.literal(true) }).strict(),
]);
const completeOperatingHours = z.object({
    monday: operatingDay,
    tuesday: operatingDay,
    wednesday: operatingDay,
    thursday: operatingDay,
    friday: operatingDay,
    saturday: operatingDay,
    sunday: operatingDay,
    temporary_closure: z.boolean(),
}).strict();
const publicOperatingHours = z.union([
    z.object({}).strict(),
    completeOperatingHours,
]);

const q08Schema = z.object({
    contractVersion: z.literal('phase9-q08-v1'),
    rankingVersion: z.literal('phase9-q08-ranking-v1'),
    bookstoreCount: z.number().int().nonnegative(),
    items: z.array(z.object({
        store: bookstore,
        matchedBook: titlePresentation.extend({
            matchContext: z.string().min(1),
            boundedMatchKind: z.string().min(1),
        }).omit({ publicIsbn: true }).extend({ publicIsbn: z.string().nullable() }).strict(),
        offerSummary: z.object({
            offerCount: z.number().int().positive(),
            lowestPriceMinor: z.number().int().positive(),
            currency: z.literal('INR'),
            conditionSummary: z.object({
                best: condition,
                worst: condition,
                distinct: z.array(condition).min(1),
            }).strict(),
            damageSummary: z.object({
                hasUndamagedOffers: z.boolean(),
                hasDamagedOffers: z.boolean(),
            }).strict(),
            fulfillmentSummary: z.object({
                pickupOfferCount: z.number().int().nonnegative(),
                deliveryOfferCount: z.number().int().nonnegative(),
            }).strict(),
            availabilityBand: availability,
            confirmationBeforePayment: z.literal(true),
        }).strict(),
    }).strict()),
    pageInfo,
}).strict();

const storefrontProfile = bookstore.extend({
    description: z.string().nullable(),
    cover: z.string().nullable(),
    operatingHours: publicOperatingHours,
}).strict();
const q09Schema = z.object({
    contractVersion: z.literal('q09-v1'),
    storeProfile: storefrontProfile,
    titleCount: z.number().int().nonnegative(),
    matchContextState: z.enum(['none', 'active', 'unavailable']),
    highlightedTitleGroup: titleGroup.nullable(),
    titleGroups: z.array(titleGroup),
    pageInfo,
}).strict();

const q10Store = bookstore.extend({
    description: z.string().nullable(),
    cover: z.string().nullable(),
}).strict();
const galleryItem = z.object({
    url: z.string().min(1),
    role: z.enum(['damage', 'actual_copy', 'primary_fallback']),
    order: z.number().int().min(1).max(3),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
}).strict();
const q10Schema = z.object({
    contractVersion: z.literal('q10-v1'),
    listingId: z.string().uuid(),
    store: q10Store,
    title: z.string().trim().min(1),
    authors: z.array(z.string()),
    language: z.string().nullable(),
    description: z.string().nullable(),
    editionStatement: z.string().nullable(),
    volume: z.string().nullable(),
    format: z.string().nullable(),
    isbn10: z.string().nullable(),
    isbn13: z.string().nullable(),
    cover: z.string().min(1),
    priceMinor: z.number().int().positive(),
    currency: z.literal('INR'),
    condition,
    hasDamage: z.boolean(),
    publicDamageNote: z.string().nullable(),
    damageTypes: z.array(z.string()),
    availabilityStatus: availability,
    fulfillmentOptions: z.array(z.string()),
    confirmationBeforePayment: z.literal(true),
    gallery: z.array(galleryItem).max(3),
}).strict();

function parse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
    const result = schema.safeParse(value);
    if (!result.success) throw new Error(message);
    return result.data;
}

export const parseBookstoreSearchPage = (value: unknown): BookstoreSearchPage =>
    parse(q08Schema, value, 'Invalid bookstore search response.');
export const parseStorefrontCatalogue = (value: unknown): StorefrontCataloguePage =>
    parse(q09Schema, value, 'Invalid public storefront response.');
export const parsePublicListingDetail = (value: unknown): PublicListingDetail =>
    parse(q10Schema, value, 'Invalid public listing detail response.');
