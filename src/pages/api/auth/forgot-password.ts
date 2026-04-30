import { supabase } from '../../../lib/supabase';

export async function POST({ request }: any) {
  const { email } = await request.json();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
    redirectTo: `${request.headers.get('origin')}/update-password`,
  });

  if (error) {
    console.error('[FORGOT-PASSWORD] Error:', error);
    // Return success even on error to prevent email enumeration
    return new Response(
      JSON.stringify({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset link.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset link.',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
