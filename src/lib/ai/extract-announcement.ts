import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedAnnouncement {
  title: string;
  message: string;
  link: string | null;
  organization_name: string | null;
  /** ISO datetime string e.g. "2026-07-01T00:00:00" — when to start showing */
  show_at: string | null;
  /** ISO datetime string — when to stop showing */
  expires_at: string | null;
}

const SYSTEM_PROMPT = `You extract structured announcement data from community email/text for a town website.
Return ONLY a valid JSON object — no markdown, no extra text.`;

function buildPrompt(text: string, today: string): string {
  return `Today is ${today}. Extract announcement information from this text.

Return a single JSON object with these fields:
{
  "title": "short headline (max 100 chars, plain text)",
  "message": "the announcement body — keep it concise, remove boilerplate like 'Hi everyone', preserve important details",
  "link": "https://... relevant URL, or null",
  "organization_name": "org or group name, or null",
  "show_at": "YYYY-MM-DDTHH:MM:SS when to start showing, or null if immediately",
  "expires_at": "YYYY-MM-DDTHH:MM:SS when to stop showing, or null"
}

TEXT:
${text}`;
}

export async function extractAnnouncementWithAI(text: string): Promise<ExtractedAnnouncement> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const today = new Date().toISOString().split('T')[0];
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(text, today) }],
  });

  const raw = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`AI did not return a JSON object. Response: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(match[0]) as Record<string, unknown>;

  if (!parsed.title || !parsed.message) {
    throw new Error('AI response missing required title or message fields');
  }

  return {
    title: String(parsed.title).slice(0, 100),
    message: String(parsed.message),
    link: typeof parsed.link === 'string' && parsed.link.startsWith('http') ? parsed.link : null,
    organization_name: typeof parsed.organization_name === 'string' ? parsed.organization_name : null,
    show_at: typeof parsed.show_at === 'string' ? parsed.show_at : null,
    expires_at: typeof parsed.expires_at === 'string' ? parsed.expires_at : null,
  };
}
