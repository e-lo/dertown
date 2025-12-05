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
  gfm: true,    // GitHub Flavored Markdown
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

/**
 * Renders markdown for truncated/preview contexts
 * Strips HTML tags and returns plain text with preserved line breaks
 * @param markdown - Markdown text to render
 * @param maxLength - Maximum length of the preview
 * @returns Plain text preview
 */
export function renderMarkdownPreview(markdown: string | null | undefined, maxLength: number = 150): string {
  if (!markdown) {
    return '';
  }
  
  // Remove markdown syntax for preview
  let plain = markdown
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links, keep text
    .replace(/`([^`]+)`/g, '$1') // Remove inline code
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered list markers
    .trim();
  
  // Truncate if needed
  if (plain.length > maxLength) {
    plain = plain.substring(0, maxLength).trim() + '...';
  }
  
  return plain;
}


