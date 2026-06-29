import { supabaseAdmin } from '@/lib/supabase';
import { withAdminAuth, jsonResponse, jsonError } from '@/lib/api-utils';
import { extractActivitiesWithAI, type ExtractedNode } from '@/lib/ai/extract-activity';
import { fetchPage } from '@/lib/scraper/fetch';
import { htmlToCleanText } from '@/lib/scraper/parse-ai';
import { findBestNameMatch, nameMatchScore } from '@/lib/entity-matching';

export const prerender = false;

const URL_RE = /^https?:\/\/\S+/i;

// How similar a NAME must be to auto-merge on import. Matching is name-only
// (NOT org/website) on purpose: that lets you deliberately keep separate
// programs under one organization — only near-identical names merge. PROGRAM
// catches AI name variants ("Icicle Creek" vs "Icicle Creek Center for the Arts"
// ~0.95 and re-imports) while leaving distinctly named programs ("…Music Camp"
// vs "…Theater Camp" ~0.82) separate. Use the admin Merge action to combine
// programs by hand when you do want them joined.
const PROGRAM_MERGE_THRESHOLD = 0.9;
const CHILD_MERGE_THRESHOLD = 0.85;

/** Reduce an ISO datetime to its YYYY-MM-DD date portion (for instance dedup). */
function datePortion(dt: string | null | undefined): string | null {
  if (!dt) return null;
  return dt.slice(0, 10);
}

function startDatetimeOf(node: ExtractedNode): string | null {
  if (node.start_date && node.start_time) return `${node.start_date}T${node.start_time}:00`;
  if (node.start_date) return `${node.start_date}T00:00:00`;
  return null;
}

function endDatetimeOf(node: ExtractedNode): string | null {
  if (node.end_date && node.end_time) return `${node.end_date}T${node.end_time}:00`;
  if (node.end_date) return `${node.end_date}T23:59:59`;
  return null;
}

