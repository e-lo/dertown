import { supabase } from '../../../lib/supabase';

export async function POST({ request }: any) {
  const { email, password } = await request.json();

  // Validate email and password
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

  // Check if email is allowlisted
  const { data: allowlisted, error: allowlistError } = await supabase
    .from('allowlisted_org_emails')
    .select('organization_id')
    .eq('email', email.toLowerCase());

  if (allowlistError) {
    console.error('[REGISTER] Error checking allowlist:', allowlistError);
    return new Response(JSON.stringify({ error: 'Server error checking allowlist' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!allowlisted || allowlisted.length === 0) {
    return new Response(
      JSON.stringify({
        error: 'This email is not registered for any organization. Please email dertown@gmail.com to request access.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Sign up with Supabase
  const { data, error } = await supabase.auth.signUp({
    email: email.toLowerCase(),
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
      message: 'Check your email to verify your account. You can login after verification.',
    }),
    {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
