// src/lib/email-ingest/types.ts

export interface CloudMailinPayload {
  envelope: {
    from: string;
    to: string;
    helo_domain?: string;
  };
  headers: {
    subject?: string;
    date?: string;
    [key: string]: string | undefined;
  };
  plain?: string;
  html?: string;
  reply_plain?: string;
  attachments?: Array<{
    file_name: string;
    content_type: string;
    size: number;
  }>;
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
