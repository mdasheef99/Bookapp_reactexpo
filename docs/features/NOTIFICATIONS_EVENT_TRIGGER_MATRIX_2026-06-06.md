# Notification Event Trigger Matrix

**Date:** 2026-06-06

**Status:** Foundation implemented; matrix remains the source of truth for future trigger rollout

**Implemented on 2026-06-06:** exchange transaction events, exchange transaction status updates, and club invitation create/status updates are wired through live database triggers. Remaining rows are planned rollout targets.

This matrix defines which current and near-term application workflows should create notifications. New features should add rows here before implementation.

## Trigger Principles

- Trigger notifications from backend events, RPCs, Edge Functions, or scheduled jobs.
- Do not trigger notifications directly from UI-only mutations.
- Use idempotency keys for every event.
- Store an in-app notification for every user-facing notification.
- Send push only when preferences and urgency allow it.
- Avoid private addresses, payment details, complaint bodies, and sensitive moderation details in notification copy.
- Batch noisy social activity by default.

## Exchange

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `exchange.transaction_requested` | `request_transaction` RPC inserts `transaction_events.requested` | Lender | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.transaction_approved` | `approve_transaction` RPC | Borrower | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.transaction_declined` | `decline_transaction` RPC | Borrower | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.transaction_cancelled` | `cancel_transaction` RPC | Other participant | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.payment_pending` | `transition_transaction_status` RPC | Borrower | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.ready_to_ship` | `transition_transaction_status` RPC | Lender | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.shipped` | `transition_transaction_status` RPC | Borrower | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.delivered` | `transition_transaction_status` RPC | Borrower, lender | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.completed` | `complete_transaction` RPC or Edge Function | Borrower, lender | transaction | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.dispute_opened` | `file_transaction_dispute` RPC | Other participant, ops later | safety | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.dispute_resolved` | Dispute resolution workflow | Borrower, lender | safety | in_app, push | mandatory | `/(tabs)/exchange/transaction/:transactionId` |
| `exchange.rating_reminder` | Scheduled job after completion | Participant without rating | reminders | in_app, push | optional | `/(tabs)/exchange/transaction/:transactionId` |

## Listings And Wishlist

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `wishlist.listing_matched` | New active listing matches `user_wishlist` or wishlist-owned `user_books` in city | Matching users except owner | wishlist | in_app, push | optional | `/(tabs)/exchange/:listingId` |
| `listing.saved_book_available` | User alert/book demand signal match | Alert owner | wishlist | in_app, push | optional | `/(tabs)/exchange/:listingId` |
| `listing.price_drop` | Future price update workflow | Watchers | wishlist | in_app, push | optional | `/(tabs)/exchange/:listingId` |

## Clubs: Membership And Governance

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `club.created` | `create_club` RPC | Creator | clubs | in_app | optional | `/(tabs)/clubs/:clubId` |
| `club.invitation_created` | `create_club_invitation` RPC | Invitee | clubs | in_app, push | optional | `/(tabs)/clubs/invitations` |
| `club.invitation_revoked` | `revoke_club_invitation` RPC | Invitee | clubs | in_app, push | optional | `/(tabs)/clubs/invitations` |
| `club.invitation_accepted` | `accept_club_invitation` RPC | Inviter, club admin | clubs | in_app | optional | `/(tabs)/clubs/:clubId/manage` |
| `club.join_application_submitted` | `joinClub` approval flow inserts `club_join_applications` | Club admins/moderators | clubs | in_app, push | optional | `/(tabs)/clubs/:clubId/applications` |
| `club.join_application_approved` | `review_club_join_application` RPC | Applicant | clubs | in_app, push | optional | `/(tabs)/clubs/:clubId` |
| `club.join_application_declined` | `review_club_join_application` RPC | Applicant | clubs | in_app, push | optional | `/(tabs)/clubs/:clubId` |
| `club.member_removed` | `removeMember` workflow | Removed member | safety | in_app, push | mandatory | `/(tabs)/clubs` |
| `club.member_role_changed` | `updateMemberRole` workflow | Affected member | clubs | in_app | optional | `/(tabs)/clubs/:clubId` |
| `club.member_action_issued` | `issue_club_member_action` RPC | Affected member | safety | in_app, push | mandatory | `/(tabs)/clubs/:clubId` |
| `club.admin_transfer_requested` | `request_club_admin_transfer` RPC | Proposed admin | clubs | in_app, push | optional | `/(tabs)/clubs/:clubId/manage` |
| `club.admin_transfer_accepted` | `accept_club_admin_transfer_request` RPC | Previous admin, new admin | clubs | in_app | optional | `/(tabs)/clubs/:clubId/manage` |
| `membership.downgrade_grace_started` | `process_club_downgrade_grace_period` scheduled workflow | Affected user | account | in_app, push | mandatory | `/(tabs)/profile/settings` |
| `membership.downgrade_grace_deadline_near` | Scheduled reminder | Affected user | account | in_app, push | mandatory | `/(tabs)/profile/settings` |

