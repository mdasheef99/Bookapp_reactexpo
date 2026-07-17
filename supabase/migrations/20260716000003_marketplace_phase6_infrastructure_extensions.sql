-- Phase 6 Unit 2C: extend existing event, notification, task, policy, and idempotency foundations.
BEGIN;

ALTER TABLE public.marketplace_events
  ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version >= 1),
  ADD COLUMN command_id UUID,
  ADD COLUMN correlation_id UUID,
  ADD COLUMN causation_event_id UUID REFERENCES public.marketplace_events(id) ON DELETE SET NULL,
  ADD COLUMN privacy_classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (privacy_classification IN ('public', 'internal', 'confidential', 'restricted'));

CREATE UNIQUE INDEX marketplace_events_command_type_unique
  ON public.marketplace_events(command_id, event_type) WHERE command_id IS NOT NULL;
CREATE INDEX marketplace_events_correlation_idx ON public.marketplace_events(correlation_id);
CREATE INDEX marketplace_events_causation_idx ON public.marketplace_events(causation_event_id);

ALTER TABLE public.marketplace_notifications
  ADD COLUMN event_id UUID REFERENCES public.marketplace_events(id) ON DELETE RESTRICT,
  ADD COLUMN deep_link TEXT,
  ADD COLUMN read_at TIMESTAMPTZ,
  ADD COLUMN privacy_classification TEXT NOT NULL DEFAULT 'internal'
    CHECK (privacy_classification IN ('public', 'internal', 'confidential', 'restricted'));

CREATE UNIQUE INDEX marketplace_notifications_event_recipient_type_unique
  ON public.marketplace_notifications(event_id, user_id, notification_type)
  WHERE event_id IS NOT NULL AND user_id IS NOT NULL;

ALTER TABLE public.notification_deliveries ALTER COLUMN event_id DROP NOT NULL;
ALTER TABLE public.notification_deliveries
  ADD COLUMN marketplace_notification_id UUID
    REFERENCES public.marketplace_notifications(id) ON DELETE CASCADE,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 5),
  ADD COLUMN next_attempt_at TIMESTAMPTZ,
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN locked_by TEXT,
  ADD COLUMN lease_owner UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN last_error_code TEXT,
  ADD COLUMN dead_lettered_at TIMESTAMPTZ,
  ADD CONSTRAINT notification_deliveries_one_source CHECK (
    (event_id IS NOT NULL AND marketplace_notification_id IS NULL)
    OR (event_id IS NULL AND marketplace_notification_id IS NOT NULL)
  ) NOT VALID;

CREATE UNIQUE INDEX notification_deliveries_commerce_recipient_channel_unique
  ON public.notification_deliveries(marketplace_notification_id, recipient_user_id, channel)
  WHERE marketplace_notification_id IS NOT NULL;
CREATE INDEX notification_deliveries_claim_idx
  ON public.notification_deliveries(status, next_attempt_at, lease_expires_at);

ALTER TABLE public.event_action_tasks
  ADD COLUMN entity_type TEXT,
  ADD COLUMN entity_id UUID,
  ADD COLUMN task_type TEXT,
  ADD COLUMN due_at TIMESTAMPTZ,
  ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 5),
  ADD COLUMN next_attempt_at TIMESTAMPTZ,
  ADD COLUMN lease_owner UUID,
  ADD COLUMN lease_expires_at TIMESTAMPTZ,
  ADD COLUMN last_error_code TEXT,
  ADD COLUMN dead_lettered_at TIMESTAMPTZ,
  ADD COLUMN resolved_at TIMESTAMPTZ,
  ADD COLUMN support_version INTEGER NOT NULL DEFAULT 1 CHECK (support_version >= 1),
  ADD COLUMN dedupe_key TEXT;

CREATE UNIQUE INDEX event_action_tasks_open_entity_type_unique
  ON public.event_action_tasks(entity_type, entity_id, task_type)
  WHERE status IN ('open', 'in_progress');
CREATE UNIQUE INDEX event_action_tasks_dedupe_unique
  ON public.event_action_tasks(dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX event_action_tasks_claim_idx
  ON public.event_action_tasks(status, next_attempt_at, due_at, lease_expires_at);

ALTER TABLE public.commerce_idempotency_keys
  ADD COLUMN actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN command_name TEXT,
  ADD COLUMN logical_entity_id UUID,
  ADD COLUMN command_id UUID,
  ADD COLUMN expected_version INTEGER,
  ADD COLUMN correlation_id UUID;

CREATE INDEX commerce_idempotency_actor_command_idx
  ON public.commerce_idempotency_keys(actor_user_id, command_name, created_at);

ALTER TABLE public.marketplace_policy_config
  ADD COLUMN value_type TEXT NOT NULL DEFAULT 'json'
    CHECK (value_type IN ('boolean', 'integer', 'money_minor', 'string', 'json')),
  ADD COLUMN policy_version INTEGER NOT NULL DEFAULT 1 CHECK (policy_version >= 1),
  ADD COLUMN normalized_scope_identity TEXT,
  ADD CONSTRAINT marketplace_policy_effective_range_valid
    CHECK (effective_to IS NULL OR effective_to > effective_from);

CREATE INDEX marketplace_policy_resolution_idx
  ON public.marketplace_policy_config(
    policy_key, scope_type, normalized_scope_identity, is_active, effective_from
  );

COMMIT;
