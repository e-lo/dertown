import { parseIntent } from '../email-ingest/command-parser';

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

  return allTestsPassed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
export { runTests };
