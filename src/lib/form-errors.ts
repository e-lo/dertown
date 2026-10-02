// User-facing messages for failed public form submissions.

const SUBMIT_FALLBACK = 'Failed to submit event. Please try again.';

interface ValidationIssue {
  path: PropertyKey[];
  message: string;
}

/** One line per Zod issue, prefixed with the field it belongs to. */
export function describeValidationIssues(issues: readonly ValidationIssue[]): string {
  return issues
    .map((issue) =>
      issue.path.length ? `${issue.path.map(String).join('.')}: ${issue.message}` : issue.message
    )
    .join('\n');
}

/**
 * Message for a non-OK response from a submit route, whose body is
 * `{ error, details? }` — `details` is a flattened Zod error on 400s.
 */
export function describeSubmitFailure(body: unknown): string {
  if (!body || typeof body !== 'object' || !('error' in body) || typeof body.error !== 'string') {
    return SUBMIT_FALLBACK;
  }
  const lines = [body.error];
  const details = 'details' in body ? body.details : undefined;
  if (details && typeof details === 'object' && 'fieldErrors' in details) {
    const fieldErrors = (details.fieldErrors ?? {}) as Record<string, string[] | undefined>;
    for (const [field, messages] of Object.entries(fieldErrors)) {
      for (const message of messages ?? []) lines.push(`${field}: ${message}`);
    }
  }
  return lines.join('\n');
}
