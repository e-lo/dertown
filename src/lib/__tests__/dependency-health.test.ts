/**
 * Dependency-health canary — guards against dependency upgrades (e.g. Dependabot
 * PRs) that build fine but break the production *runtime*.
 *
 * Run on the SAME Node version production uses (CI reads .nvmrc). It has caught,
 * in spirit, both real outages:
 *   1. @supabase/supabase-js bumped to a version whose realtime-js requires a
 *      WebSocket at construction → createClient threw on Node 18. This test
 *      constructs a client and fails if that throw returns.
 *   2. (Build/install-level breakage like an incompatible adapter peer is caught
 *      by the `npm ci` + `npm run build` steps that run alongside this test.)
 */
import { createClient } from '@supabase/supabase-js';

let failures = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${label}`);
  } catch (e) {
    console.log(`❌ FAIL: ${label}\n        ${(e as Error).message}`);
    failures++;
  }
}

console.log(`🧪 Dependency health (Node ${process.version})\n`);

check('@supabase/supabase-js createClient constructs without throwing on this Node version', () => {
  // No network/real creds needed — the failure mode (realtime/WebSocket init)
  // throws synchronously inside the SupabaseClient constructor.
  const client = createClient('https://example.supabase.co', 'test-anon-key');
  if (!client || typeof client.from !== 'function') {
    throw new Error('createClient returned an unusable client');
  }
});

check('supabaseAdmin-style client (service key) also constructs', () => {
  const admin = createClient('https://example.supabase.co', 'test-service-key');
  if (!admin || typeof admin.rpc !== 'function') {
    throw new Error('admin createClient returned an unusable client');
  }
});

console.log(failures === 0 ? '\n✅ Dependency health OK' : `\n❌ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
