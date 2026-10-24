# Seasonal Palettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single indigo/neon-yellow theme with four date-switched seasonal palettes (seven colors each) and a simpler shared-color grouping of event categories, on web and mobile.

**Architecture:** `src/lib/config.ts` holds the four palettes, the category→slot grouping and a pure `getSeasonForMonth()`. The theme generator emits one `:root[data-season="…"]` block of CSS variables per season (plus per-category background/text rules), and the Tailwind `@theme` defaults. An inline `<head>` script sets `data-season` on `<html>` from the visitor's date before first paint, so CDN-cached pages switch seasons without a purge. Pages stop hardcoding `indigo-*` and the canary band and use the semantic tokens instead.

**Tech Stack:** Astro 5, Tailwind v4 (`@theme`), TypeScript run with `tsx`, React Native (mobile/).

**Spec:** The decisions in the preview artifact https://claude.ai/artifact/P7hDkYfTvVGgvpw7YS4tr9 and the memory note `project_seasonal_palettes.md`, reproduced as the tables below.

### Palettes (exact values)

Slots: `page` (page background), `ink` (text; Civic/School cards), `hero` (hero, buttons, links; Town/Arts cards), `highlight` (Featured), `sports` (Sports), `accent` (Family/Seniors/Give Back), `outdoors` (Nature/Recreation/Outdoors). `announcement` names which slot fills the announcement band.

| Season | Months | page | ink | hero | highlight | sports | accent | outdoors | announcement |
|---|---|---|---|---|---|---|---|---|---|
| `ski` | 1–3 | #f4f4f4 | #1f2a33 | #3e5f78 | #a8aacc | #9a5248 | #deb0aa | #909b99 | accent |
| `wildflower` | 4–8 | #f8f7f0 | #1e2421 | #3f3478 | #f0b62b | #c8402a | #b23c7a | #4f7a42 | highlight |
| `fall` | 9–10 | #f8f0e3 | #422625 | #2b4a33 | #d74100 | #6a010f | #ff9b0c | #334963 | accent |
| `holiday` | 11–12 | #f6f5f2 | #222a2e | #2f5d55 | #d8c3a5 | #9b1b24 | #c0ced7 | #6f8a6f | accent |

Labels: Ski "Sapphire ash", Wildflower "Wildflower", Fall "Mountain sunset", Holiday "Nordic".

### Category grouping (same in every season)

| Slot | Categories |
|---|---|
| hero | town, arts-culture |
| highlight | featured |
| sports | sports |
| accent | family, seniors, give-back |
| outdoors | nature, recreation, outdoors |
| ink | civic, school |

## Global Constraints

- `src/lib/config.ts` must not use `import.meta.env`; mobile type-checks it (memory: config shared with mobile).
- Event cards keep square corners and solid full-color backgrounds.
- Every category card color and both announcement colors must reach WCAG 4.5:1 against the text color chosen for them; that text color is whichever of `#ffffff` / `#111111` contrasts more.
- At most 7 distinct colors per season.
- Sports is always a red; Arts & Culture is never pink.
- Pushing to `main` deploys production (Netlify). Work on a branch and open a PR.
- The dev server does not run in this sandbox. Verify with `npm run lint`, `npm run check`, `npm run build` and the `test:*` scripts. `npm test` (date-time suite) fails on `main` already; don't treat it as a regression.
- Admin pages (`src/pages/admin/**`, `src/components/admin/**`, `src/styles/admin.css`, admin modals) are out of scope for de-indigo work. They pick up seasonal tokens only where they already use them.

## Review Focus

