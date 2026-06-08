import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { extractActivitiesWithAI } from '@/lib/ai/extract-activity';
import { fetchPage } from '@/lib/scraper/fetch';
import { htmlToCleanText } from '@/lib/scraper/parse-ai';

export const prerender = false;

const URL_RE = /^https?:\/\/\S+/i;

export const POST = withAdminAuth(async ({ request }) => {
  let text: string;
  try {
    const body = await request.json();
    text = (body.text ?? '').trim();
  } catch {
    return jsonError('Invalid JSON in request body', 400);
  }

  if (!text) return jsonError('No text provided', 400);

  // ── If a URL was pasted, fetch the page and extract clean text ───────────
  let contentText = text;
  if (URL_RE.test(text)) {
    try {
      const html = await fetchPage(text);
      contentText = htmlToCleanText(html, 10_000);
      if (contentText.length < 50) {
        return jsonResponse({
          ok: false,
          error: 'Page fetched but content was too short to extract from. The site may require JavaScript to render. Try copying and pasting the page text directly.',
        }, 422);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error('[activity-import] URL fetch failed:', msg);
      return jsonResponse({
        ok: false,
        error: `Could not fetch that URL (${msg}). The page may be private or block automated access. Try copying and pasting the text directly instead.`,
      }, 422);
    }
  }

  // ── AI extraction ────────────────────────────────────────────────────────
  let extracted;
  try {
    extracted = await extractActivitiesWithAI(contentText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[activity-import] AI extraction failed:', msg);
    return jsonResponse({ ok: false, error: msg }, 422);
  }

  if (extracted.length === 0) {
    return jsonResponse({
      ok: false,
      error: 'No activities could be extracted. Try adding more detail: name, dates, age group, cost.',
    }, 422);
  }

  // ── Resolve location & organization names against DB ─────────────────────
  const locationNames = [...new Set(extracted.map((a) => a.location_name).filter(Boolean))] as string[];
  const orgNames = [...new Set(extracted.map((a) => a.organization_name).filter(Boolean))] as string[];

  const locationMap: Record<string, string> = {};
  if (locationNames.length) {
    const { data: locs } = await supabaseAdmin
      .from('locations')
      .select('id, name')
      .in('name', locationNames);
    for (const loc of locs ?? []) locationMap[loc.name] = loc.id;
  }

  const orgMap: Record<string, string> = {};
  if (orgNames.length) {
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .in('name', orgNames)
      .eq('status', 'approved');
    for (const org of orgs ?? []) orgMap[org.name] = org.id;
  }

  // ── Create draft activities ──────────────────────────────────────────────
  const created = [];
  const errors = [];

  for (const act of extracted) {
    const locationId = act.location_name ? locationMap[act.location_name] ?? null : null;
    const orgId = act.organization_name ? orgMap[act.organization_name] ?? null : null;

    const notes: string[] = [`Imported via admin paste on ${new Date().toISOString().split('T')[0]}`];
    if (act.location_name && !locationId) notes.push(`Location not matched: "${act.location_name}" — add it manually`);
    if (act.organization_name && !orgId) notes.push(`Organization not matched: "${act.organization_name}" — add it manually`);

    const startDatetime = act.start_date && act.start_time
      ? `${act.start_date}T${act.start_time}:00`
      : act.start_date
      ? `${act.start_date}T00:00:00`
      : null;

    const endDatetime = act.end_date && act.end_time
      ? `${act.end_date}T${act.end_time}:00`
      : act.end_date
      ? `${act.end_date}T23:59:59`
      : null;

    const { data: row, error } = await supabaseAdmin
      .from('activities')
      .insert({
        name: act.name,
        description: act.description,
        activity_hierarchy_type: 'PROGRAM',
        program_format: act.program_format,
        activity_type: act.activity_type,
        min_grade: act.min_grade,
        max_grade: act.max_grade,
        min_age: act.min_age,
        max_age: act.max_age,
        cost: act.cost,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        is_summer: act.is_summer,
        is_fall: act.is_fall,
        is_winter: act.is_winter,
        is_spring: act.is_spring,
        location_id: locationId,
        location_details: !locationId && act.location_name ? act.location_name : null,
        sponsoring_organization_id: orgId,
        registration_link: act.registration_link,
        website: act.website,
        max_capacity: act.max_capacity,
        status: 'pending',
        notes: notes.join('\n'),
      })
      .select('id, name')
      .single();

    if (error) {
      console.error('[activity-import] Insert error:', error.message);
      errors.push({ name: act.name, error: error.message });
    } else {
      created.push({ id: row.id, name: row.name });
    }
  }

  if (created.length === 0) {
    return jsonResponse({ ok: false, error: 'All extractions failed to save', errors }, 500);
  }

  return jsonResponse({ ok: true, created, errors: errors.length ? errors : undefined });
});
