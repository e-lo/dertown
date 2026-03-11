/**
 * Build a Netlify Image CDN URL for on-the-fly resizing and format negotiation.
 * In dev mode the raw URL is returned unchanged (Netlify CDN only works in production).
 */
export function optimizedImageUrl(
  src: string,
  opts: { width: number; height?: number; fit?: 'cover' | 'contain'; quality?: number } = { width: 800 }
): string {
  if (import.meta.env.DEV) return src;

  const params = new URLSearchParams();
  params.set('url', src);
  params.set('w', String(opts.width));
  if (opts.height) params.set('h', String(opts.height));
  params.set('fit', opts.fit ?? 'cover');
  params.set('q', String(opts.quality ?? 75));

  return `/.netlify/images?${params.toString()}`;
}
