export type NotificationChannel = 'in_app' | 'push';

export type NotificationStatus =
    | 'pending'
    | 'queued'
    | 'sent'
    | 'delivered'
    | 'failed'
    | 'read'
    | 'archived'
    | 'suppressed';

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

export interface CommerceNotification {
    id: string;
    notification_type: string;
    title: string;
    body: string | null;
    entity_type: string;
    entity_id: string;
    deep_link_route: 'customer_order_request' | 'owner_order_request' | 'ops_order_request';
    deep_link_data: { requestId: string };
    is_read: boolean;
    read_at: string | null;
    privacy_classification: 'internal' | 'confidential' | 'restricted';
    created_at: string;
    source: 'commerce';
}

export type InboxNotification = NotificationDelivery | CommerceNotification;

export interface NotificationPreference {
    id: string;
    user_id: string;
    preference_key: string;
    channel: NotificationChannel;
    enabled: boolean;
    created_at: string;
    updated_at: string;
}