1. **Pale category colors with forced white text.** Powder blue, blush, ash, lavender, birch and amber cards are unreadable under `text-white`. Expect dark text on them everywhere: list cards, tag pills, badges, calendar events. (Tests: Task 2 checks the generated text vars; Task 4 greps that `EventListCard` no longer forces `text-white`.)
2. **Tags with no slot.** A database tag missing from `CATEGORY_SLOTS` (a new tag, for example) must still get a readable card via `.bg-event-default`, not a transparent one. (Test: Task 2.)
3. **`?season=` with a bad value.** `?season=summer` or `?season=<script>` must be ignored and fall back to the date. (Test: Task 3, the pure `resolveSeason`.)
4. **No JavaScript, or a cached page.** The page must still have a `data-season` attribute and a complete palette, never fall back to raw Tailwind defaults. (Test: Task 3 checks the built HTML.)
5. **Yellow featured star.** The `text-yellow-400` star is invisible on amber and pumpkin cards; it should use the card's text color. (Test: Task 4 grep.)

---

### Task 1: Season palettes, grouping and contrast helpers

**Files:**
- Modify: `src/lib/config.ts` (add a SEASONAL THEME section after TYPOGRAPHY; keep `COLOR_PALETTE` and `COLORS` until Task 6)
- Create: `src/lib/color-contrast.ts`
- Test: `src/lib/__tests__/seasonal-theme.test.ts`; add `"test:seasonal-theme": "tsx src/lib/__tests__/seasonal-theme.test.ts"` to `package.json`

**Interfaces:**
- Produces, in `config.ts`:
  - `type SeasonId = 'ski' | 'wildflower' | 'fall' | 'holiday'`
  - `type PaletteSlot = 'page' | 'ink' | 'hero' | 'highlight' | 'sports' | 'accent' | 'outdoors'`
  - `interface SeasonPalette { label: string; months: number[]; announcement: 'highlight' | 'accent'; colors: Record<PaletteSlot, string> }`
  - `const SEASON_PALETTES: Record<SeasonId, SeasonPalette>`
  - `const SEASON_IDS: SeasonId[]` (`['ski', 'wildflower', 'fall', 'holiday']`)
  - `const CATEGORY_SLOTS: Record<string, PaletteSlot>` (the 11 `CONSTANTS.tagCategories` plus `featured`)
  - `function getSeasonForMonth(month: number): SeasonId` (month is 1–12)
  - `function resolveSeason(requested: string | null, month: number): SeasonId`, which returns `requested` when it is a valid `SeasonId`, otherwise `getSeasonForMonth(month)`
- Produces, in `color-contrast.ts`:
  - `function contrastRatio(a: string, b: string): number` (WCAG 2.x relative luminance; accepts `#rrggbb`)
  - `function readableTextOn(bg: string): '#ffffff' | '#111111'`

- [ ] **Step 1: Create a branch.** `git switch -c feat/seasonal-palettes`

- [ ] **Step 2: Write the failing test.** Use `node:assert/strict` in the style of the other `tsx` test scripts, and print a pass line per case. Cases:
  - `getSeasonForMonth` maps 1, 2, 3 → `ski`; 4 through 8 → `wildflower`; 9, 10 → `fall`; 11, 12 → `holiday`.
  - `resolveSeason('fall', 1) === 'fall'`; `resolveSeason('summer', 1) === 'ski'`; `resolveSeason(null, 11) === 'holiday'`; `resolveSeason('<script>', 5) === 'wildflower'`.
  - Every month 1–12 appears in exactly one season's `months`.
  - Every entry of `CONSTANTS.tagCategories` plus `'featured'` has a slot in `CATEGORY_SLOTS`.
  - For every season, `new Set(Object.values(colors)).size <= 7`.
  - For every season and every category, `contrastRatio(readableTextOn(c), c) >= 4.5`, where `c = colors[CATEGORY_SLOTS[cat]]`. The same holds for the announcement color, and `contrastRatio('#ffffff', colors.hero) >= 4.5`.
  - `SEASON_PALETTES.fall.colors.highlight === '#d74100'` and `SEASON_PALETTES.ski.colors.sports === '#9a5248'`, to spot-check that the values were transcribed.
  - `contrastRatio('#ffffff', '#000000')` is 21 (within 0.01); `readableTextOn('#ffe600') === '#111111'`.

- [ ] **Step 3: Run it to confirm it fails.** `npm run test:seasonal-theme` → fails on the missing exports.

