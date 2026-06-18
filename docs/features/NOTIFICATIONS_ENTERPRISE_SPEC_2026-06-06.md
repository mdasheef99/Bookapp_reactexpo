# Enterprise Notifications Feature Spec

**Date:** 2026-06-06

**Status:** Implemented foundation plus Clubs/wishlist reminder rollout

**Goal:** Add a durable, enterprise-grade notification system that supports in-app notification history, push delivery, preferences, event-driven routing, and a clean integration contract for future features.

## Verified Current Status

Checked with Augment MCP, local source, local migrations, and live Supabase project `ahntbtktjjmvfosgkmgn`.

Live Supabase currently has:

- `public.notification_events`, RLS enabled.
- `public.notification_deliveries`, RLS enabled, with user-owned read/archive update policy.
- `public.notification_preferences`, RLS enabled.
- `public.user_push_tokens`, RLS enabled and reconciled for multi-device token storage.
- `public.transaction_events`, RLS enabled, used by exchange RPCs.
- `public.credit_events`, RLS enabled, used by credit accounting.
- Mature user-visible feature tables, including `club_invitations`, `club_join_applications`, `book_nominations`, `book_votes`, `club_events`, `event_rsvps`, `club_discussion_topics`, `club_discussion_replies`, `club_discussion_reports`, `club_member_actions`, `club_downgrade_grace_events`, `listings`, and `user_wishlist`.

Live Supabase Edge Functions currently deployed:

- `complete-transaction`
- `transfer-credits`
- `check-membership-limits`
- `handle-club-downgrade-grace-period`
- `send-notification`
- `wishlist-notify`

Implemented notification infrastructure:

- Durable notification inbox and delivery ledger.
- Notification preferences by category and channel.
- `expo-notifications` dependency and push token registration service.
- Profile notification center and notification settings screens.
- Live routing triggers for exchange transaction events/status changes and club invitations.
- `send-notification` Edge Function deployed with JWT verification.
- 2026-06-06 completion pass: live routing for wishlist listing matches, club event create/update/cancel, book nominations, reading schedule create/update, downgrade grace events, unread invitation reminders, voting-ending reminders, event reminders, reading milestone reminders, and downgrade deadline reminders.
- `wishlist-notify` Edge Function deployed with JWT verification and required `WISHLIST_NOTIFY_CRON_SECRET` gate for safe backfill/manual runs.

Remaining notification rollout work:

- Add trigger coverage for club discussions, club moderation resolution, credits, and system announcements.
- Configure authenticated scheduled invocation for `send-notification` using DB settings: `app.settings.send_notification_url`, `app.settings.send_notification_bearer`, and optional `app.settings.send_notification_cron_secret`.
- Add production monitoring for failed push deliveries and provider receipt reconciliation.

Security notes from Supabase advisors:

- `public.spatial_ref_sys` has RLS disabled. This is not notification-specific, but should be handled before production hardening.
- Several security-definer functions and function search paths are flagged. These are existing findings and should be reviewed as part of broader database hardening.

## Product Requirements

The notification system must support:

- In-app notifications stored in Profile.
- Push notifications for mobile devices.
- Per-user preferences by category and channel.
- Mandatory transactional, safety, and account-security notifications.
- Optional social, club, wishlist, reminder, and marketing notifications.
- Deep links to the relevant app screen.
- Read, unread, archived, failed, and delivered states.
- Idempotency so retried events do not duplicate notifications.
- Event-driven integration so future tasks can trigger notifications without custom delivery code.
- Safe notification copy that avoids payment details, private addresses, complaint details, and unnecessary PII.

## Architecture Decision

Use an event-driven backend notification layer.

Feature workflows emit canonical app events. Notification routing turns events into per-recipient delivery rows. Push delivery sends from delivery rows and updates their status. The app reads the same delivery rows for the profile notification center.

Do not send notifications directly from UI code. Do not place push delivery logic inside feature services such as `transactionsService`, `clubsService`, or wishlist hooks. Those modules may cause user-visible state changes, but notification creation should happen through database functions, server jobs, or Edge Functions.

## Data Model

### `notification_events`

Append-only event table for all user-visible notification-worthy events.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `event_type text not null`
- `entity_type text not null`
- `entity_id uuid`
- `actor_user_id uuid references auth.users(id)`
- `source text not null`
- `severity text not null default 'info'`
- `requires_action boolean not null default false`
- `payload jsonb not null default '{}'::jsonb`
- `idempotency_key text not null unique`
- `created_at timestamptz not null default now()`

Recommended indexes:

