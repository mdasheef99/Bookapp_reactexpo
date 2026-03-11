import type { AccessLevel, MemberRole, MemberStatus, MembershipTier } from './clubsService.types';

const MEMBERSHIP_TIER_LABELS: Record<MembershipTier, string> = {
    free: 'Free',
    pro: 'Pro',
    pro_plus: 'Pro+',
};

const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
    all: 'All members',
    pro: 'Pro members',
    pro_plus: 'Pro+ members',
};

const MEMBERSHIP_TIER_RANK: Record<MembershipTier, number> = {
    free: 0,
    pro: 1,
    pro_plus: 2,
};

const ACCESS_LEVEL_MINIMUM_TIER: Record<AccessLevel, MembershipTier> = {
    all: 'free',
    pro: 'pro',
    pro_plus: 'pro_plus',
};

export function getMembershipTierLabel(tier: MembershipTier | null | undefined) {
    return tier ? MEMBERSHIP_TIER_LABELS[tier] : 'Unknown';
}

export function getAccessLevelLabel(accessLevel: AccessLevel | null | undefined) {
    return ACCESS_LEVEL_LABELS[accessLevel ?? 'all'];
}

export function membershipTierSatisfiesAccessLevel(tier: MembershipTier | null | undefined, accessLevel: AccessLevel | null | undefined) {
    return MEMBERSHIP_TIER_RANK[tier ?? 'free'] >= MEMBERSHIP_TIER_RANK[ACCESS_LEVEL_MINIMUM_TIER[accessLevel ?? 'all']];
}

export function canHoldPrivilegedClubRole(tier: MembershipTier | null | undefined) {
    return MEMBERSHIP_TIER_RANK[tier ?? 'free'] >= MEMBERSHIP_TIER_RANK.pro;
}

export function isActiveEligibleClubManager(input: {
    userId?: string | null;
    clubAdminId?: string | null;
    role?: MemberRole | null;
    status?: MemberStatus | null;
    membershipTier?: MembershipTier | null;
    accessLevel?: AccessLevel | null;
}) {
    const { userId, clubAdminId, role, status, membershipTier, accessLevel } = input;
    if (!userId) return false;

    const tierEligible = canHoldPrivilegedClubRole(membershipTier)
        && membershipTierSatisfiesAccessLevel(membershipTier, accessLevel);

    if (!tierEligible) return false;
    if (clubAdminId && userId === clubAdminId) return true;
    if (role === 'admin') return true;
    return role === 'moderator' && status === 'active';
}

export function getClubAccessRequirementMessage(accessLevel: AccessLevel | null | undefined, membershipTier: MembershipTier | null | undefined, actionLabel = 'complete this club action') {
    const minimumTier = ACCESS_LEVEL_MINIMUM_TIER[accessLevel ?? 'all'];
    return `This club requires ${getAccessLevelLabel(accessLevel)}. Your current tier is ${getMembershipTierLabel(membershipTier)}, so you cannot ${actionLabel} until your membership tier meets that requirement.`;
}

export function getModeratorEligibilityMessage(accessLevel: AccessLevel | null | undefined, membershipTier: MembershipTier | null | undefined) {
    if (!canHoldPrivilegedClubRole(membershipTier)) {
        return `Only Pro or Pro+ users can become club moderators. This member is currently on the ${getMembershipTierLabel(membershipTier)} tier.`;
    }

    return `This member's current tier does not satisfy the club access requirement of ${getAccessLevelLabel(accessLevel)}.`;
}

export function getClubsEntitlementErrorMessage(error: unknown, fallback = 'Unable to complete this club action right now.') {
    const message = error instanceof Error ? error.message.trim() : '';
    const normalized = message.toLowerCase();

    if (!message) return fallback;
    if (normalized.includes('membership tier does not satisfy this club access level') || normalized.includes('applicant membership tier does not satisfy this club access level')) {
        return 'Your membership tier does not satisfy this club\'s access requirement.';
    }
    if (normalized.includes('only pro or pro+ users who meet the club access level may be moderators')) {
        return 'Only Pro or Pro+ users whose tier matches the club access requirement can be moderators.';
    }
    if (normalized.includes('only the club owner with an eligible pro or pro+ membership tier may be an admin')) {
        return 'Only the eligible Pro/Pro+ club owner can remain the admin for this club.';
    }
    if (normalized.includes('only pro or pro+ users can create or own clubs')) {
        return 'Only Pro or Pro+ users can create or own clubs.';
    }
    if (normalized.includes('only eligible moderators or admins can send invitations')) {
        return 'Only eligible Pro/Pro+ moderators or the club admin can send invitations for this club.';
    }
    if (normalized.includes('only eligible moderators or admins can review applications')) {
        return 'Only eligible Pro/Pro+ moderators or the club admin can review applications for this club.';
    }
    if (normalized.includes('only active club members can rsvp')) {
        return 'Only active club members can RSVP to this club event.';
    }
    if (normalized.includes('cancelled events cannot accept new rsvps')) {
        return 'Cancelled events cannot accept new RSVPs.';
    }
    if (normalized.includes('only eligible managers can create club events')) {
        return 'Only the eligible club admin or an eligible moderator can create events for this club.';
    }
    if (normalized.includes('only active club members can vote') || normalized.includes('only active club members can nominate books')) {
        return 'Only active club members can participate in book nominations and voting for this club.';
    }
    if (normalized.includes('only the club admin can finalize the current book')) {
        return 'Only the club admin can finalize the current book for this club.';
    }
    if (normalized.includes('cannot change club access level while active members do not satisfy the new access level')) {
        return 'You cannot raise this club access level while current active members would no longer qualify.';
    }
    if (normalized.includes('membership tier club creation limit reached')) {
        return 'This account has reached its current club creation limit.';
    }
    if (normalized.includes('violates row-level security policy')) {
        return 'Your current membership tier or club role does not allow this action.';
    }

    return message || fallback;
}