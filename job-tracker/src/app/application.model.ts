export const STAGES = [
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer' },
  { id: 'closed', label: 'Closed' },
] as const;

export type Stage = (typeof STAGES)[number]['id'];

export interface Application {
  id: string;
  company: string;
  role: string;
  stage: Stage;
  location: string;
  url: string;
  salary: string;
  /** ISO dates (yyyy-mm-dd) so they compare as strings and survive JSON round-trips. */
  appliedOn: string | null;
  followUpOn: string | null;
  notes: string;
  createdAt: number;
}

export type ApplicationDraft = Omit<Application, 'id' | 'createdAt'>;

export type FollowUpStatus = 'overdue' | 'today' | 'upcoming';
