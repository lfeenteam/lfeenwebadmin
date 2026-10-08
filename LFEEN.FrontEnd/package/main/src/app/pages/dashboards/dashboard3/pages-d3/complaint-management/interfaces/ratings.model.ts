// Client support ratings — read-only admin view of the 1-5 star rating (and optional
// comment) a client leaves after a support chat ends.

export const CLIENT_RATINGS_PAGE_SIZE = 20;

export const RATING_STARS = [5, 4, 3, 2, 1] as const;

export interface ClientRatingSummary {
  averageRating: number;
  totalRated: number;
  // Always has the string keys "1"-"5"; computed over the full filtered set, not the page.
  distribution: Record<string, number>;
}

export interface ClientRatingItem {
  sessionExternalId: string;
  // Always equal to sessionExternalId — the admin "ticket" is the session itself.
  ticketExternalId: string;
  sessionNumber: string;
  clientName: string | null;
  department: string | null;
  // Both null when the session closed with no agent ever assigned (bot-only conversation).
  assignedAgentUserId: string | null;
  assignedAgentName: string | null;
  rating: number;
  // Admin-only free text; never exposed on the client's or the agent's chat view.
  comment: string | null;
  ratedAtUtc: string;
  closedAtUtc: string | null;
  closedBy: 'Client' | 'Admin' | 'Bot' | string;
}

export interface ClientRatingListResponse {
  summary: ClientRatingSummary;
  data: ClientRatingItem[];
  totalCount: number;
  page: number;
  nextpage: number | null;
  totalPages: number;
}

export interface ClientRatingQueryParams {
  // Ignored/overwritten server-side for admins without ClientTickets.ViewAllRatings.
  agentUserId?: string;
  department?: string;
  minRating?: number;
  maxRating?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

// GET /api/client-tickets/ratings/by-agent — one row per agent with at least one rated
// session; agentUserId null is the group of sessions closed with no agent assigned.
export interface ClientRatingByAgentItem {
  agentUserId: string | null;
  agentName: string | null;
  averageRating: number;
  totalRated: number;
  distribution: Record<string, number>;
}

export interface ClientRatingByAgentQueryParams {
  department?: string;
  from?: string;
  to?: string;
}
