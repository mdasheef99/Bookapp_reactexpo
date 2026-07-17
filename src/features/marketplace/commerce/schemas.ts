import { z } from 'zod';
import {
    CART_STATES,
    COMMERCE_COMMANDS,
    COMMERCE_ERROR_CODES,
    COMMERCE_EVENT_NAMES,
    COMMERCE_NOTIFICATION_NAMES,
    COMMERCE_POLICY_KEYS,
    COMMERCE_REASON_CODES,
    COMMERCE_TASK_CATEGORIES,
    HOLD_STATUSES,
    HOLD_TYPES,
    ORDER_REQUEST_ITEM_STATES,
    ORDER_REQUEST_STATES,
} from './vocabulary';

export const cartStateSchema = z.enum(CART_STATES);
export const orderRequestStateSchema = z.enum(ORDER_REQUEST_STATES);
export const orderRequestItemStateSchema = z.enum(ORDER_REQUEST_ITEM_STATES);
export const holdTypeSchema = z.enum(HOLD_TYPES);
export const holdStatusSchema = z.enum(HOLD_STATUSES);
export const commerceCommandSchema = z.enum(COMMERCE_COMMANDS);
export const commerceEventNameSchema = z.enum(COMMERCE_EVENT_NAMES);
export const commerceNotificationNameSchema = z.enum(COMMERCE_NOTIFICATION_NAMES);
export const commerceTaskCategorySchema = z.enum(COMMERCE_TASK_CATEGORIES);
export const commerceReasonCodeSchema = z.enum(COMMERCE_REASON_CODES);
export const commerceErrorCodeSchema = z.enum(COMMERCE_ERROR_CODES);
export const commercePolicyKeySchema = z.enum(COMMERCE_POLICY_KEYS);
