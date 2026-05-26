const QUOTE_LINE_RE = /^>+/;
const SIGNATURE_DELIMITER_RE = /^--\s*$/;
const FOOTER_PATTERNS = [
  /^sent from my/i,
  /^get outlook for/i,
  /^unsubscribe/i,
  /^to unsubscribe/i,
  /^you received this/i,
  /^this email was sent/i,
  /^view in browser/i,
];

export function extractBody(rawText: string): string {
  const lines = rawText.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at email signature delimiter ("-- " on its own line)
    if (SIGNATURE_DELIMITER_RE.test(trimmed)) break;

    // Skip quoted reply lines
    if (QUOTE_LINE_RE.test(trimmed)) continue;

    // Stop at common footer patterns
    if (FOOTER_PATTERNS.some((re) => re.test(trimmed))) break;

    result.push(line);
  }

  return result.join('\n').trim();
}
