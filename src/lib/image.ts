export interface ImageCdnOptions {
  width: number;
  height?: number;
  /** Only meaningful with a height; defaults to cover then. */
  fit?: 'cover' | 'contain';
  quality?: number;
}

/**
 * Build a Netlify Image CDN URL for on-the-fly resizing and format negotiation.
 *
 * `fit` is only sent with a height: with a width alone Netlify's `fit=cover`
 * crops to that width but keeps the source height, returning a tall sliver.
 */
export function imageCdnUrl(src: string, opts: ImageCdnOptions): string {
  const params = new URLSearchParams();
  params.set('url', src);
  params.set('w', String(opts.width));
  if (opts.height) {
    params.set('h', String(opts.height));
    params.set('fit', opts.fit ?? 'cover');
  }
  params.set('q', String(opts.quality ?? 75));

  return `/.netlify/images?${params.toString()}`;
}

/**
 * Netlify Image CDN URL in production; the raw URL in dev mode (the CDN only
 * works on Netlify).
 */
export function optimizedImageUrl(src: string, opts: ImageCdnOptions = { width: 800 }): string {
  if (import.meta.env.DEV) return src;
  return imageCdnUrl(src, opts);
}
