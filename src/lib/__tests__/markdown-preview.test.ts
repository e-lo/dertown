import { renderMarkdownPreview } from '../markdown-utils';

function check(name: string, actual: unknown, expected: unknown): boolean {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(
    pass
      ? `✅ PASS: ${name}\n`
      : `❌ FAIL: ${name}\n   expected ${JSON.stringify(expected)}\n   got      ${JSON.stringify(actual)}\n`
  );
  return pass;
}

function runTests(): boolean {
  console.log('🧪 Testing renderMarkdownPreview\n');
  let allTestsPassed = true;

  allTestsPassed = check('null', renderMarkdownPreview(null), '') && allTestsPassed;
  allTestsPassed =
    check('plain text unchanged', renderMarkdownPreview('Bring a chair.'), 'Bring a chair.') &&
    allTestsPassed;
  allTestsPassed =
    check(
      'links keep their text, drop the URL',
      renderMarkdownPreview(
        'Sign the [Volunteer Waiver](https://app.waiversign.com/e/620bea1e8182280019e9296a/doc/620bfa7d) first.'
      ),
      'Sign the Volunteer Waiver first.'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'ATX headings and paragraphs flatten to one line',
      renderMarkdownPreview('Intro text. \n\n### What you need to know\n\nMeetings monthly.'),
      'Intro text. What you need to know Meetings monthly.'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'setext underline is removed',
      renderMarkdownPreview('Calling teens!\n============\nJoin us.'),
      'Calling teens! Join us.'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'emphasis, code and list markers are removed',
      renderMarkdownPreview('**Bold** and *italic* and `code`\n\n- one\n- two\n1. three'),
      'Bold and italic and code one two three'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'entities are decoded, not double-escaped',
      renderMarkdownPreview('Beth & Steve say "hi" <3'),
      'Beth & Steve say "hi" <3'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'raw HTML tags are stripped',
      renderMarkdownPreview('Line one<br>Line <b>two</b>'),
      'Line one Line two'
    ) && allTestsPassed;
  allTestsPassed =
    check(
      'truncates at a word boundary with an ellipsis',
      renderMarkdownPreview('alpha beta gamma delta', 13),
      'alpha beta…'
    ) && allTestsPassed;

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
