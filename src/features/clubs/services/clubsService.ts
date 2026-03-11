import * as clubsApplicationsService from './clubsApplicationsService';
import * as clubsBooksService from './clubsBooksService';
import * as clubsEventsService from './clubsEventsService';
import * as clubsInvitationsService from './clubsInvitationsService';
import * as clubsManagementService from './clubsManagementService';
import * as clubsMembershipService from './clubsMembershipService';
import * as clubsReadService from './clubsReadService';

export type {
    AccessLevel,
    Club,
    ClubBookSummary,
    ClubCurrentBookReadingStatus,
    ClubCurrentBookStatusOverview,
    ClubBookNomination,
    ClubBookNominationStatus,
    ClubBookNominationWithDetails,
    ClubEvent,
    ClubEventFormat,
    ClubEventInput,
    ClubEventRsvp,
    ClubEventRsvpStatus,
    ClubEventStatus,
    ClubEventWithDetails,
    ClubBookVote,
    ClubFilters,
    ClubInvitation,
    ClubInvitationStatus,
    ClubInvitationWithProfiles,
    ClubJoinApplication,
    ClubJoinApplicationStatus,
    ClubJoinApplicationWithProfile,
    ClubJoinQuestion,
    ClubJoinQuestionInput,
    ClubMember,
    ClubMemberWithProfile,
    ClubPublicDetails,
    ClubVenueLink,
    ClubVenueSummary,
    ClubType,
    ClubWithBook,
    ClubWithDetails,
    CreateClubEventInput,
    ClubNominationBookSummary,
    CreateClubInput,
    JoinClubResult,
    MemberRole,
    MemberStatus,
    MembershipLimitAction,
    MembershipLimitResult,
    MembershipTier,
    MeetingType,
    NominateClubBookInput,
    ReviewApplicationDecision,
    UpdateClubEventInput,
    UpdateClubInput,
} from './clubsService.types';

export const clubsService = {
    ...clubsReadService,
    ...clubsManagementService,
    ...clubsMembershipService,
    ...clubsApplicationsService,
    ...clubsBooksService,
    ...clubsEventsService,
    ...clubsInvitationsService,
};