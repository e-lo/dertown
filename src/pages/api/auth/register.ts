import { supabase, supabaseAdmin } from '../../../lib/supabase';

export const prerender = false;

export async function POST({ request }: any) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return new Response(JSON.stringify({ error: 'Email and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (password.length < 8) {
    return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check against the admin-managed email allowlist.
  // Uses supabaseAdmin so this check works even before the user is authenticated.
  const { data: allowed, error: allowlistError } = await supabaseAdmin
    .from('email_allowlist')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (allowlistError) {
    console.error('[REGISTER] Allowlist check error:', allowlistError);
    return new Response(JSON.stringify({ error: 'Server error, please try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!allowed) {
    return new Response(
      JSON.stringify({
        error:
          'This email has not been approved for access. Please contact dertownleavenworth@gmail.com to request an invitation.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Email is approved — create the account.
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: `${request.headers.get('origin')}/login`,
    },
  });

  if (error) {
    console.error('[REGISTER] Signup error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Account created! Check your email to verify, then you can log in.',
    }),
    {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