- `(event_type, created_at desc)`
- `(entity_type, entity_id)`
- `(actor_user_id, created_at desc)`

### `notification_deliveries`

Durable notification inbox and delivery ledger.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `event_id uuid references public.notification_events(id) on delete cascade`
- `recipient_user_id uuid not null references auth.users(id) on delete cascade`
- `category text not null`
- `channel text not null`
- `title text not null`
- `body text not null`
- `deep_link text`
- `status text not null default 'pending'`
- `provider_message_id text`
- `error_code text`
- `error_message text`
- `sent_at timestamptz`
- `read_at timestamptz`
- `archived_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Status values:

- `pending`
- `queued`
- `sent`
- `delivered`
- `failed`
- `read`
- `archived`
- `suppressed`

Recommended indexes:

- `(recipient_user_id, created_at desc)`
- `(recipient_user_id, read_at, created_at desc)`
- `(status, channel, created_at)`
- `unique(event_id, recipient_user_id, channel)`

### `notification_preferences`

Per-user notification settings.

Columns:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `preference_key text not null`
- `channel text not null`
- `enabled boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended unique constraint:

- `unique(user_id, preference_key, channel)`

### `user_push_tokens`

Reconcile live table into source-controlled migrations. The final table should support:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade`
- `token text not null`
- `platform text not null`
- `device_id text`
- `provider text not null default 'expo'`
- `last_seen_at timestamptz not null default now()`
- `revoked_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Recommended constraints and indexes:

- `unique(token)`
- `(user_id, revoked_at)`

## RLS Model

`notification_events`:

- Authenticated users can select events only when a corresponding delivery exists for their user.
- Direct client inserts are not allowed.
- Service role can insert and manage.

`notification_deliveries`:

- Users can select their own deliveries.
- Users can update only their own `read_at` and `archived_at` through RPCs, not unrestricted table updates.
- Service role can create and update delivery status.

`notification_preferences`:

- Users can select and upsert their own preferences.
- Service role can manage all preferences.

`user_push_tokens`:

- Users can select, insert, and revoke their own tokens.
- Service role can read active tokens for delivery.

## Integration Contract

Every future notification-worthy feature should integrate through this contract:

1. A backend workflow creates a `notification_events` row with a stable `event_type` and `idempotency_key`.
2. A routing function resolves recipients and creates `notification_deliveries`.
3. The app displays in-app deliveries from `notification_deliveries`.
4. A push sender Edge Function sends pending push deliveries and updates status.
5. Feature code links to notification infrastructure only by event type, entity id, and payload.

Example event types:

- `exchange.transaction_requested`
- `exchange.transaction_approved`
- `club.invitation_created`
- `club.join_application_submitted`
- `club.book_nominated`
- `club.event_cancelled`
- `discussion.reply_created`
- `wishlist.listing_matched`
- `credit.earned`
- `membership.downgrade_grace_started`

## Profile Notification Center

Profile should contain:

- Notification inbox entry point.
- Unread count.
- Notification list grouped by recency.
- Read/unread state.
- Archive action.
- Mark all read.
- Tap to deep link.
- Empty state.
- Preference settings by category and channel.

Recommended profile routes:

- `app/(tabs)/profile/notifications.tsx`
- `app/(tabs)/profile/notification-settings.tsx`

## Delivery Strategy

Phase 1:

- In-app notifications first.
- Push token registration.
- Push sender Edge Function using Expo push service.
- Manual or scheduled sender invocation for pending push deliveries.

Phase 2:

- Scheduled reminders and batched club discussion notifications.
- Delivery receipts and retry/backoff policy.
- Ops visibility for failed deliveries.

Phase 3:

- Email digest channel if product requires it.
- Admin-managed templates.
- Multi-tenant marketplace notification expansion.

## Non-Goals For First Implementation

- Email delivery.
- Marketing campaign tooling.
- Admin-editable notification templates.
- Push delivery guarantees beyond durable attempts, retries, and failure logging.
- Real-time subscriptions as a substitute for push delivery.

## Acceptance Criteria

- Notification data model exists in migrations and live Supabase.
- RLS prevents users from seeing other users' notifications.
- Users can read and mark their own notifications.
- Users can manage non-critical preferences.
- Critical transactional and safety notifications are not accidentally suppressible.
- Device push tokens can be registered and revoked.
- First exchange and club workflows create durable in-app notifications.
- Push sender can send or mark failures without duplicate notification rows.
- Profile includes notification history and preferences.
- Trigger matrix is kept up to date as new features are added.
