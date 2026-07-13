# Enterprise Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an event-driven notification system with durable in-app notifications, push token management, preferences, and a profile notification center.

**Architecture:** Backend workflows create canonical notification events, routing creates per-recipient delivery rows, and an Edge Function sends push notifications from pending delivery rows. The app reads delivery rows for the notification inbox and manages user preferences in Profile.

**Tech Stack:** Expo Router, React Native, Supabase Postgres/RLS/RPC, Supabase Edge Functions, `expo-notifications`, Jest, TypeScript.

---

## Update Tracker

| Area | Status | Evidence |
|---|---|---|
| Current-state audit | Complete | Supabase and Augment MCP checked on 2026-06-06 |
| Feature spec | Complete | `docs/features/NOTIFICATIONS_ENTERPRISE_SPEC_2026-06-06.md` |
| Trigger matrix | Complete | `docs/features/NOTIFICATIONS_EVENT_TRIGGER_MATRIX_2026-06-06.md` |
| DB migrations | Applied live and source-recorded | Supabase MCP applied `20260606103405_enterprise_notifications.sql`, `20260606103516_notification_event_routing.sql`, and `20260606103926_harden_notifications_advisor_findings.sql` |
| Push dependency/config | Dependency installed and service wiring complete | `expo-notifications` added; `requestAndRegisterPushToken(...)` stores Expo tokens |
| App notification service | Complete for inbox/preferences/token storage | `src/features/notifications/services/notificationsService.ts` |
| Profile inbox UI | Complete for first version | `app/(tabs)/profile/notifications.tsx` |
| Profile preferences UI | Complete for first version | `app/(tabs)/profile/notification-settings.tsx` |
| Edge Function sender | Deployed live | Supabase MCP deployed active `send-notification` version 1 with JWT verification on 2026-06-06 |
| First workflow triggers | Applied live | Routing migration covers transaction events, transaction status updates, and club invitations |
| Tests | Passing | Notification service/hooks/profile tests passed; TypeScript passed; web smoke test passed 4/4 on 2026-06-06 |

## File Structure

Create:

- `supabase/migrations/<timestamp>_enterprise_notifications.sql`: notification tables, RLS, helper RPCs, and live `user_push_tokens` reconciliation.
- `src/features/notifications/services/notificationsService.ts`: app-facing notification reads, read/archive mutations, preference reads, preference updates, push token registration wrapper.
- `src/features/notifications/services/__tests__/notificationsService.test.ts`: service tests.
- `src/features/notifications/hooks/useNotifications.ts`: React Query hooks for inbox and preferences.
- `src/features/notifications/hooks/__tests__/useNotifications.test.tsx`: hook tests.
- `src/features/notifications/types.ts`: shared notification types.
- `app/(tabs)/profile/notifications.tsx`: inbox screen.
- `app/(tabs)/profile/notification-settings.tsx`: preference screen.
- `app/(tabs)/profile/__tests__/notifications.test.tsx`: inbox screen tests.
- `app/(tabs)/profile/__tests__/notification-settings.test.tsx`: settings screen tests.
- `supabase/functions/send-notification/index.ts`: sends pending push delivery rows.
- `supabase/functions/send-notification/__tests__/send-notification.test.ts`: Edge Function tests if local function test harness is added.
- `__mocks__/expo-notifications.ts`: Jest mock.

Modify:

- `package.json`: add `expo-notifications`.
- `app.json`: add notification plugin/config if required by Expo SDK 54.
- `app/(tabs)/profile/_layout.tsx`: add profile routes.
- `app/(tabs)/profile/settings.tsx`: link to notification settings and inbox.
- `app/(tabs)/profile/__tests__/settings.test.tsx`: update placeholder expectations.
- `src/lib/supabase.ts` only if generated types or client helpers require updates.
- Exchange RPC migrations in a follow-up migration to emit `notification_events` from `transaction_events`.
- Club RPC/table workflows in follow-up migrations to emit `notification_events`.

## Task 1: Create Notification Database Foundation

**Files:**

- Create: `supabase/migrations/<timestamp>_enterprise_notifications.sql`

- [ ] **Step 1: Create the migration file**

Run:

```powershell
supabase migration new enterprise_notifications
```

Expected: a new SQL file appears under `supabase/migrations`.