- [ ] **Step 4: Implement.** Add the types, constants and functions with the exact values from the tables above. Implement `color-contrast.ts` with no imports.

- [ ] **Step 5: Run it to confirm it passes.** `npm run test:seasonal-theme` → all PASS. Run `npm run check` → 0 errors.

- [ ] **Step 6: Commit.** `git commit -m "feat(theme): seasonal palettes, category grouping and contrast helpers"`

### Task 2: Generator emits seasonal CSS

**Files:**
- Create: `scripts/theme-css.ts`, exporting `buildThemeCss(): string` (pure, no file I/O)
- Modify: `scripts/generate-theme.ts`, which becomes: import `buildThemeCss`, write `src/styles/theme.generated.css`, log
- Modify: `src/styles/theme.css`. Delete the hand-written `.bg-event-*` rules and the arts-culture/sports FullCalendar text overrides, which are now generated. Keep the FullCalendar rules that aren't per-category.
- Regenerate: `src/styles/theme.generated.css`
- Test: append cases to `src/lib/__tests__/seasonal-theme.test.ts`

**Interfaces:**
- Consumes: everything Task 1 produces.
- Produces these CSS variables per season, inside `:root[data-season="<id>"]`:
  - `--color-primary` (hero), `--color-primary-dark` (hero mixed 40% toward black), `--color-primary-light` (hero mixed 90% toward white)
  - `--color-secondary` (highlight), `--color-surface` (page), `--color-text` (ink)
  - `--color-announcement-bg`, `--color-announcement-text`
  - `--gradient-hero: linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))`
  - `--color-category-<slug>` and `--color-category-<slug>-text` for every `CATEGORY_SLOTS` key
- The `@theme` block holds `SEASON_IDS[0]`'s values, so Tailwind utilities exist. Non-seasonal tokens (`surface-light`, `muted`, `border`, `link`, notifications, fonts) are emitted once, unchanged.
- Rules emitted once (not per season):
  - `.bg-event-<slug> { background-color: var(--color-category-<slug>) !important; color: var(--color-category-<slug>-text) !important; --fc-event-text-color: var(--color-category-<slug>-text); }`
  - `.bg-event-default` uses `--color-primary` with white text.
  - `.bg-event-today` uses the outdoors slot via the `nature` variables.
- Legacy aliases, so existing `var(--palette-*)` users and `.bg-blue`/`.bg-yellow`/`.bg-green`/`.bg-blue-green`/`.bg-fandango` follow the season without edits:
  - `--palette-palatinate-blue` → `--color-primary`
  - `--palette-canary` → `--color-secondary`
  - `--palette-fandango` → `--color-category-family`
  - `--palette-pigment-green`, `--palette-blue-green`, `--palette-cal-poly-green` → `--color-category-nature`
  - `--palette-dark-slate-gray` → `--color-category-civic`
- `--gradient-blues-light` and `--gradient-blues-bold` both become `var(--gradient-hero)`.

- [ ] **Step 1: Write the failing tests.** `buildThemeCss()` output must:
  - Contain `:root[data-season="fall"]` with `--color-category-sports: #6a010f`, and the same block for each of the four seasons.
  - Contain `--color-category-family-text: #111111` inside the holiday block (powder blue) and `#ffffff` inside the wildflower block (fireweed).
  - Set `--color-announcement-bg: #ff9b0c` for fall and `#f0b62b` for wildflower.
  - Contain `.bg-event-default` and `.bg-event-give-back` rules.
  - Not contain `#4740cb` or `#ffe600`.

- [ ] **Step 2: Run them to confirm they fail.** `npm run test:seasonal-theme` → FAIL (module missing).

- [ ] **Step 3: Implement `buildThemeCss()`.** Move the existing token emission out of `generate-theme.ts`. Use `readableTextOn` for every `-text` var. Write a small local `mix(hex, toward, t)` helper for the primary shades.

- [ ] **Step 4: Run the tests, then generate and build.** `npm run test:seasonal-theme` → PASS. `npm run theme:generate && npm run build` → build succeeds. Then `grep -c 'data-season' src/styles/theme.generated.css` → at least 4.

