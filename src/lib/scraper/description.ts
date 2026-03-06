/** Clamp description text to a global max length while preserving word boundaries. */
export function clampDescription(text: string | null | undefined, maxChars: number): string | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return null;
  if (cleaned.length <= maxChars) return cleaned;

  const limit = Math.max(32, maxChars - 1);
  const slice = cleaned.slice(0, limit);
  const cutAt = slice.lastIndexOf(' ');
  const head = cutAt >= Math.floor(limit * 0.75) ? slice.slice(0, cutAt) : slice;
  return `${head.trim()}…`;
}
