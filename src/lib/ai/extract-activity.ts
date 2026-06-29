import Anthropic from '@anthropic-ai/sdk';

/** Where a node sits in the activity tree. Top-level is always PROGRAM. */
export type ActivityLevel = 'PROGRAM' | 'SESSION' | 'CLASS_TYPE' | 'CLASS_INSTANCE';

/**
 * A node in an extracted activity tree.
 *
 * The importer maps an org/portfolio → PROGRAM, each distinct camp/class
 * offering → CLASS_TYPE child, and each dated week/instance → CLASS_INSTANCE
 * grandchild. `program_format` is only meaningful on the top-level PROGRAM.
 */
export interface ExtractedNode {
  name: string;
  /** Suggested tree level; the importer falls back to depth if missing/invalid. */
  suggested_level: ActivityLevel;
  /** 'camp' (weekly sessions); 'class' (recurring); 'league'; 'workshop' (one-off). PROGRAM only. */
  program_format: 'camp' | 'class' | 'league' | 'workshop' | null;
  description: string | null;
  activity_type: 'sports' | 'arts' | 'music' | 'dance' | 'academic' | 'recreation' | 'other';
  /** Grade as ordinal string: "K", "1st", "2nd" … "12th" */
  min_grade: string | null;
  max_grade: string | null;
  min_age: number | null;
  max_age: number | null;
  cost: string | null;
  /** YYYY-MM-DD */
  start_date: string | null;
  /** YYYY-MM-DD */
  end_date: string | null;
  /** HH:MM in 24-hour format */
  start_time: string | null;
  end_time: string | null;
  is_summer: boolean;
  is_fall: boolean;
  is_winter: boolean;
  is_spring: boolean;
  location_name: string | null;
  registration_link: string | null;
  website: string | null;
  organization_name: string | null;
  max_capacity: number | null;
  /** YYYY-MM-DD or null — registration window (usually on a CLASS_INSTANCE/SESSION leaf) */
  registration_opens: string | null;
  registration_closes: string | null;
  children: ExtractedNode[];
}

/** Hard cap on tree depth so a runaway response can't insert thousands of rows. */
const MAX_DEPTH = 4;

const SYSTEM_PROMPT = `You extract structured activity/program data from web pages or text for a community kids' activities directory, and organize it into a HIERARCHY.
Return ONLY valid JSON — no markdown fences, no explanation, no extra text.
Return a single JSON object (the root program) OR a JSON array of root objects.
If no valid activity can be extracted, return [].`;

function buildUserPrompt(text: string, today: string): string {
  return `Today is ${today}. Extract the activities/camps/classes/programs from the text below and organize them into a TREE.

The tree has up to three useful levels:
- PROGRAM  = the organization, club, or portfolio that runs the offerings (e.g. "Mountaineers", "Apple Gymnastics").
- CLASS_TYPE = a specific named offering within that organization (e.g. "Stevens Lodge Overnight Rocks Camp", "Apple Buds (ages 3-5)").
- CLASS_INSTANCE = a specific dated occurrence of an offering (e.g. "Week 1 (Jul 14-18)", "Mondays 3-4pm"). Put the concrete dates/cost/registration here.

Each node is a JSON object with these exact fields:
{
  "name": "...",
  "suggested_level": "PROGRAM" | "CLASS_TYPE" | "CLASS_INSTANCE" | "SESSION",
  "program_format": "camp" | "class" | "league" | "workshop" | null,
  "description": "what participants do / learn, or null",
  "activity_type": "sports" | "arts" | "music" | "dance" | "academic" | "recreation" | "other",
  "min_grade": "K" | "1st" | ... | "12th" | null,
  "max_grade": "K" | "1st" | ... | "12th" | null,
  "min_age": integer | null,
  "max_age": integer | null,
  "cost": "$75" or "Free" or "$50-$100" or null,
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "start_time": "HH:MM" 24h or null,
  "end_time": "HH:MM" 24h or null,
  "is_summer": true/false, "is_fall": true/false, "is_winter": true/false, "is_spring": true/false,
  "location_name": "venue or building name" or null,
  "registration_link": "https://..." or null,
  "website": "https://..." or null,
  "organization_name": "org or club name" or null,
  "max_capacity": integer or null,
  "registration_opens": "YYYY-MM-DD" or null,
  "registration_closes": "YYYY-MM-DD" or null,
  "children": [ ...nested nodes... ]
}

Rules:
- Build the tree to match what the page describes. A page for one camp week → PROGRAM (the org) → CLASS_TYPE (the camp) → CLASS_INSTANCE (that week). A page listing many camps → one PROGRAM with several CLASS_TYPE children, each with CLASS_INSTANCE children for its weeks.
- The top (root) node is ALWAYS the organization/portfolio, with suggested_level "PROGRAM". Set its program_format ("camp" for summer/break camps, "class" for recurring lessons, "league" for sports leagues, "workshop" for one-offs).
- Return EXACTLY ONE root PROGRAM per organization. Use the organization's canonical/common name and do NOT emit separate roots for name variants (e.g. never both "Icicle Creek" and "Icicle Creek Center for the Arts" — pick one and put everything under it). Set the PROGRAM's "website" to the organization's main site so re-imports can be matched to it.
- A multi-week CAMP's weeks are CLASS_INSTANCE leaves — NOT "SESSION". Only use "SESSION" for a league season or a school-year term.
- Put concrete dates (start_date/end_date, start_time/end_time), per-instance cost, and registration_opens/closes on the CLASS_INSTANCE leaves. PROGRAM/CLASS_TYPE carry name, description, ages/grades, format, season flags.
- program_format is meaningful only on the PROGRAM (root). Leave it null on children.
- is_summer = July/Aug; is_fall = Sept-Nov; is_winter = Dec-Feb; is_spring = Mar-May. Set season flags on the PROGRAM based on its instances.
- If you cannot identify a distinct organization, make the single offering the PROGRAM root and put its dated occurrences as CLASS_INSTANCE children.
- Do not invent weeks/instances that the text does not mention.

TEXT:
${text}`;
}