- [ ] **Step 5: Commit.** `git commit -m "feat(theme): generate per-season CSS variables and category rules"`

### Task 3: Pick the season in the page head

**Files:**
- Modify: `src/components/Layout.astro` and `src/components/AdminLayout.astro`
- Test: append to `src/lib/__tests__/seasonal-theme.test.ts`; check the build output

**Interfaces:**
- Consumes: `SEASON_IDS`, `getSeasonForMonth`, `resolveSeason` (Task 1).
- Produces: `<html data-season="…">` on every page.

- [ ] **Step 1: Server default.** Render `<html lang="en" data-season={getSeasonForMonth(new Date().getMonth() + 1)}>` so there is a season even without JavaScript.

- [ ] **Step 2: Inline correction before paint.** Add this as the first element in `<head>`:
  - an `is:inline` script with `define:vars={{ seasonIds: SEASON_IDS, byMonth }}`, where `byMonth` is the 12-entry array `[1..12].map(getSeasonForMonth)`
  - the script sets `document.documentElement.dataset.season` to the `?season=` query value when it is in `seasonIds`, otherwise to `byMonth[new Date().getMonth()]`
  - it duplicates `resolveSeason`'s rule because an inline script can't import; keep a one-line comment saying so
  - it never writes the query value anywhere except that attribute

- [ ] **Step 3: Verify.** `npm run build`, then `grep -l 'data-season=' dist/**/*.html | head` (or the server output directory the Netlify adapter uses) shows pages with the attribute. Spot-check one file for the inline script.

- [ ] **Step 4: Commit.** `git commit -m "feat(theme): choose seasonal palette from the visitor's date, with ?season= preview"`

### Task 4: Home page and shared chrome use the tokens

**Files:**
- Modify:
  - `src/pages/index.astro`
  - `src/components/AnnouncementMarquee.astro`
  - `src/components/EventListCard.astro`
  - `src/components/Navbar.astro`
  - `src/styles/global.css` (the `body` rule at line 31)

- [ ] **Step 1: Home page.** In `index.astro`, `<main>` becomes `bg-surface` (no indigo gradient). The hero `<section>` gets `style="background: var(--gradient-hero)"`, with its text staying white.

- [ ] **Step 2: Announcement band.**
  - In `AnnouncementMarquee.astro`, change the band's `background: var(--palette-canary)` to `var(--color-announcement-bg)`.
  - Change every inline `color: var(--color-text)` inside the band to `var(--color-announcement-text)`.
  - Swap the indigo focus ring on the side button to `focus:ring-primary`.

- [ ] **Step 3: Event list card.** In `EventListCard.astro`, delete `textClass = 'text-white'`, since `.bg-event-*` now sets the text color. Change the featured star from `text-yellow-400` to `text-current`. Keep square corners; add no `rounded`.

- [ ] **Step 4: Remaining chrome.** Set the `body` background to `var(--color-surface)` and its color to `var(--color-text)`. Swap the one `indigo` class in `Navbar.astro` to `primary`.

- [ ] **Step 5: Verify.**
  - `grep -n "text-white\|yellow-400" src/components/EventListCard.astro` → no matches.
  - `grep -n "indigo" src/pages/index.astro src/components/AnnouncementMarquee.astro src/components/Navbar.astro` → no matches.
  - `npm run lint && npm run check && npm run build` → clean.

- [ ] **Step 6: Commit.** `git commit -m "feat(theme): home page, announcement band and event cards follow the season"`

### Task 5: Remove hardcoded indigo from public pages

**Files:**
- Modify (public pages only):
  - `src/pages/about.astro`, `submit/thank-you.astro`, `login.astro`, `calendar-subscribe.astro`, `update-password.astro`
  - `src/pages/terms.astro`, `privacy.astro`, `submit.astro`, `submit-announcement.astro`, `things-to-do.astro`, `families/school.astro`
  - `src/scripts/image-upload-field.ts`

