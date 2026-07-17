-- Cleanup for committed Unit 9 concurrency fixtures only.
\set ON_ERROR_STOP on
BEGIN;
UPDATE public.store_order_requests SET payment_ready_policy_snapshot_id=NULL
 WHERE id::TEXT LIKE '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.marketplace_notifications WHERE entity_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.commerce_transition_log WHERE entity_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.marketplace_audit_logs WHERE entity_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.event_action_tasks WHERE entity_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.commerce_idempotency_keys WHERE logical_entity_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.inventory_holds WHERE order_request_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.store_order_request_items WHERE order_request_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.store_order_request_policy_snapshots WHERE order_request_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.order_request_clarifications WHERE order_request_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.order_request_support_notes WHERE order_request_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.store_order_requests WHERE id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.marketplace_carts WHERE id::TEXT LIKE
 '95000000-0000-0000-0000-00000000000%';
DELETE FROM public.marketplace_events WHERE entity_id::TEXT LIKE
 '96000000-0000-0000-0000-00000000000%';
DELETE FROM public.marketplace_book_listings WHERE id::TEXT LIKE
 '94000000-0000-0000-0000-00000000000%';
DELETE FROM public.store_inventory WHERE id::TEXT LIKE
 '93000000-0000-0000-0000-00000000000%';
DELETE FROM public.marketplace_policy_config WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
DELETE FROM public.platform_user_roles WHERE user_id::TEXT LIKE
 '91000000-0000-0000-0000-00000000000%';
DELETE FROM public.store_entitlements WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
DELETE FROM public.store_subscriptions WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
DELETE FROM public.store_administrators WHERE store_id=
 '92000000-0000-0000-0000-000000000002';
DELETE FROM public.stores WHERE id='92000000-0000-0000-0000-000000000002';
DELETE FROM public.marketplace_localities WHERE id='92000000-0000-0000-0000-000000000001';
DELETE FROM auth.users WHERE id::TEXT LIKE '91000000-0000-0000-0000-00000000000%';
COMMIT;
