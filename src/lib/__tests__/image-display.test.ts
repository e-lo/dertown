/**
 * Event image framing: parsing stored settings and resolving what each view
 * renders. See docs/superpowers/specs/2026-10-02-event-image-framing-design.md.
 */
import {
  CARD_ASPECT,
  DETAIL_BANNER_ASPECT,
  fitsWindow,
  normalizeImageDisplayInput,
  parseImageDisplay,
  resolveFraming,
} from '../image-display';

const URL_A = 'https://example.com/a.jpg';
const URL_B = 'https://example.com/b.jpg';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(
    pass
      ? `✅ PASS: ${name}`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}`
  );
}

console.log('🧪 image-display\n');

// --- parseImageDisplay ---------------------------------------------------
check('parse: minimal valid', parseImageDisplay({ src: URL_A }), { src: URL_A });
check(
  'parse: full valid shape round-trips',
  parseImageDisplay({
    src: URL_A,
    width: 680,
    height: 1026,
    card: { mode: 'crop', focus: { x: 25, y: 10 } },
    detail: { layout: 'side', mode: 'full' },
  }),
  {
    src: URL_A,
    width: 680,
    height: 1026,
    card: { mode: 'crop', focus: { x: 25, y: 10 } },
    detail: { layout: 'side', mode: 'full' },
  }
);
check('parse: strips unknown keys', parseImageDisplay({ src: URL_A, junk: 1 }), { src: URL_A });
check('parse: null → null', parseImageDisplay(null), null);
check('parse: string → null', parseImageDisplay('{"src":"x"}'), null);
check('parse: missing src → null', parseImageDisplay({ width: 1, height: 1 }), null);
check('parse: empty src → null', parseImageDisplay({ src: '  ' }), null);
check('parse: width without height → null', parseImageDisplay({ src: URL_A, width: 10 }), null);
check('parse: zero width → null', parseImageDisplay({ src: URL_A, width: 0, height: 10 }), null);
check('parse: NaN height → null', parseImageDisplay({ src: URL_A, width: 10, height: NaN }), null);
check(
  'parse: bad card mode → null',
  parseImageDisplay({ src: URL_A, card: { mode: 'zoom' } }),
  null
);
check(
  'parse: bad detail layout → null',
  parseImageDisplay({ src: URL_A, detail: { layout: 'grid', mode: 'auto' } }),
  null
);
check(
  'parse: focus out of range → null',
  parseImageDisplay({ src: URL_A, card: { mode: 'crop', focus: { x: 101, y: 0 } } }),
  null
);
check(
  'parse: focus non-number → null',
  parseImageDisplay({ src: URL_A, card: { mode: 'crop', focus: { x: '5', y: 0 } } }),
  null
);

// --- fitsWindow -----------------------------------------------------------
check('fits: same aspect', fitsWindow(1.5, CARD_ASPECT), true);
check('fits: just inside lower bound (0.807)', fitsWindow(1.21, CARD_ASPECT), true);
check('fits: just under lower boundary', fitsWindow(1.19, CARD_ASPECT), false);
check('fits: just inside upper bound (1.247)', fitsWindow(1.87, CARD_ASPECT), true);
check('fits: just over upper boundary', fitsWindow(1.88, CARD_ASPECT), false);

// --- resolveFraming -------------------------------------------------------
const CENTER = { x: 50, y: 50 };
check('resolve: no settings, card → measure', resolveFraming(URL_A, null, 'card'), {
  mode: 'measure',
  focus: CENTER,
  layout: 'banner',
});
check('resolve: no settings, detail → measure + banner', resolveFraming(URL_A, null, 'detail'), {
  mode: 'measure',
  focus: CENTER,
  layout: 'banner',
});
check(
  'resolve: malformed settings treated as none',
  resolveFraming(URL_A, { src: URL_A, card: { mode: 'nope' } }, 'card'),
  { mode: 'measure', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: stale src ignored (crop setting not applied to new image)',
  resolveFraming(URL_B, { src: URL_A, card: { mode: 'crop', focus: { x: 0, y: 0 } } }, 'card'),
  { mode: 'measure', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: explicit crop keeps focus',
  resolveFraming(URL_A, { src: URL_A, card: { mode: 'crop', focus: { x: 20, y: 80 } } }, 'card'),
  { mode: 'crop', focus: { x: 20, y: 80 }, layout: 'banner' }
);
check(
  'resolve: explicit full',
  resolveFraming(URL_A, { src: URL_A, card: { mode: 'full' } }, 'card'),
  {
    mode: 'full',
    focus: CENTER,
    layout: 'banner',
  }
);
check(
  'resolve: auto + landscape 3:2 dims on card → crop',
  resolveFraming(URL_A, { src: URL_A, width: 1200, height: 800 }, 'card'),
  { mode: 'crop', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: auto + portrait dims on card → full',
  resolveFraming(URL_A, { src: URL_A, width: 680, height: 1026 }, 'card'),
  { mode: 'full', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: auto + 16:9 dims on detail → crop banner',
  resolveFraming(URL_A, { src: URL_A, width: 1600, height: 900 }, 'detail'),
  { mode: 'crop', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: auto layout + tall dims on detail → side (full image)',
  resolveFraming(URL_A, { src: URL_A, width: 680, height: 1026 }, 'detail'),
  { mode: 'full', focus: CENTER, layout: 'side' }
);
check(
  'resolve: square-ish (w/h 0.95) on detail → banner + full',
  resolveFraming(URL_A, { src: URL_A, width: 950, height: 1000 }, 'detail'),
  { mode: 'full', focus: CENTER, layout: 'banner' }
);
check(
  'resolve: explicit banner overrides tall dims',
  resolveFraming(
    URL_A,
    {
      src: URL_A,
      width: 680,
      height: 1026,
      detail: { layout: 'banner', mode: 'crop', focus: { x: 50, y: 20 } },
    },
    'detail'
  ),
  { mode: 'crop', focus: { x: 50, y: 20 }, layout: 'banner' }
);
check(
  'resolve: explicit side without dims → side',
  resolveFraming(URL_A, { src: URL_A, detail: { layout: 'side', mode: 'auto' } }, 'detail'),
  { mode: 'full', focus: CENTER, layout: 'side' }
);
check(
  'resolve: card ignores detail layout',
  resolveFraming(
    URL_A,
    { src: URL_A, width: 680, height: 1026, detail: { layout: 'side', mode: 'auto' } },
    'card'
  ),
  { mode: 'full', focus: CENTER, layout: 'banner' }
);
check('resolve: detail banner aspect constant is 16:9', DETAIL_BANNER_ASPECT, 16 / 9);

// --- normalizeImageDisplayInput (API boundary) ----------------------------
check('input: undefined → absent', normalizeImageDisplayInput(undefined, URL_A), {
  ok: true,
  value: undefined,
});
check('input: null → clear', normalizeImageDisplayInput(null, URL_A), { ok: true, value: null });
check(
  'input: invalid → error',
  normalizeImageDisplayInput({ src: URL_A, card: { mode: 'x' } }, URL_A),
  {
    ok: false,
  }
);
check(
  'input: src forced to the saved image URL',
  normalizeImageDisplayInput({ src: 'example.com/a.jpg', card: { mode: 'full' } }, URL_A),
  { ok: true, value: { src: URL_A, card: { mode: 'full' } } }
);
check('input: no saved image URL → clear', normalizeImageDisplayInput({ src: URL_A }, null), {
  ok: true,
  value: null,
});
check(
  'input: image URL not in payload keeps parsed src',
  normalizeImageDisplayInput({ src: URL_A }, undefined),
  { ok: true, value: { src: URL_A } }
);

console.log(failures === 0 ? '\nAll image-display tests passed' : `\n${failures} failing`);
process.exit(failures === 0 ? 0 : 1);