- [ ] **Step 1: Swap the classes.** Mapping:
  - `indigo-600`/`700` text, background, border and ring → `primary`
  - `indigo-800`/`900` → `primary-dark`
  - `indigo-50`/`100`/`200` → `primary-light`
  - `indigo-400`/`500` (focus rings, hovers) → `primary`
  - `from-indigo-*`/`to-indigo-*` gradient backgrounds → `style="background: var(--gradient-hero)"`

- [ ] **Step 2: Verify.**
  - `grep -rn "indigo-" src/pages src/components src/scripts | grep -v "admin"` → only lines in admin-only modals (`EditEventModal`, `SeriesModal`). List those in the PR as out of scope.
  - `npm run lint && npm run check && npm run build` → clean.

- [ ] **Step 3: Commit.** `git commit -m "refactor(theme): public pages use semantic primary tokens instead of indigo"`

### Task 6: Mobile follows the season; retire the old palette

**Files:**
- Modify: `mobile/lib/theme.ts`
- Modify: `src/lib/config.ts`. Remove `COLOR_PALETTE`, `COLORS.eventCategories`, `COLORS.eventTextColors`, `getEventCategoryColor`, `getEventTextColor`. Point `MARKER_COLORS` at `SEASON_PALETTES.fall.colors` slots (`current`/`event` → hero, `parent` → accent, `child` → outdoors). Set `COLORS.primary`/`secondary` to the fall hero/highlight as static fallbacks.
- Modify: `CUSTOMIZATION.md`. Replace the color section: how to edit `SEASON_PALETTES` and `CATEGORY_SLOTS`, run `npm run theme:generate`, preview with `?season=`, and the 4.5:1 rule the test enforces.

**Interfaces:**
- Consumes: `SEASON_PALETTES`, `CATEGORY_SLOTS`, `getSeasonForMonth` (Task 1); `readableTextOn` (Task 1, imported via `../../src/lib/color-contrast`).

- [ ] **Step 1: Mobile theme.** In `mobile/lib/theme.ts`:
  - Compute `season = getSeasonForMonth(new Date().getMonth() + 1)` and its `colors`.
  - Rebuild `CATEGORY_COLORS`, keyed by API tag name, from `CATEGORY_SLOTS`. Add the missing `'Give Back'` key.
  - `getCategoryTextColor` returns `readableTextOn(color)`.
  - `getCategoryTextMuted` returns `rgba(0,0,0,0.6)` or `rgba(255,255,255,0.7)` to match.
  - `headerBackground` → hero; `tabBarActive` and `starFilled` → highlight.
  - The legacy `canary`/`fandango`/`palatinateBlue` keys → highlight/accent/hero. Grep `mobile/` for their users and keep the keys only if used.
  - `LIGHT_BG_CATEGORIES` goes away.

- [ ] **Step 2: Verify nothing still imports removed names.** `grep -rn "COLOR_PALETTE\|getEventCategoryColor\|getEventTextColor\|eventTextColors" src scripts mobile --include='*.ts' --include='*.tsx' --include='*.astro' | grep -v node_modules` → no matches.

- [ ] **Step 3: Run the checks.**
  - `npm run test:seasonal-theme && npm run lint && npm run check && npm run build` → clean.
  - `cd mobile && npx tsc --noEmit && npm test` → clean. If Jest reports "RN Jest preset has moved", run `npm ci` in `mobile/` first.

- [ ] **Step 4: Commit.** `git commit -m "feat(theme): mobile uses seasonal palettes; drop legacy palette and docs update"`

### Task 7: Ship and check it live

- [ ] **Step 1: Open the PR.** Push the branch and open a PR. The body should cover:
  - the four palettes
  - the `?season=` preview links
  - the admin pages left on indigo
  - that the season switches by the visitor's date, so no cache purge is needed
- [ ] **Step 2: Hand off for live checks.** After it merges to `main` (which deploys), ask the user to check each season:
  - `/?season=fall`, `/?season=holiday`, `/?season=ski`, `/?season=wildflower`
  - the events list, the calendar and one event page
  - then press "Refresh public site" once, so the cached HTML picks up the new markup
