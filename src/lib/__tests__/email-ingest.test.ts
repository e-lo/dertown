import { parseIntent } from '../email-ingest/command-parser';
import { extractBody } from '../email-ingest/content-extractor';
import { screenEvent } from '../email-ingest/screener';
import type { ExcludeRules } from '../scraper/types';

function runTests() {
  console.log('🧪 Testing email-ingest modules\n');
  let allTestsPassed = true;

  // --- command-parser ---

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'Check this out' },
      plain: 'Hey look at this https://example.com/events page',
    });
    if (result.type === 'scrape' && result.url === 'https://example.com/events') {
      console.log('✅ PASS: URL in body → scrape intent\n');
    } else {
      console.log(`❌ FAIL: URL in body → scrape intent. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'Announcement: City Hall closed Monday' },
      plain: 'Just a heads up about the closure.',
    });
    if (result.type === 'announcement' && result.title === 'City Hall closed Monday') {
      console.log('✅ PASS: Announcement subject → announcement intent\n');
    } else {
      console.log(`❌ FAIL: Announcement subject. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'add announcement: Farmers market this Saturday' },
      plain: 'Come out to the market!',
    });
    if (result.type === 'announcement' && result.title === 'Farmers market this Saturday') {
      console.log('✅ PASS: "add announcement:" subject → announcement intent\n');
    } else {
      console.log(`❌ FAIL: "add announcement:" subject. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'FW: Community BBQ this Saturday' },
      plain: 'Come join us for a community BBQ at Enchantments Park on Saturday June 7th at noon.',
    });
    if (result.type === 'event') {
      console.log('✅ PASS: Plain email → event intent\n');
    } else {
      console.log(`❌ FAIL: Plain email → event intent. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    // URL in body takes priority over announcement subject
    const result = parseIntent({
      envelope: { from: 'test@example.com', to: 'events@dertown.app' },
      headers: { subject: 'Announcement: Check this' },
      plain: 'See https://example.com/event for details',
    });
    if (result.type === 'scrape') {
      console.log('✅ PASS: URL in body beats announcement subject\n');
    } else {
      console.log(`❌ FAIL: URL priority. Got: ${JSON.stringify(result)}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // --- content-extractor ---

  try {
    const input = `Here is the event info.
Join us Saturday at noon.

> On Mon, May 26, 2026 at 10:00 AM, Alice wrote:
> Hey can you add this?

--
Sent from my iPhone`;
    const result = extractBody(input);
    const hasContent = result.includes('Here is the event info');
    const noQuotes = !result.includes('> On Mon');
    const noSignature = !result.includes('Sent from my iPhone');
    if (hasContent && noQuotes && noSignature) {
      console.log('✅ PASS: extractBody strips quoted lines and signature\n');
    } else {
      console.log(`❌ FAIL: extractBody. Got:\n${result}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const input = `Community meeting Thursday at 7pm at City Hall.

Unsubscribe from this list | View in browser`;
    const result = extractBody(input);
    const hasContent = result.includes('Community meeting');
    const noFooter = !result.includes('Unsubscribe');
    if (hasContent && noFooter) {
      console.log('✅ PASS: extractBody strips footer patterns\n');
    } else {
      console.log(`❌ FAIL: extractBody footer. Got:\n${result}\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const input = `Plain email with no footer or quotes.`;
    const result = extractBody(input);
    if (result === 'Plain email with no footer or quotes.') {
      console.log('✅ PASS: extractBody passes clean text through unchanged\n');
    } else {
      console.log(`❌ FAIL: extractBody clean text. Got: "${result}"\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  // --- screener ---

  try {
    const rules: ExcludeRules = { title_keywords: [' camp', 'group lessons'] };
    const result = screenEvent({ title: 'Summer Strings Camp', location_name: null }, rules);
    if (!result.pass) {
      console.log('✅ PASS: screenEvent blocks event matching title_keywords\n');
    } else {
      console.log(`❌ FAIL: screenEvent should have blocked "Summer Strings Camp"\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const rules: ExcludeRules = { title_keywords: [' camp'] };
    const result = screenEvent({ title: 'Community BBQ', location_name: null }, rules);
    if (result.pass) {
      console.log('✅ PASS: screenEvent passes event not matching any rule\n');
    } else {
      console.log(`❌ FAIL: screenEvent blocked "Community BBQ" incorrectly\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  try {
    const result = screenEvent({ title: 'Any Event', location_name: null }, null);
    if (result.pass) {
      console.log('✅ PASS: screenEvent passes when rules are null\n');
    } else {
      console.log(`❌ FAIL: screenEvent should pass with null rules\n`);
      allTestsPassed = false;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error}\n`);
    allTestsPassed = false;
  }

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
