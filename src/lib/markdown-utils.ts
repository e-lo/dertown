/**
 * Markdown rendering utilities
 * Converts markdown text to HTML for display in event descriptions and other content
 */
import { marked } from 'marked';

/**
 * Configure marked options for safe rendering
 * - Breaks: Convert single line breaks to <br> tags (GitHub-flavored markdown)
 * - GFM: Enable GitHub Flavored Markdown features
 */
marked.setOptions({
  breaks: true, // Convert single line breaks to <br>
  gfm: true, // GitHub Flavored Markdown
});

/**
 * Renders markdown text to HTML
 * @param markdown - Markdown text to render
 * @returns HTML string (safe to use with set:html in Astro)
 */
export function renderMarkdown(markdown: string | null | undefined): string {
  if (!markdown) {
    return '';
  }

  try {
    return marked.parse(markdown) as string;
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // Fallback: escape HTML and preserve line breaks
    return markdown
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&#039;': "'",
};

/**
 * Renders markdown as a single line of plain text for card previews.
 * Link URLs, heading/list markers and raw HTML are dropped; block boundaries
 * become spaces. The result is unescaped text, so render it as text, not HTML.
 * @param markdown - Markdown text to render
 * @param maxLength - Maximum length of the preview
 * @returns Plain text preview
 */
export function renderMarkdownPreview(
  markdown: string | null | undefined,
  maxLength: number = 150
): string {
  if (!markdown) {
    return '';
  }

  const html = marked.parse(markdown, { async: false }) as string;
  const plain = html
    .replace(/<\/(p|h[1-6]|li|blockquote|pre|td|th)>|<br\s*\/?>|<hr\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#0?39);/g, (entity) => HTML_ENTITIES[entity])
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLength) {
    return plain;
  }
  const cut = plain.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}
