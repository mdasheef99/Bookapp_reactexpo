-- Follow-up migration: add missing FK indexes on marketplace_notifications.
-- Identified during the post-deployment audit (2026-06-19).
-- Required by SEC-04: "Add FK indexes for every new foreign key."
-- These columns are evaluated in the 'notifications select own' RLS USING clause;
-- without indexes every RLS check causes a sequential scan on notification reads.
CREATE INDEX idx_notifications_user  ON public.marketplace_notifications(user_id);
CREATE INDEX idx_notifications_store ON public.marketplace_notifications(store_id);
