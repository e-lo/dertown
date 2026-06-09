import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedActivity {
  name: string;
  description: string | null;
  /** 'camp' (time-limited, weekly sessions); 'class' (recurring); 'league'; 'workshop' (one-off) */
  program_format: 'camp' | 'class' | 'league' | 'workshop' | null;
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
}

const SYSTEM_PROMPT = `You extract structured activity/program data from text for a community activities directory.
Return ONLY a valid JSON array — no markdown fences, no explanation, no extra text.
If the text describes multiple age groups or time slots, return one array item per group/slot.
If no valid activity can be extracted, return an empty array [].`;

function buildUserPrompt(text: string, today: string): string {
  return `Today is ${today}. Extract all activities, camps, classes, or programs from the text below.

Return a JSON array where each object has these exact fields:
{
  "name": "descriptive name — include age/grade group in name when multiple groups exist",
  "description": "what participants do / learn, or null",
  "program_format": "camp" | "class" | "league" | "workshop" | null,
  "activity_type": "sports" | "arts" | "music" | "dance" | "academic" | "recreation" | "other",
  "min_grade": "K" | "1st" | "2nd" | ... | "12th" | null,
  "max_grade": "K" | "1st" | ... | "12th" | null,
  "min_age": integer | null,
  "max_age": integer | null,
  "cost": "$75" or "Free" or "$50-$100" or null,
  "start_date": "YYYY-MM-DD" or null,
  "end_date": "YYYY-MM-DD" or null,
  "start_time": "HH:MM" 24h or null,
  "end_time": "HH:MM" 24h or null,
  "is_summer": true/false,
  "is_fall": true/false,
  "is_winter": true/false,
  "is_spring": true/false,
  "location_name": "venue or building name" or null,
  "registration_link": "https://..." or null,
  "website": "https://..." or null,
  "organization_name": "org or club name" or null,
  "max_capacity": integer or null
}

Rules:
- program_format: "camp" = time-limited (often per-week) break program; "class" = recurring/multi-instance offering (gymnastics, dance, lessons); "league" = sports league/club with seasons & teams; "workshop" = one-off or very short standalone event. Use null if unclear.
- For a multi-week camp, return ONE item for the camp with its overall start_date + end_date — do NOT emit a separate top-level item per week.
- For multi-week camps/sessions use start_date + end_date (not start_time/end_time for the range)
- is_summer = true for July/August programs; is_fall for Sept-Nov; is_winter for Dec-Feb; is_spring for Mar-May
- If a single text mentions two grade bands with different times/costs, emit TWO items

TEXT:
${text}`;
}

/** Extract one or more activities from pasted text using Claude. */
export async function extractActivitiesWithAI(text: string): Promise<ExtractedActivity[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set — add it to .env.local');
  }

  const today = new Date().toISOString().split('T')[0];
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserPrompt(text, today) }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Strip markdown fences if the model added them anyway
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const match = jsonStr.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`AI did not return a JSON array. Response: ${raw.slice(0, 300)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    throw new Error(`Failed to parse AI response as JSON: ${match[0].slice(0, 300)}`);
  }

  if (!Array.isArray(parsed)) throw new Error('AI response is not a JSON array');

  // Coerce / validate each item minimally — name is the only hard requirement
  return (parsed as Record<string, unknown>[])
    .filter((item) => typeof item.name === 'string' && item.name.trim())
    .map((item) => ({
      name: String(item.name).trim(),
      description: typeof item.description === 'string' ? item.description : null,
      program_format: (['camp', 'class', 'league', 'workshop'].includes(String(item.program_format))
        ? item.program_format
        : null) as ExtractedActivity['program_format'],
      activity_type: (['sports', 'arts', 'music', 'dance', 'academic', 'recreation', 'other'].includes(
        String(item.activity_type)
      )
        ? item.activity_type
        : 'other') as ExtractedActivity['activity_type'],
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
    }));
}