- [ ] **Step 2: Add notification tables**

Add this SQL to the generated migration file:

```sql
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  actor_user_id uuid references auth.users(id) on delete set null,
  source text not null,
  severity text not null default 'info'
    check (severity in ('info', 'success', 'warning', 'critical')),
  requires_action boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  channel text not null check (channel in ('in_app', 'push')),
  title text not null,
  body text not null,
  deep_link text,
  status text not null default 'pending'
    check (status in ('pending', 'queued', 'sent', 'delivered', 'failed', 'read', 'archived', 'suppressed')),
  provider_message_id text,
  error_code text,
  error_message text,
  sent_at timestamptz,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, recipient_user_id, channel)
);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preference_key text not null,
  channel text not null check (channel in ('in_app', 'push')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, preference_key, channel)
);
```

- [ ] **Step 3: Add indexes**

Add:

```sql
create index if not exists notification_events_type_created_idx
  on public.notification_events(event_type, created_at desc);

create index if not exists notification_events_entity_idx
  on public.notification_events(entity_type, entity_id);

create index if not exists notification_events_actor_created_idx
  on public.notification_events(actor_user_id, created_at desc);

create index if not exists notification_deliveries_recipient_created_idx
  on public.notification_deliveries(recipient_user_id, created_at desc);

create index if not exists notification_deliveries_recipient_unread_idx
  on public.notification_deliveries(recipient_user_id, read_at, created_at desc)
  where archived_at is null;

create index if not exists notification_deliveries_status_channel_idx
  on public.notification_deliveries(status, channel, created_at);

create index if not exists notification_preferences_user_key_idx
  on public.notification_preferences(user_id, preference_key);
```

- [ ] **Step 4: Reconcile `user_push_tokens`**

Add:

```sql
create table if not exists public.user_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  device_id text,
  provider text not null default 'expo' check (provider in ('expo', 'fcm', 'apns')),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_push_tokens
  add column if not exists platform text not null default 'unknown';

alter table public.user_push_tokens
  add column if not exists device_id text;

alter table public.user_push_tokens
  add column if not exists provider text not null default 'expo';

alter table public.user_push_tokens
  add column if not exists last_seen_at timestamptz not null default now();

alter table public.user_push_tokens
  add column if not exists revoked_at timestamptz;

alter table public.user_push_tokens
  add column if not exists updated_at timestamptz not null default now();

create index if not exists user_push_tokens_user_active_idx
  on public.user_push_tokens(user_id, revoked_at);
```

- [ ] **Step 5: Enable RLS**

Add:

```sql
alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.user_push_tokens enable row level security;
```

- [ ] **Step 6: Add RLS policies**

Add:

```sql
revoke all on public.notification_events from public, anon, authenticated;
revoke all on public.notification_deliveries from public, anon, authenticated;
revoke all on public.notification_preferences from public, anon, authenticated;
revoke all on public.user_push_tokens from public, anon, authenticated;

grant select on public.notification_events to authenticated;
grant select on public.notification_deliveries to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update on public.user_push_tokens to authenticated;

grant all on public.notification_events to service_role;
grant all on public.notification_deliveries to service_role;
grant all on public.notification_preferences to service_role;
grant all on public.user_push_tokens to service_role;

create policy "Users can view events backing their deliveries"
on public.notification_events
for select
to authenticated
using (
  exists (
    select 1
    from public.notification_deliveries nd
    where nd.event_id = notification_events.id
      and nd.recipient_user_id = auth.uid()
  )
);

create policy "Users can view their notification deliveries"
on public.notification_deliveries
for select
to authenticated
using (recipient_user_id = auth.uid());

create policy "Users can manage their notification preferences"
on public.notification_preferences
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can view their push tokens"
on public.user_push_tokens
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can register their push tokens"
on public.user_push_tokens
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update their push tokens"
on public.user_push_tokens
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

- [ ] **Step 7: Add RPCs for read/archive/preference writes**

Add:

```sql
create or replace function public.mark_notification_read(p_delivery_id uuid)
returns public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $function$
declare
  updated_delivery public.notification_deliveries;
