import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import {
  DEFAULT_NAME_MATCH_THRESHOLD,
  POSSIBLE_NAME_MATCH_THRESHOLD,
  findBestNameMatch,
} from '@/lib/entity-matching';

export const prerender = false;

export const GET = withAdminAuth(async ({ url }) => {
  const all = url.searchParams.get('all') === 'true';
  const includeDuplicates = url.searchParams.get('includeDuplicates') === 'true';
  let query = supabaseAdmin
    .from('locations')
    .select(
      'id, name, address, phone, website, latitude, longitude, parent_location_id, status, updated_at'
    )
    .order('name');

  if (!all) {
    query = query.eq('status', 'approved');
  }

  const { data: locations, error } = await query;

  if (error) {
    console.error('Error fetching locations:', error);
    return jsonError('Failed to fetch locations');
  }

  const rows = locations || [];
  if (!all || !includeDuplicates) {
    return jsonResponse(rows);
  }

  const canonicalCandidates = rows.filter((row) => row.status !== 'pending');
  const withDuplicates = rows.map((row) => {
    if (row.status !== 'pending' || !row.name) {
      return row;
    }

    const bestMatch = findBestNameMatch(
      row.name,
      canonicalCandidates
        .filter((candidate) => candidate.id !== row.id)
        .map((candidate) => ({
          id: candidate.id,
          name: candidate.name || '',
          address: candidate.address || null,
        })),
      { includeAddress: true }
    );

    if (!bestMatch || bestMatch.score < POSSIBLE_NAME_MATCH_THRESHOLD) {
      return { ...row, likely_duplicate: null };
    }

    const candidate = canonicalCandidates.find((item) => item.id === bestMatch.id);
    if (!candidate) return { ...row, likely_duplicate: null };

    return {
      ...row,
      likely_duplicate: {
        id: candidate.id,
        name: candidate.name,
        address: candidate.address,
        score: Math.round(bestMatch.score * 100) / 100,
        match_level:
          bestMatch.score >= DEFAULT_NAME_MATCH_THRESHOLD ? 'likely' : 'possible',
      },
    };
  });

  return jsonResponse(withDuplicates);
});

export const POST = withAdminAuth(async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return jsonError('Name is required', 400);
  }

  const insert: Record<string, unknown> = {
    name,
    status: body.status ?? 'approved',
    address: body.address?.trim() || null,
    phone: body.phone?.trim() || null,
    website: body.website?.trim() || null,
    parent_location_id: body.parent_location_id || null,
  };
  if (typeof body.latitude === 'number' && typeof body.longitude === 'number') {
    insert.latitude = body.latitude;
    insert.longitude = body.longitude;
  } else {
    insert.latitude = null;
    insert.longitude = null;
  }

  const { data, error } = await supabaseAdmin.from('locations').insert(insert).select().single();

  if (error) {
    console.error('Error creating location:', error);
    return jsonError(error.message);
  }

  return jsonResponse(data, 201);
});