const VALID_LEVELS: ActivityLevel[] = ['PROGRAM', 'SESSION', 'CLASS_TYPE', 'CLASS_INSTANCE'];
const VALID_FORMATS = ['camp', 'class', 'league', 'workshop'];
const VALID_TYPES = ['sports', 'arts', 'music', 'dance', 'academic', 'recreation', 'other'];

/** Default level by depth when the model omits/garbles suggested_level. */
function defaultLevel(depth: number): ActivityLevel {
  if (depth <= 0) return 'PROGRAM';
  if (depth === 1) return 'CLASS_TYPE';
  return 'CLASS_INSTANCE';
}

function coerceNode(item: Record<string, unknown>, depth: number): ExtractedNode {
  const suggested = String(item.suggested_level);
  const level: ActivityLevel = VALID_LEVELS.includes(suggested as ActivityLevel)
    ? (suggested as ActivityLevel)
    : defaultLevel(depth);

  const rawChildren = Array.isArray(item.children) && depth + 1 < MAX_DEPTH ? item.children : [];

  return {
    name: String(item.name).trim(),
    suggested_level: level,
    program_format: (VALID_FORMATS.includes(String(item.program_format))
      ? item.program_format
      : null) as ExtractedNode['program_format'],
    description: typeof item.description === 'string' ? item.description : null,
    activity_type: (VALID_TYPES.includes(String(item.activity_type))
      ? item.activity_type
      : 'other') as ExtractedNode['activity_type'],
    min_grade: typeof item.min_grade === 'string' ? item.min_grade : null,
    max_grade: typeof item.max_grade === 'string' ? item.max_grade : null,
    min_age: typeof item.min_age === 'number' ? item.min_age : null,
    max_age: typeof item.max_age === 'number' ? item.max_age : null,
    cost: typeof item.cost === 'string' ? item.cost : null,
    start_date: typeof item.start_date === 'string' ? item.start_date : null,
    end_date: typeof item.end_date === 'string' ? item.end_date : null,
    start_time: typeof item.start_time === 'string' ? item.start_time : null,
    end_time: typeof item.end_time === 'string' ? item.end_time : null,
    is_summer: Boolean(item.is_summer),
    is_fall: Boolean(item.is_fall),
    is_winter: Boolean(item.is_winter),
    is_spring: Boolean(item.is_spring),
    location_name: typeof item.location_name === 'string' ? item.location_name : null,
    registration_link: typeof item.registration_link === 'string' ? item.registration_link : null,
    website: typeof item.website === 'string' ? item.website : null,
    organization_name: typeof item.organization_name === 'string' ? item.organization_name : null,
    max_capacity: typeof item.max_capacity === 'number' ? item.max_capacity : null,
    registration_opens: typeof item.registration_opens === 'string' ? item.registration_opens : null,
    registration_closes: typeof item.registration_closes === 'string' ? item.registration_closes : null,
    children: (rawChildren as Record<string, unknown>[])
      .filter((c) => c && typeof c.name === 'string' && c.name.trim())
      .map((c) => coerceNode(c, depth + 1)),
  };
}

/** Extract an activity tree (one or more PROGRAM roots) from pasted text/URL content using Claude. */
export async function extractActivitiesWithAI(text: string): Promise<ExtractedNode[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — add it to .env.local');
  }

  const today = new Date().toISOString().split('T')[0];
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(text, today) }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Strip markdown fences if the model added them anyway
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  // Accept either a JSON array of roots or a single root object.
  const match = jsonStr.match(/[[{][\s\S]*[\]}]/);
  if (!match) {
    throw new Error(`AI did not return JSON. Response: ${raw.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${match[0].slice(0, 300)}`);
  }

  const roots = Array.isArray(parsed) ? parsed : [parsed];

  return (roots as Record<string, unknown>[])
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item) => coerceNode(item, 0));
}
