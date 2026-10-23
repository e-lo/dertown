/** A `public_events` row plus the location name the fetch script joins in. */
export interface NewsletterSourceEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  parent_event_id: string | null;
  featured: boolean | null;
  external_image_url: string | null;
  image_alt_text: string | null;
  primary_tag_name: string | null;
  cost: string | null;
  location_name: string | null;
}

/** One entry as the newsletter lists it; a recurring series collapses to one of these. */
export interface IssueEvent {
  /** Series parent id for a collapsed series, else the event id. */
  id: string;
  title: string;
  /** `YYYY-MM-DD` day the event is listed under. */
  displayDate: string;
  /** e.g. 'Sat, Nov 1 · 7pm', 'Fri–Sun, Oct 30–Nov 1', 'Tuesdays & Thursdays · 6pm'. */
  whenLabel: string;
  locationName: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  description: string | null;
  featured: boolean;
  tag: string | null;
  /** Every source row id, for the pre-send re-check. */
  occurrenceIds: string[];
}

export interface IssueEntry {
  event: IssueEvent;
  blurb?: string;
}

export interface NewsletterAnnouncement {
  title: string;
  body: string;
  url?: string;
}

/** The draft the skill writes to `newsletters/<sendDate>.json`. */
export interface NewsletterIssue {
  sendDate: string;
  subject: string;
  previewText: string;
  intro: string;
  featured: IssueEntry[];
  thisWeek: IssueEntry[];
  planAhead: IssueEntry[];
  announcements?: NewsletterAnnouncement[];
}
