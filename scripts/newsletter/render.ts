/**
 * Render a newsletter draft to HTML and plain text for preview and sending.
 *
 *   npm run newsletter:render -- <sendDate> [--dir newsletters]
 */
import { writeFileSync } from 'node:fs';
import { renderNewsletter, renderNewsletterText } from '../../src/lib/newsletter/render';
import { draftsDir, issuePaths, main, parseArgs, readIssue, requireDateKey, siteUrl } from './cli';

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const sendDate = requireDateKey(args.positional[0]);
  const paths = issuePaths(draftsDir(args), sendDate);
  const issue = readIssue(paths.draft);

  writeFileSync(paths.html, renderNewsletter(issue, { siteUrl: siteUrl() }));
  writeFileSync(paths.text, renderNewsletterText(issue, { siteUrl: siteUrl() }));
  console.log(`Rendered ${paths.html}\nRendered ${paths.text}`);
});
