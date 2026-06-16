import type { TablesInsert } from './supabase';
import type { AnnouncementFormData } from './validation';
import { ANNOUNCEMENT_DEFAULT_EXPIRY_DAYS } from './constants';

/**
 * Build the row written to `announcements_staged` from a validated public
 * submission.
 *
 * The staged table keys organizations by NAME, not id: `organization` holds the
 * name of an existing approved org (re-resolved by name on approval) and
 * `organization_added` holds the name of a brand-new org to create. The public
 * form, however, sends an existing org as a UUID (`organization_id`), so the
 * caller must resolve that id to a name and pass it in as `organizationName`.
 *
 * @param formData         Validated announcement form data.
 * @param organizationName Resolved name of the selected existing organization,
 *                         or null when none was selected (or it couldn't be
 *                         resolved). When set, it takes precedence over a
 *                         free-text `organization_added`.
 */
export function buildStagedAnnouncement(
  formData: AnnouncementFormData,
  organizationName: string | null = null
): TablesInsert<'announcements_staged'> {
  // show_at defaults to now; expires_at defaults to show_at + N days.
  const showAt = formData.show_at ? new Date(formData.show_at) : new Date();
  const expiresAt = formData.expires_at ? new Date(formData.expires_at) : new Date(showAt);
  if (!formData.expires_at) {
    expiresAt.setDate(expiresAt.getDate() + ANNOUNCEMENT_DEFAULT_EXPIRY_DAYS);
  }

  return {
    title: formData.title,
    message: formData.message,
    link: formData.link || null,
    email: formData.email || null,
    author: formData.author || null,
    comments: formData.comments || null,
    show_at: showAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    organization: organizationName,
    // A new-org name only applies when no existing org was resolved.
    organization_added:
      !organizationName && formData.organization_added ? formData.organization_added : null,
    status: 'pending',
  };
}
