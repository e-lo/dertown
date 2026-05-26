// src/lib/email-ingest/types.ts

export interface MailgunPayload {
  sender: string;           // envelope from (bare email)
  recipient: string;        // envelope to
  from: string;             // From header (may include display name)
  subject: string;
  'body-plain'?: string;
  'body-html'?: string;
  'stripped-text'?: string; // new content only (quoted reply removed)
  'stripped-html'?: string;
  timestamp: string;
  token: string;
  signature: string;
}

export type EmailIntent =
  | { type: 'scrape'; url: string }
  | { type: 'announcement'; title: string; body: string }
  | { type: 'event'; body: string };

// Subset of EventDuplicateHint — intentionally omits score and start_date (not needed by consumers)
export interface DuplicateHint {
  id: string;
  title: string | null;
  match_level: 'likely' | 'possible';
}

export type ProcessResult =
  | { status: 'rejected_sender' }
  | { status: 'screened_out'; reason: string }
  | { status: 'event_staged'; id: string; duplicateHint?: DuplicateHint }
  | { status: 'announcement_created'; id: string }
  | { status: 'scrape_queued'; url: string; count: number };
