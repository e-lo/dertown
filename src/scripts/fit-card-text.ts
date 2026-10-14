export interface FitStep {
  fontSize: string;
  lines: string;
}

/**
 * Step each title down until it fits its line clamp; the longest titles also
 * get more lines. Re-fits whenever a title's width changes (resize, filter).
 */
export function fitTitles(selector: string, steps: FitStep[]): void {
  const fittedWidths = new WeakMap<HTMLElement, number>();

  function fitTitle(title: HTMLElement) {
    const width = title.clientWidth;
    if (width === 0 || fittedWidths.get(title) === width) return;
    fittedWidths.set(title, width);
    for (const step of steps) {
      title.style.fontSize = step.fontSize;
      title.style.webkitLineClamp = step.lines;
      if (title.scrollHeight <= title.clientHeight + 1) return;
    }
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) fitTitle(entry.target as HTMLElement);
  });
  document.querySelectorAll<HTMLElement>(selector).forEach((title) => observer.observe(title));
}

/**
 * Clamp each text element to as many whole lines as its parent slot can hold,
 * so descriptions fill whatever space the image and title leave on the card.
 */
export function fillSlots(selector: string): void {
  function fill(text: HTMLElement) {
    const slot = text.parentElement;
    if (!slot) return;
    const lineHeight = parseFloat(getComputedStyle(text).lineHeight);
    if (!lineHeight) return;
    const lines = Math.floor(slot.clientHeight / lineHeight);
    text.style.webkitLineClamp = String(Math.max(lines, 1));
    text.style.display = lines < 1 ? 'none' : '';
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const text = (entry.target as HTMLElement).querySelector<HTMLElement>(selector);
      if (text) fill(text);
    }
  });
  document.querySelectorAll<HTMLElement>(selector).forEach((text) => {
    if (text.parentElement) observer.observe(text.parentElement);
  });
}