## Clubs: Books And Reading

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `club.book_nominated` | `nominate_club_book` RPC | Club members except nominator | clubs | in_app, push or batch | optional | `/(tabs)/clubs/:clubId/nominate` |
| `club.book_vote_cast` | `cast_club_book_vote` RPC | Nominator when threshold reached | clubs | in_app | optional | `/(tabs)/clubs/:clubId/nominate` |
| `club.voting_ending_soon` | Scheduled job | Members who have not voted | reminders | in_app, push | optional | `/(tabs)/clubs/:clubId/nominate` |
| `club.current_book_selected` | `finalize_club_book_nomination` or `set_club_current_book_from_nomination` RPC | Club members | clubs | in_app, push | optional | `/(tabs)/clubs/:clubId/reading` |
| `club.current_book_status_changed` | `set_club_current_book_reading_status` RPC | Club members | clubs | in_app | optional | `/(tabs)/clubs/:clubId/reading` |
| `club.reading_schedule_created` | `upsertClubReadingSchedule` insert | Club members | reminders | in_app, push | optional | `/(tabs)/clubs/:clubId/reading` |
| `club.reading_schedule_updated` | `upsertClubReadingSchedule` update | Club members | reminders | in_app, push | optional | `/(tabs)/clubs/:clubId/reading` |
| `club.reading_milestone_due` | Scheduled job | Club members behind milestone | reminders | in_app, push | optional | `/(tabs)/clubs/:clubId/reading` |

## Clubs: Events

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `club.event_created` | `createClubEvent` insert | Club members | events | in_app, push | optional | `/(tabs)/clubs/:clubId/events/:eventId/edit` |
| `club.event_updated` | `updateClubEvent` material change | Club members and RSVPs | events | in_app, push | optional | `/(tabs)/clubs/:clubId/events/:eventId/edit` |
| `club.event_cancelled` | `cancelClubEvent` update | Club members and RSVPs | events | in_app, push | optional | `/(tabs)/clubs/:clubId/events` |
| `club.event_rsvp_changed` | `upsertClubEventRsvp` | Event creator for important changes | events | in_app | optional | `/(tabs)/clubs/:clubId/events/:eventId/edit` |
| `club.event_reminder` | Scheduled job | `going` and `maybe` users | reminders | in_app, push | optional | `/(tabs)/clubs/:clubId/events` |
| `club.ama_question_answered` | AMA answer workflow | Question asker | events | in_app, push | optional | `/(tabs)/clubs/:clubId/events` |

## Clubs: Discussion And Moderation

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `discussion.topic_created` | `createClubDiscussionTopic` insert | Club members, batched | discussion | in_app, digest | optional | `/(tabs)/clubs/:clubId/discussion/:topicId` |
| `discussion.reply_created` | `createClubDiscussionReply` insert | Topic author or parent reply author | discussion | in_app, push | optional | `/(tabs)/clubs/:clubId/discussion/:topicId` |
| `discussion.mention_created` | Mention parser in topic/reply workflow | Mentioned user | discussion | in_app, push | optional | `/(tabs)/clubs/:clubId/discussion/:topicId` |
| `discussion.report_created` | `reportClubDiscussionContent` insert | Club moderators/admins | safety | in_app, push | mandatory for moderators | `/(tabs)/clubs/:clubId/manage?tab=moderation` |
| `discussion.report_resolved` | `resolveClubDiscussionReport` update | Reporter | safety | in_app | optional | `/(tabs)/clubs/:clubId/discussion` |
| `club.complaint_created` | Club complaint workflow | Club managers/platform | safety | in_app, push | mandatory for managers | `/(tabs)/clubs/:clubId/manage?tab=moderation` |
| `club.complaint_resolved` | `resolveClubComplaint` update | Reporter when appropriate | safety | in_app | optional | `/(tabs)/clubs/:clubId` |

## Credits And Account

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `credit.signup_bonus_granted` | `grant_signup_bonus` RPC | User | credits | in_app | optional | `/(tabs)/profile/credit-history` |
| `credit.referral_bonus_granted` | Credit event insert | User | credits | in_app, push | optional | `/(tabs)/profile/credit-history` |
| `credit.earned` | `complete_transaction` credit event | Lender | credits | in_app, push | optional | `/(tabs)/profile/credit-history` |
| `credit.hold_released` | Transaction decline/cancel/dispute resolution | Borrower | credits | in_app | optional | `/(tabs)/profile/credit-history` |
| `account.profile_completed` | Setup profile flow | User | account | in_app | optional | `/(tabs)/profile` |
| `account.security_notice` | Future account security workflow | User | safety | in_app, push | mandatory | `/(tabs)/profile/settings` |

## System And Operations

| Event type | Source workflow | Recipient | Category | Channel | Preference | Deep link |
|---|---|---|---|---|---|---|
| `system.maintenance_notice` | Admin/system workflow | Affected users | system | in_app, push | optional unless critical | `/(tabs)/profile/notifications` |
| `system.feature_announcement` | Admin/system workflow | Affected users | marketing | in_app | optional | `/(tabs)/profile/notifications` |
| `ops.delivery_exception_created` | Future delivery webhook workflow | Ops/admin | ops | in_app, push | mandatory for ops | Ops route when available |
| `ops.refund_case_created` | Future refund workflow | Ops/admin | ops | in_app, push | mandatory for ops | Ops route when available |
| `ops.reconciliation_case_created` | Future payment/ledger mismatch workflow | Ops/admin | ops | in_app, push | mandatory for ops | Ops route when available |