begin
  update public.notification_deliveries
  set read_at = coalesce(read_at, now()),
      status = case when status in ('pending', 'queued', 'sent', 'delivered') then 'read' else status end,
      updated_at = now()
  where id = p_delivery_id
    and recipient_user_id = auth.uid()
  returning * into updated_delivery;

  if updated_delivery.id is null then
    raise exception 'Notification not found or not accessible';
  end if;

  return updated_delivery;
end;
$function$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  updated_count integer;
begin
  update public.notification_deliveries
  set read_at = coalesce(read_at, now()),
      status = case when status in ('pending', 'queued', 'sent', 'delivered') then 'read' else status end,
      updated_at = now()
  where recipient_user_id = auth.uid()
    and read_at is null
    and archived_at is null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$function$;

create or replace function public.archive_notification(p_delivery_id uuid)
returns public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $function$
declare
  updated_delivery public.notification_deliveries;
begin
  update public.notification_deliveries
  set archived_at = coalesce(archived_at, now()),
      status = 'archived',
      updated_at = now()
  where id = p_delivery_id
    and recipient_user_id = auth.uid()
  returning * into updated_delivery;

  if updated_delivery.id is null then
    raise exception 'Notification not found or not accessible';
  end if;

  return updated_delivery;
end;
$function$;

grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.archive_notification(uuid) to authenticated;
```

- [ ] **Step 8: Run migration verification**

Run:

```powershell
npx.cmd tsc --noEmit
```

Expected: TypeScript still compiles.

Run Supabase advisors after applying the migration:

```powershell
supabase db advisors
```

Expected: no new notification-table RLS warnings.

## Task 2: Add App Notification Types And Service

**Files:**

- Create: `src/features/notifications/types.ts`
- Create: `src/features/notifications/services/notificationsService.ts`
- Create: `src/features/notifications/services/__tests__/notificationsService.test.ts`

- [ ] **Step 1: Add shared types**

Create `src/features/notifications/types.ts`:

```ts
export type NotificationChannel = 'in_app' | 'push';
export type NotificationStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'failed' | 'read' | 'archived' | 'suppressed';

