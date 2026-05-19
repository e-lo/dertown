import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { findEventDuplicateHint } from '@/lib/event-duplicate';

export const prerender = false;

export const GET = withAdminAuth(async ({ url, auth }) => {
  const today = new Date().toISOString().split('T')[0];

  const eventSelect = `
    *,
    primary_tag:tags!events_primary_tag_id_fkey(name),
    secondary_tag:tags!events_secondary_tag_id_fkey(name),
    location:locations!events_location_id_fkey(name, address),
    organization:organizations!events_organization_id_fkey(name)
  `;

  let pendingQuery = supabaseAdmin
    .from('events')
    .select(eventSelect)
    .eq('status', 'pending')
    .order('start_date', { ascending: true });

  let otherQuery = supabaseAdmin
    .from('events')
    .select(eventSelect)
    .neq('status', 'approved')
    .neq('status', 'pending')
    .neq('status', 'archived')
    .neq('status', 'cancelled')
    .gte('start_date', today)
    .order('start_date', { ascending: true });

  if (!auth.isSuperAdmin) {
    pendingQuery = pendingQuery.in('organization_id', auth.organizationIds);
    otherQuery = otherQuery.in('organization_id', auth.organizationIds);
  }

  const [{ data: pendingEvents, error: pendingError }, { data: otherEvents, error: otherError }] =
    await Promise.all([pendingQuery, otherQuery]);

  if (pendingError || otherError) {
    console.error('Error fetching events:', pendingError || otherError);
    return jsonError('Failed to fetch events');
  }

  const data = [...(pendingEvents || []), ...(otherEvents || [])];

  // Duplicate hints only for super admins
  if (!auth.isSuperAdmin) {
    return jsonResponse({ events: data });
  }

  const { data: approvedEvents, error: approvedError } = await supabaseAdmin
    .from('events')
    .select('id, title, start_date, start_time, location_id, organization_id, parent_event_id, source_id')
    .eq('status', 'approved');

  if (approvedError) {
    console.error('Error fetching approved events for duplicate hints:', approvedError);
    return jsonResponse({ events: data });
  }

  const parentTitles = new Map<string, string>();
  for (const e of data) parentTitles.set(e.id, e.title);
  for (const e of approvedEvents || []) {
    if (!parentTitles.has(e.id)) parentTitles.set(e.id, e.title || '');
  }

  const eventsWithDuplicateHints = data.map((event) => ({
    ...event,
    likely_duplicate: findEventDuplicateHint(event, approvedEvents || []),
    parent_title: event.parent_event_id ? parentTitles.get(event.parent_event_id) || null : null,
  }));

  return jsonResponse({ events: eventsWithDuplicateHints });
});

export const PUT = withAdminAuth(async ({ request, auth }) => {
  const { id, location_added, organization_added, ...updateData } = await request.json();

  if (!id) {
    return jsonError('Event ID is required', 400);
  }

  // Org editors can only update events belonging to their organizations
  if (!auth.isSuperAdmin) {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('events')
      .select('organization_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return jsonError('Event not found', 404);
    }

    if (!existing.organization_id || !auth.organizationIds.includes(existing.organization_id)) {
      return jsonError('Forbidden: event does not belong to your organization', 403);
    }
    // Org editors can publish (approve) events for their own organizations directly.
  }

  let locationId = updateData.location_id;
  let organizationId = updateData.organization_id;

  if (location_added && location_added.trim()) {
    const { data: newLocation, error: locationError } = await supabaseAdmin
      .from('locations')
      .insert({ name: location_added.trim(), status: 'approved' })
      .select()
      .single();
    if (locationError) {
      console.error('Location creation error:', locationError);
      return jsonError('Failed to create new location');
    }
    if (newLocation) locationId = newLocation.id;
  }

  if (organization_added && organization_added.trim()) {
    const { data: newOrganization, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: organization_added.trim(), status: 'approved' })
      .select()
      .single();
    if (orgError) {
      console.error('Organization creation error:', orgError);
      return jsonError('Failed to create new organization');
    }
    if (newOrganization) organizationId = newOrganization.id;
  }

  if (locationId !== undefined) updateData.location_id = locationId;
  if (organizationId !== undefined) updateData.organization_id = organizationId;

  const cleanedData: any = {};
  for (const [key, value] of Object.entries(updateData)) {
    if (key === 'location_added' || key === 'organization_added') continue;
    cleanedData[key] = (value === '' || value === null || value === undefined) ? null : value;
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .update(cleanedData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating event:', error);
    return jsonError('Failed to update event');
  }

  if (!data || data.length === 0) {
    return jsonError('Event not found', 404);
  }

  return jsonResponse({ event: data[0] });
});
