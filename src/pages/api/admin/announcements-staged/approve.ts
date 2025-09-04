import type { APIRoute } from 'astro';
import { db } from '../../../../lib/supabase.ts';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { announcementId } = await request.json();
    if (!announcementId) {
      return new Response(JSON.stringify({ error: 'Announcement ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Get the JWT from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          error:
            'You must be logged in as an admin to approve announcements. Please log in with an admin account.',
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    // TODO: Check if user is admin (implement your admin check logic here)
    // If not admin:
    // return new Response(JSON.stringify({ error: 'Only admins can approve announcements. Please log in with an admin account.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    // Get the staged announcement
    const { data: staged, error: fetchError } =
      await db.announcementsStaged.getById(announcementId);
    if (fetchError || !staged) {
      return new Response(JSON.stringify({ error: 'Staged announcement not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Create new organization if needed
    let organizationId = staged.organization;
    if (staged.organization_added) {
      const { data: newOrg, error: orgError } = await db.organizations.create({
        name: staged.organization_added,
        status: 'approved',
      } as any);
      if (orgError) {
        return new Response(JSON.stringify({ error: 'Failed to create new organization' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (newOrg) {
        const orgArray = newOrg as unknown as { id: string }[];
        if (orgArray && orgArray.length > 0) {
          organizationId = orgArray[0].id;
        }
      }
    }
    // Create the approved announcement
    const { error: createError } = await db.announcements.create({
      title: staged.title,
      message: staged.message,
      link: staged.link,
      email: staged.email,
      organization_id: organizationId || null,
      author: staged.author,
      show_at: staged.show_at,
      expires_at: staged.expires_at,
      comments: staged.comments,
      status: 'published',
    });
    if (createError) {
      return new Response(JSON.stringify({ error: 'Failed to create approved announcement' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Delete the staged announcement
    const { error: deleteError } = await db.announcementsStaged.delete(announcementId);
    if (deleteError) {
      // Don't fail the request if deletion fails, as the announcement was already created
    }
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'An unexpected error occurred' }), {
      status: 500,
    });
  }
};
