import type { Resend } from 'resend';

/**
 * Add a confirmed email to the newsletter segment.
 *
 * Re-confirming an existing contact (including one who unsubscribed earlier)
 * resubscribes them: they just clicked a link we emailed them.
 */
export async function addConfirmedSubscriber(
  resend: Resend,
  segmentId: string,
  email: string
): Promise<void> {
  const existing = await resend.contacts.get({ email });

  if (existing.data) {
    const updated = await resend.contacts.update({ email, unsubscribed: false });
    if (updated.error) throw new Error(`Resend contacts.update failed: ${updated.error.message}`);
    const added = await resend.contacts.segments.add({ email, segmentId });
    if (added.error) throw new Error(`Resend contacts.segments.add failed: ${added.error.message}`);
    return;
  }

  const created = await resend.contacts.create({
    email,
    unsubscribed: false,
    segments: [{ id: segmentId }],
  });
  if (created.error) throw new Error(`Resend contacts.create failed: ${created.error.message}`);
}