/** Collect every distinct location/org name across the whole tree. */
function collectNames(nodes: ExtractedNode[], locs: Set<string>, orgs: Set<string>): void {
  for (const n of nodes) {
    if (n.location_name) locs.add(n.location_name);
    if (n.organization_name) orgs.add(n.organization_name);
    if (n.children.length) collectNames(n.children, locs, orgs);
  }
}

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

  // ── AI extraction (returns a tree of PROGRAM roots) ──────────────────────
  let roots: ExtractedNode[];
  try {
    roots = await extractActivitiesWithAI(contentText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[activity-import] AI extraction failed:', msg);
    return jsonResponse({ ok: false, error: msg }, 422);
  }

  if (roots.length === 0) {
    return jsonResponse({
      ok: false,
      error: 'No activities could be extracted. Try adding more detail: name, dates, age group, cost.',
    }, 422);
  }

  // ── Resolve location & organization names against DB (whole tree) ────────
  const locSet = new Set<string>();
  const orgSet = new Set<string>();
  collectNames(roots, locSet, orgSet);

  const locationMap: Record<string, string> = {};
  if (locSet.size) {
    const { data: locs } = await supabaseAdmin
      .from('locations')
      .select('id, name')
      .in('name', [...locSet]);
    for (const loc of locs ?? []) locationMap[loc.name] = loc.id;
  }

  const orgMap: Record<string, string> = {};
  if (orgSet.size) {
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .in('name', [...orgSet])
      .eq('status', 'approved');
    for (const org of orgs ?? []) orgMap[org.name] = org.id;
  }

  const today = new Date().toISOString().split('T')[0];
  const errors: Array<{ name: string; error: string }> = [];
  const counts = {
    created: { PROGRAM: 0, SESSION: 0, CLASS_TYPE: 0, CLASS_INSTANCE: 0 } as Record<string, number>,
    reused: { PROGRAM: 0, SESSION: 0, CLASS_TYPE: 0, CLASS_INSTANCE: 0 } as Record<string, number>,
  };

  /**
   * Insert a node (and its subtree) depth-first. Reuses an existing matching row
   * instead of inserting a duplicate so re-imports merge rather than fork.
   * Returns the row id to use as the parent for children, or null on failure.
   */
  async function insertNode(node: ExtractedNode, parentId: string | null): Promise<string | null> {
    const level = node.suggested_level;
    const locationId = node.location_name ? locationMap[node.location_name] ?? null : null;
    const orgId = node.organization_name ? orgMap[node.organization_name] ?? null : null;

    // ── Dedup: reuse an existing matching row so re-imports merge, not fork ──
    if (level === 'PROGRAM') {
      const { data: progs } = await supabaseAdmin
        .from('activities')
        .select('id, name')
        .eq('activity_hierarchy_type', 'PROGRAM');
      // Name-only match: re-imports and AI name variants merge; deliberately
      // distinct program names stay separate (combine later via Merge if wanted).
      const best = findBestNameMatch(node.name, (progs ?? []).map((p) => ({ id: p.id, name: p.name })));
      if (best && best.score >= PROGRAM_MERGE_THRESHOLD) {
        counts.reused.PROGRAM++;
        return best.id;
      }
    } else if (level === 'CLASS_TYPE' && parentId) {
      const { data: kids } = await supabaseAdmin
        .from('activities')
        .select('id, name')
        .eq('parent_activity_id', parentId)
        .eq('activity_hierarchy_type', 'CLASS_TYPE');
      const best = findBestNameMatch(node.name, (kids ?? []).map((k) => ({ id: k.id, name: k.name })));
      if (best && best.score >= CHILD_MERGE_THRESHOLD) {
        counts.reused.CLASS_TYPE++;
        return best.id;
      }
    } else if ((level === 'CLASS_INSTANCE' || level === 'SESSION') && parentId) {
      // Leaf dedup: same parent + same start date + similar name → already imported.
      const { data: kids } = await supabaseAdmin
        .from('activities')
        .select('id, name, start_datetime')
        .eq('parent_activity_id', parentId);
      const nodeStart = node.start_date;
      const dup = (kids ?? []).find(
        (e) => datePortion(e.start_datetime) === nodeStart && nameMatchScore(node.name, e.name ?? '') >= CHILD_MERGE_THRESHOLD
      );
      if (dup) {
        counts.reused[level]++;
        return dup.id;
      }
    }

    // ── Insert ─────────────────────────────────────────────────────────────
    const notes: string[] = [`Imported via admin paste on ${today}`];
    if (node.location_name && !locationId) notes.push(`Location not matched: "${node.location_name}" — add it manually`);
    if (node.organization_name && !orgId) notes.push(`Organization not matched: "${node.organization_name}" — add it manually`);

    const { data: row, error } = await supabaseAdmin
      .from('activities')
      .insert({
        name: node.name,
        description: node.description,
        activity_hierarchy_type: level,
        parent_activity_id: parentId,
        // Structural template lives on the top-level PROGRAM only.
        program_format: level === 'PROGRAM' ? node.program_format : null,
        activity_type: node.activity_type,
        min_grade: node.min_grade,
        max_grade: node.max_grade,
        min_age: node.min_age,
        max_age: node.max_age,
        cost: node.cost,
        start_datetime: startDatetimeOf(node),
        end_datetime: endDatetimeOf(node),
        is_summer: node.is_summer,
        is_fall: node.is_fall,
        is_winter: node.is_winter,
        is_spring: node.is_spring,
        location_id: locationId,
        location_details: !locationId && node.location_name ? node.location_name : null,
        sponsoring_organization_id: orgId,
        registration_link: node.registration_link,
        registration_opens: node.registration_opens,
        registration_closes: node.registration_closes,
        website: node.website,
        max_capacity: node.max_capacity,
        status: 'pending',
        notes: notes.join('\n'),
      })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[activity-import] Insert error:', error?.message);
      errors.push({ name: node.name, error: error?.message ?? 'insert failed' });
      return null;
    }

    counts.created[level]++;
    return row.id;
  }

  /** Walk the tree depth-first, inserting each node under its parent. */
  async function insertSubtree(node: ExtractedNode, parentId: string | null): Promise<void> {
    const id = await insertNode(node, parentId);
    if (!id) return; // parent failed → skip its children (they'd be orphaned)
    for (const child of node.children) {
      await insertSubtree(child, id);
    }
  }

  const created: Array<{ name: string }> = [];
  for (const root of roots) {
    await insertSubtree(root, null);
    created.push({ name: root.name });
  }

  const totalCreated = Object.values(counts.created).reduce((a, b) => a + b, 0);
  if (totalCreated === 0 && errors.length) {
    return jsonResponse({ ok: false, error: 'All extractions failed to save', errors }, 500);
  }

  return jsonResponse({
    ok: true,
    created,
    summary: counts,
    errors: errors.length ? errors : undefined,
  });
});
