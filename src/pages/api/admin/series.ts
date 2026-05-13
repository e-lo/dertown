import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';

export const prerender = false;

export const GET = withAdminAuth(async ({ auth }) => {
  const today = new Date().toISOString().split('T')[0];

  // Get unique parent_event_id values, scoped by org for org editors
  let childQuery = supabaseAdmin
    .from('events')
    .select('parent_event_id')
    .not('parent_event_id', 'is', null);

  if (!auth.isSuperAdmin) {
    childQuery = childQuery.in('organization_id', auth.organizationIds);
  }

  const { data: childEvents, error: childError } = await childQuery;

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

  const eventSelect = `
    *,
    primary_tag:tags!events_primary_tag_id_fkey(name),
    secondary_tag:tags!events_secondary_tag_id_fkey(name),
    location:locations!events_location_id_fkey(name, address),
    organization:organizations!events_organization_id_fkey(name)
  `;

  const [{ data: parentEvents, error: parentError }, { data: allChildEvents, error: allChildError }] =
    await Promise.all([
      supabaseAdmin.from('events').select(eventSelect).in('id', parentEventIds),
      supabaseAdmin
        .from('events')
        .select(eventSelect)
        .in('parent_event_id', parentEventIds)
        .order('start_date', { ascending: true }),
    ]);

  if (parentError || allChildError) {
    console.error('Error fetching series data:', parentError || allChildError);
    return jsonError('Failed to fetch series data');
  }

  const childrenByParent = new Map<string, typeof allChildEvents>();
  (allChildEvents || []).forEach((child) => {
    if (child.parent_event_id) {
      if (!childrenByParent.has(child.parent_event_id)) {
        childrenByParent.set(child.parent_event_id, []);
      }
      childrenByParent.get(child.parent_event_id)!.push(child);
    }
  });

  const activeSeries: any[] = [];
  const pastSeries: any[] = [];

  (parentEvents || []).forEach((parent) => {
    const children = childrenByParent.get(parent.id) || [];
    const futureChildren = children.filter((c) => c.start_date >= today);
    const pastChildren = children.filter((c) => c.start_date < today);
    const allDates = children.map((c) => c.start_date).filter(Boolean).sort();
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

    if (futureChildren.length > 0) {
      activeSeries.push(seriesData);
    } else {
      pastSeries.push(seriesData);
    }
  });

  activeSeries.sort((a, b) => (a.futureChildren[0]?.start_date || '').localeCompare(b.futureChildren[0]?.start_date || ''));
  pastSeries.sort((a, b) => (b.dateRange?.latest || '').localeCompare(a.dateRange?.latest || ''));

  return jsonResponse({ activeSeries, pastSeries });
});