export interface NotificationDelivery {
  id: string;
  event_id: string;
  recipient_user_id: string;
  category: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  deep_link: string | null;
  status: NotificationStatus;
  provider_message_id: string | null;
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  preference_key: string;
  channel: NotificationChannel;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Write service tests**

Create `src/features/notifications/services/__tests__/notificationsService.test.ts` with tests for:

```ts
import { notificationsService } from '../notificationsService';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase');

describe('notificationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches non-archived notifications newest first', async () => {
    const order = jest.fn().mockResolvedValue({ data: [], error: null });
    const is = jest.fn(() => ({ order }));
    const eq = jest.fn(() => ({ is }));
    const select = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ select });

    await notificationsService.getNotifications('user-1');

    expect(supabase.from).toHaveBeenCalledWith('notification_deliveries');
    expect(select).toHaveBeenCalledWith('*');
    expect(eq).toHaveBeenCalledWith('recipient_user_id', 'user-1');
    expect(is).toHaveBeenCalledWith('archived_at', null);
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('marks one notification read through the RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: { id: 'delivery-1' }, error: null });

    await notificationsService.markRead('delivery-1');

    expect(supabase.rpc).toHaveBeenCalledWith('mark_notification_read', { p_delivery_id: 'delivery-1' });
  });

  it('archives one notification through the RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({ data: { id: 'delivery-1' }, error: null });

    await notificationsService.archive('delivery-1');

    expect(supabase.rpc).toHaveBeenCalledWith('archive_notification', { p_delivery_id: 'delivery-1' });
  });
});
```

- [ ] **Step 3: Implement the service**

Create `src/features/notifications/services/notificationsService.ts`:

```ts
import { supabase } from '@/lib/supabase';
import type { NotificationDelivery, NotificationPreference } from '../types';

export const notificationsService = {
  async getNotifications(userId: string): Promise<NotificationDelivery[]> {
    const { data, error } = await supabase
      .from('notification_deliveries')
      .select('*')
      .eq('recipient_user_id', userId)
      .is('archived_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []) as NotificationDelivery[];
  },

  async markRead(deliveryId: string): Promise<NotificationDelivery> {
    const { data, error } = await supabase.rpc('mark_notification_read', { p_delivery_id: deliveryId });
    if (error) throw error;
    return data as NotificationDelivery;
  },

  async markAllRead(): Promise<number> {
    const { data, error } = await supabase.rpc('mark_all_notifications_read');
    if (error) throw error;
    return Number(data ?? 0);
  },

  async archive(deliveryId: string): Promise<NotificationDelivery> {
    const { data, error } = await supabase.rpc('archive_notification', { p_delivery_id: deliveryId });
    if (error) throw error;
    return data as NotificationDelivery;
  },

  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .order('preference_key', { ascending: true });

    if (error) throw error;
    return (data ?? []) as NotificationPreference[];
  },

  async upsertPreference(input: Pick<NotificationPreference, 'user_id' | 'preference_key' | 'channel' | 'enabled'>): Promise<NotificationPreference> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(input, { onConflict: 'user_id,preference_key,channel' })
      .select('*')
      .single();

    if (error) throw error;
    return data as NotificationPreference;
  },
};
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd test -- --runInBand src/features/notifications/services/__tests__/notificationsService.test.ts
```

Expected: PASS.

## Task 3: Add Hooks And Profile Inbox UI

**Files:**

- Create: `src/features/notifications/hooks/useNotifications.ts`
- Create: `app/(tabs)/profile/notifications.tsx`
- Modify: `app/(tabs)/profile/_layout.tsx`
- Modify: `app/(tabs)/profile/settings.tsx`

- [ ] **Step 1: Implement hooks**

Create `src/features/notifications/hooks/useNotifications.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsService } from '../services/notificationsService';

export const notificationKeys = {
  all: ['notifications'] as const,
  inbox: (userId: string) => [...notificationKeys.all, 'inbox', userId] as const,
  preferences: (userId: string) => [...notificationKeys.all, 'preferences', userId] as const,
};

export function useNotifications(userId?: string | null) {
  return useQuery({
    queryKey: notificationKeys.inbox(userId ?? 'anonymous'),
    queryFn: () => notificationsService.getNotifications(userId as string),
    enabled: Boolean(userId),
  });
}

export function useNotificationPreferences(userId?: string | null) {
  return useQuery({
    queryKey: notificationKeys.preferences(userId ?? 'anonymous'),
    queryFn: () => notificationsService.getPreferences(userId as string),
    enabled: Boolean(userId),
  });
}

export function useMarkNotificationRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsService.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.inbox(userId) }),
  });
}

export function useArchiveNotification(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsService.archive,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.inbox(userId) }),
  });
}
```

- [ ] **Step 2: Create inbox screen**

Create `app/(tabs)/profile/notifications.tsx` with a `FlatList` of notification deliveries, using `useAuth()` for `session.user.id`, `useNotifications(userId)`, and `router.push(item.deep_link)` when present.

- [ ] **Step 3: Add routes**

Modify `app/(tabs)/profile/_layout.tsx` to include:

```tsx
<Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
<Stack.Screen name="notification-settings" options={{ title: 'Notification Settings' }} />
```

- [ ] **Step 4: Update profile settings links**

Modify `app/(tabs)/profile/settings.tsx` so the notification row navigates to `/(tabs)/profile/notification-settings`, and add a separate row for `/(tabs)/profile/notifications`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm.cmd test -- --runInBand "app/(tabs)/profile/__tests__/settings.test.tsx"
```

Expected: PASS after updating expectations.

## Task 4: Add Notification Preferences UI

**Files:**

- Create: `app/(tabs)/profile/notification-settings.tsx`
- Create: `app/(tabs)/profile/__tests__/notification-settings.test.tsx`

- [ ] **Step 1: Define preference groups**

Use these keys:

```ts
const PREFERENCE_GROUPS = [
  { key: 'transaction', label: 'Exchange updates', critical: true },
  { key: 'safety', label: 'Safety and moderation', critical: true },
  { key: 'clubs', label: 'Club activity', critical: false },
  { key: 'events', label: 'Club events', critical: false },
  { key: 'discussion', label: 'Discussion replies and mentions', critical: false },
  { key: 'wishlist', label: 'Wishlist matches', critical: false },
  { key: 'reminders', label: 'Reminders', critical: false },
  { key: 'credits', label: 'Credit updates', critical: false },
  { key: 'marketing', label: 'Product announcements', critical: false },
];
```

- [ ] **Step 2: Build settings screen**

Create toggles for `in_app` and `push`. Disable toggles for critical groups and display them as always on.

- [ ] **Step 3: Verify**

Run:

```powershell
npm.cmd test -- --runInBand "app/(tabs)/profile/__tests__/notification-settings.test.tsx"
```

Expected: PASS.

## Task 5: Add Push Token Registration

**Files:**

- Modify: `package.json`
- Modify: `app.json`
- Create: `__mocks__/expo-notifications.ts`
- Modify: `src/features/notifications/services/notificationsService.ts`

- [ ] **Step 1: Install dependency**

Run:

```powershell
npm.cmd install expo-notifications
```

Expected: package installed and lockfile updated.

- [ ] **Step 2: Add Jest mock**

Create `__mocks__/expo-notifications.ts`:

```ts
export const getPermissionsAsync = jest.fn();
export const requestPermissionsAsync = jest.fn();
export const getExpoPushTokenAsync = jest.fn();
export const setNotificationHandler = jest.fn();
export const addNotificationReceivedListener = jest.fn();
export const addNotificationResponseReceivedListener = jest.fn();
```

- [ ] **Step 3: Add token registration service**

Add a method to `notificationsService`:

```ts
async registerPushToken(input: { userId: string; token: string; platform: 'ios' | 'android' | 'web' | 'unknown'; deviceId?: string | null }) {
  const { data, error } = await supabase
    .from('user_push_tokens')
    .upsert({
      user_id: input.userId,
      token: input.token,
      platform: input.platform,
      device_id: input.deviceId ?? null,
      provider: 'expo',
      revoked_at: null,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'token' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm.cmd test -- --runInBand src/features/notifications/services/__tests__/notificationsService.test.ts
```

Expected: PASS.

## Task 6: Create Push Sender Edge Function

**Files:**

- Create: `supabase/functions/send-notification/index.ts`

- [ ] **Step 1: Create function**

Run:

```powershell
supabase functions new send-notification
```

Expected: `supabase/functions/send-notification/index.ts` exists.

- [ ] **Step 2: Implement pending delivery sender**

Implement the function to:

- Read pending `notification_deliveries` where `channel = 'push'`.
- Join active `user_push_tokens`.
- Send messages to Expo push endpoint.
- Mark deliveries `sent` with `sent_at`.
- Mark failed deliveries `failed` with `error_code` and `error_message`.

- [ ] **Step 3: Deploy**

Run:

```powershell
supabase functions deploy send-notification
```

Expected: Supabase reports deployed function.

## Task 7: Wire First Event Sources

**Files:**

- Create: `supabase/migrations/<timestamp>_notification_event_routing.sql`

- [ ] **Step 1: Add event creation RPC**

Create `public.create_notification_event(...)` as a service-role/RPC helper with `idempotency_key`.

- [ ] **Step 2: Route exchange transaction events**

Create a trigger on `transaction_events` that maps:

- `requested` to lender.
- `approved`, `declined` to borrower.
- `cancelled` to the other participant.
- `completed` to both participants.
- `dispute_opened` to the other participant.

- [ ] **Step 3: Route club invitations**

Create events from:

- `create_club_invitation`
- `accept_club_invitation`
- `revoke_club_invitation`

- [ ] **Step 4: Verify**

Create one test row in a local/dev database and confirm:

```sql
select count(*) from public.notification_events;
select count(*) from public.notification_deliveries;
```

Expected: event and delivery counts increase exactly once per idempotency key.

## Task 8: Final Verification

- [ ] **Step 1: Run notification tests**

```powershell
npm.cmd test -- --runInBand src/features/notifications app/(tabs)/profile/__tests__/notifications.test.tsx app/(tabs)/profile/__tests__/notification-settings.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run TypeScript**

```powershell
npx.cmd tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run Supabase advisors**

```powershell
supabase db advisors
```

Expected: no new notification-table security findings.

- [ ] **Step 4: Update tracker**

Update this document's tracker statuses to reflect completed implementation areas.

## Execution Options

1. **Subagent-Driven, recommended:** dispatch a fresh subagent per task and review between tasks.
2. **Inline Execution:** execute tasks in this session with checkpoints.
