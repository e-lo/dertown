/**
 * Admin editor panel for event image framing (see src/lib/image-display.ts).
 *
 * Pages populate and save the modal with their own inline scripts, so this
 * exposes a small global, `window.eventImageFraming`:
 *   - setValue(raw)  after the page sets the image URL input when opening the
 *                    modal for an event (raw = event.image_display, or null).
 *   - getValue()     when building the save payload. `undefined` means "don't
 *                    send the field" (panel disabled, e.g. staged events).
 *   - disable()      for edits that can't store framing (staged events).
 */
import {
  CENTER_FOCUS,
  parseImageDisplay,
  resolveFraming,
  type DetailLayout,
  type FocusPoint,
  type FramingMode,
  type ImageDisplay,
  type ImageView,
} from '@/lib/image-display';

export interface ImageFramingApi {
  setValue(raw: unknown): void;
  getValue(): ImageDisplay | null | undefined;
  disable(): void;
}

declare global {
  interface Window {
    eventImageFraming?: ImageFramingApi;
  }
}

interface FramingState {
  width?: number;
  height?: number;
  card: { mode: FramingMode; focus: FocusPoint };
  detail: { layout: DetailLayout; mode: FramingMode; focus: FocusPoint };
}

function defaultState(): FramingState {
  return {
    card: { mode: 'auto', focus: { ...CENTER_FOCUS } },
    detail: { layout: 'auto', mode: 'auto', focus: { ...CENTER_FOCUS } },
  };
}

function stateFrom(display: ImageDisplay): FramingState {
  const base = defaultState();
  return {
    width: display.width,
    height: display.height,
    card: { mode: display.card?.mode ?? 'auto', focus: display.card?.focus ?? base.card.focus },
    detail: {
      layout: display.detail?.layout ?? 'auto',
      mode: display.detail?.mode ?? 'auto',
      focus: display.detail?.focus ?? base.detail.focus,
    },
  };
}

/** Saved src is the normalised URL; a bare "example.com/x.jpg" in the input still matches. */
function sameImage(savedSrc: string, inputUrl: string): boolean {
  return savedSrc === inputUrl || savedSrc.endsWith(`//${inputUrl}`);
}

export function initImageFraming(opts: { urlInputId: string; rootId: string }): void {
  const urlInput = document.getElementById(opts.urlInputId) as HTMLInputElement | null;
  const root = document.getElementById(opts.rootId);
  if (!urlInput || !root) return;

  let enabled = true;
  let currentUrl = '';
  let state = defaultState();

  const rows = Array.from(root.querySelectorAll<HTMLElement>('.framing-row'));

  function toDisplay(): ImageDisplay | null {
    if (!currentUrl) return null;
    const display: ImageDisplay = { src: currentUrl, card: state.card, detail: state.detail };
    if (state.width && state.height) {
      display.width = state.width;
      display.height = state.height;
    }
    return display;
  }

  function renderRow(row: HTMLElement, display: ImageDisplay | null): void {
    const view = row.dataset.view as ImageView;
    const framing = resolveFraming(currentUrl, display, view);
    const settings = state[view];
    const isSide = framing.layout === 'side';

    const preview = row.querySelector<HTMLElement>('[data-preview]')!;
    // The size is known once loaded; until then show Auto as crop.
    preview.dataset.frame = framing.mode === 'full' ? 'full' : 'crop';
    preview.classList.toggle('event-image--side', isSide);
    if (view === 'detail') preview.classList.toggle('framing-preview--banner', !isSide);
    const main = preview.querySelector<HTMLImageElement>('.event-image__main')!;
    main.style.objectPosition = `${framing.focus.x}% ${framing.focus.y}%`;

    const crosshair = row.querySelector<HTMLElement>('[data-crosshair]')!;
    crosshair.style.left = `${settings.focus.x}%`;
    crosshair.style.top = `${settings.focus.y}%`;

    row.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.mode === settings.mode));
    });
    row.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.layout === state.detail.layout));
    });
  }

  function render(): void {
    const visible = enabled && Boolean(currentUrl);
    root!.classList.toggle('hidden', !visible);
    if (!visible) return;
    const display = toDisplay();
    for (const row of rows) renderRow(row, display);
  }

  function loadImage(url: string): void {
    root!
      .querySelectorAll<HTMLImageElement>(
        '[data-picker-img], .event-image__main, .event-image__backdrop'
      )
      .forEach((img) => {
        img.src = url;
      });
    const probe = new Image();
    probe.onload = () => {
      if (url !== currentUrl) return; // URL changed while loading
      state.width = probe.naturalWidth;
      state.height = probe.naturalHeight;
      render();
    };
    probe.src = url;
  }

  function showUrl(url: string, nextState: FramingState): void {
    currentUrl = url;
    state = nextState;
    if (url) loadImage(url);
    render();
  }

  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    if (url === currentUrl) return;
    showUrl(url, defaultState()); // new image → old framing no longer applies
  });

  for (const row of rows) {
    const view = row.dataset.view as ImageView;
    row.querySelector<HTMLElement>('[data-picker]')!.addEventListener('click', (e) => {
      const img = row.querySelector<HTMLImageElement>('[data-picker-img]')!;
      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
      state[view].focus = {
        x: clamp(((e.clientX - rect.left) / rect.width) * 100),
        y: clamp(((e.clientY - rect.top) / rect.height) * 100),
      };
      if (state[view].mode === 'auto') state[view].mode = 'crop';
      render();
    });
    row.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        state[view].mode = b.dataset.mode as FramingMode;
        render();
      })
    );
    row.querySelectorAll<HTMLButtonElement>('[data-layout]').forEach((b) =>
      b.addEventListener('click', () => {
        state.detail.layout = b.dataset.layout as DetailLayout;
        render();
      })
    );
  }

  root.querySelector('[data-framing-reset]')?.addEventListener('click', () => {
    state = { ...defaultState(), width: state.width, height: state.height };
    render();
  });

  window.eventImageFraming = {
    setValue(raw: unknown) {
      enabled = true;
      const url = urlInput.value.trim();
      const parsed = parseImageDisplay(raw);
      const matches = parsed !== null && url !== '' && sameImage(parsed.src, url);
      showUrl(url, matches ? stateFrom(parsed) : defaultState());
    },
    getValue() {
      return enabled ? toDisplay() : undefined;
    },
    disable() {
      enabled = false;
      render();
    },
  };
}
