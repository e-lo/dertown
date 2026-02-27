import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async () => {
  const today = new Date().toISOString().split('T')[0];

  // Get all parent events (events that have children)
  // First, get all unique parent_event_id values
  const { data: childEvents, error: childError } = await supabaseAdmin
    .from('events')
    .select('parent_event_id')
    .not('parent_event_id', 'is', null);

  if (childError) {
    console.error('Error fetching child events:', childError);
    return jsonError('Failed to fetch series data');
  }

  const parentEventIds = [
    ...new Set(
      (childEvents || []).map((e) => e.parent_event_id).filter((id): id is string => id !== null)
    ),
  ];

  if (parentEventIds.length === 0) {
    return jsonResponse({ activeSeries: [], pastSeries: [] });
  }

  // Fetch parent events
  const { data: parentEvents, error: parentError } = await supabaseAdmin
    .from('events')
    .select(
      `
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `
    )
    .in('id', parentEventIds);

  if (parentError) {
    console.error('Error fetching parent events:', parentError);
    return jsonError('Failed to fetch series data');
  }

  // Fetch all child events for these parents
  const { data: allChildEvents, error: allChildError } = await supabaseAdmin
    .from('events')
    .select(
      `
      *,
      primary_tag:tags!events_primary_tag_id_fkey(name),
      secondary_tag:tags!events_secondary_tag_id_fkey(name),
      location:locations!events_location_id_fkey(name, address),
      organization:organizations!events_organization_id_fkey(name)
    `
    )
    .in('parent_event_id', parentEventIds)
    .order('start_date', { ascending: true });

  if (allChildError) {
    console.error('Error fetching child events:', allChildError);
    return jsonError('Failed to fetch series data');
  }

  // Group child events by parent
  const childrenByParent = new Map<string, typeof allChildEvents>();
  (allChildEvents || []).forEach((child) => {
    if (child.parent_event_id) {
      if (!childrenByParent.has(child.parent_event_id)) {
        childrenByParent.set(child.parent_event_id, []);
      }
      childrenByParent.get(child.parent_event_id)!.push(child);
    }
  });

  // Build series data with metadata
  const activeSeries: any[] = [];
  const pastSeries: any[] = [];

  (parentEvents || []).forEach((parent) => {
    const children = childrenByParent.get(parent.id) || [];

    // Calculate metadata
    const futureChildren = children.filter((c) => c.start_date >= today);
    const pastChildren = children.filter((c) => c.start_date < today);
    const allDates = children
      .map((c) => c.start_date)
      .filter(Boolean)
      .sort();
    const dateRange =
      allDates.length > 0
        ? { earliest: allDates[0], latest: allDates[allDates.length - 1] }
        : null;

    const seriesData = {
      parent,
      children,
      totalCount: children.length,
      futureCount: futureChildren.length,
      pastCount: pastChildren.length,
      dateRange,
      futureChildren,
      pastChildren,
    };

    // Categorize: active if has future events, past if only past events
    if (futureChildren.length > 0) {
      activeSeries.push(seriesData);
    } else {
      pastSeries.push(seriesData);
    }
  });

  // Sort active series by earliest future date, past series by latest past date
  activeSeries.sort((a, b) => {
    const aDate = a.futureChildren[0]?.start_date || '';
    const bDate = b.futureChildren[0]?.start_date || '';
    return aDate.localeCompare(bDate);
  });

  pastSeries.sort((a, b) => {
    const aDate = a.dateRange?.latest || '';
    const bDate = b.dateRange?.latest || '';
    return bDate.localeCompare(aDate); // Most recent first
  });

  return jsonResponse({ activeSeries, pastSeries });
});
