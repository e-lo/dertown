/**
 * Event image framing: how an event's image is shown in the carousel card and
 * on the detail page. Stored as events.image_display (JSONB). Everything that
 * reads or writes that column goes through this module.
 *
 * Framework-free so it can run on the server, in the admin editor bundle, and
 * in tsx tests.
 */

export type FramingMode = 'auto' | 'crop' | 'full';
export type DetailLayout = 'auto' | 'banner' | 'side';
export type ImageView = 'card' | 'detail';

/** Percentages, 0–100, from the image's top-left. */
export interface FocusPoint {
  x: number;
  y: number;
}

export interface ViewFraming {
  mode: FramingMode;
  focus?: FocusPoint;
}

export interface DetailFraming extends ViewFraming {
  layout: DetailLayout;
}

export interface ImageDisplay {
  /** The image URL these settings were made for; a mismatch means stale. */
  src: string;
  width?: number;
  height?: number;
  card?: ViewFraming;
  detail?: DetailFraming;
}

export interface ResolvedFraming {
  /** `measure`: Auto with unknown size — the browser decides crop vs full. */
  mode: 'crop' | 'full' | 'measure';
  focus: FocusPoint;
  layout: 'banner' | 'side';
}

export const CARD_ASPECT = 3 / 2;
export const DETAIL_BANNER_ASPECT = 16 / 9;
/** imageAspect / windowAspect within this range → crop is acceptable. */
export const CROP_TOLERANCE = { min: 0.8, max: 1.25 } as const;
/** Auto detail layout goes side-by-side for images narrower than this (w/h). */
export const SIDE_LAYOUT_MAX_ASPECT = 0.9;
export const CENTER_FOCUS: FocusPoint = { x: 50, y: 50 };

const FRAMING_MODES: readonly FramingMode[] = ['auto', 'crop', 'full'];
const DETAIL_LAYOUTS: readonly DetailLayout[] = ['auto', 'banner', 'side'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function isPercent(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
}

/** `undefined` = absent (fine), `null` = present but invalid. */
function parseFocus(raw: unknown): FocusPoint | null | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw) || !isPercent(raw.x) || !isPercent(raw.y)) return null;
  return { x: raw.x, y: raw.y };
}

function parseViewFraming(raw: unknown): ViewFraming | null {
  if (!isRecord(raw) || !FRAMING_MODES.includes(raw.mode as FramingMode)) return null;
  const mode = raw.mode as FramingMode;
  const focus = parseFocus(raw.focus);
  if (focus === null) return null;
  return focus ? { mode, focus } : { mode };
}

function parseDetailFraming(raw: unknown): DetailFraming | null {
  if (!isRecord(raw) || !DETAIL_LAYOUTS.includes(raw.layout as DetailLayout)) return null;
  const view = parseViewFraming(raw);
  if (!view) return null;
  return { layout: raw.layout as DetailLayout, ...view };
}

/** Strictly validate stored/submitted settings. Unknown keys are dropped. */
export function parseImageDisplay(raw: unknown): ImageDisplay | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.src !== 'string' || raw.src.trim() === '') return null;
  const result: ImageDisplay = { src: raw.src };

  if (raw.width !== undefined || raw.height !== undefined) {
    if (!isPositiveNumber(raw.width) || !isPositiveNumber(raw.height)) return null;
    result.width = raw.width;
    result.height = raw.height;
  }
  if (raw.card !== undefined) {
    const card = parseViewFraming(raw.card);
    if (!card) return null;
    result.card = card;
  }
  if (raw.detail !== undefined) {
    const detail = parseDetailFraming(raw.detail);
    if (!detail) return null;
    result.detail = detail;
  }
  return result;
}

export function fitsWindow(imageAspect: number, windowAspect: number): boolean {
  const ratio = imageAspect / windowAspect;
  return ratio >= CROP_TOLERANCE.min && ratio <= CROP_TOLERANCE.max;
}

function knownAspect(display: ImageDisplay | null): number | null {
  return display?.width && display.height ? display.width / display.height : null;
}

function resolveLayout(display: ImageDisplay | null, aspect: number | null): 'banner' | 'side' {
  const chosen = display?.detail?.layout ?? 'auto';
  if (chosen !== 'auto') return chosen;
  return aspect !== null && aspect < SIDE_LAYOUT_MAX_ASPECT ? 'side' : 'banner';
}

/** Decide how `view` renders the event's image. Never throws. */
export function resolveFraming(
  imageUrl: string | null | undefined,
  raw: unknown,
  view: ImageView
): ResolvedFraming {
  const parsed = parseImageDisplay(raw);
  const display = parsed && parsed.src === imageUrl ? parsed : null;
  const aspect = knownAspect(display);
  const layout = view === 'detail' ? resolveLayout(display, aspect) : 'banner';

  // Side-by-side has no fixed window: the whole image always shows.
  if (layout === 'side') return { mode: 'full', focus: CENTER_FOCUS, layout };

  const settings = view === 'card' ? display?.card : display?.detail;
  const mode = settings?.mode ?? 'auto';
  const focus = settings?.focus ?? CENTER_FOCUS;
  if (mode !== 'auto') return { mode, focus, layout };
  if (aspect === null) return { mode: 'measure', focus, layout };

  const windowAspect = view === 'card' ? CARD_ASPECT : DETAIL_BANNER_ASPECT;
  return { mode: fitsWindow(aspect, windowAspect) ? 'crop' : 'full', focus, layout };
}

export type ImageDisplayInput =
  | { ok: true; value: ImageDisplay | null | undefined }
  | { ok: false };

/**
 * Validate `image_display` from an admin save request.
 * - `undefined` (key absent) → leave the column alone.
 * - `null`, or no image → clear it.
 * - Otherwise it must parse; `src` is pinned to the image URL being saved so
 *   the staleness check can't be defeated by client-side URL normalisation.
 *   `imageUrl` undefined means the request isn't changing the image.
 */
export function normalizeImageDisplayInput(
  value: unknown,
  imageUrl: string | null | undefined
): ImageDisplayInput {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null || imageUrl === null) return { ok: true, value: null };
  const parsed = parseImageDisplay(value);
  if (!parsed) return { ok: false };
  return { ok: true, value: imageUrl === undefined ? parsed : { ...parsed, src: imageUrl } };
}
