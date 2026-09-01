/**
 * Canonical site URL for the web app.
 *
 * Kept separate from src/lib/config.ts because resolving it needs
 * `import.meta.env`, and config.ts is also type-checked by the React Native app
 * (see mobile/tsconfig.json), which has no such syntax.
 */

/**
 * Origin of the public site, no trailing slash.
 *
 * Astro populates `import.meta.env.SITE` from the `site` option in
 * astro.config.mjs, which reads the SITE env var (see .env.example). The literal
 * is only the last-resort fallback.
 *
 * Every absolute link the feeds emit is built from this. It previously lived as
 * a copy-pasted fallback in each feed route and drifted into three different
 * values (`https://dertown.com`, `http://www.dertown.org`,
 * `http://localhost:4321`), so keep it here rather than reintroducing literals.
 */
export const SITE_URL = import.meta.env.SITE || 'https://dertown.org';
