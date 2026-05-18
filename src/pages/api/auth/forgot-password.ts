import { supabase } from '../../../lib/supabase';

export const prerender = false;

export async function POST({ request }: any) {
  const { email } = await request.json();

  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build a reliable redirectTo — origin header can be null in SSR contexts
  const origin =
    request.headers.get('origin') ||
    (() => {
      try { return new URL(request.url).origin; } catch { return ''; }
    })();
  const redirectTo = origin ? `${origin}/update-password` : undefined;

  console.log('[FORGOT-PASSWORD] Sending reset to:', email, '| redirectTo:', redirectTo);

  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
    ...(redirectTo ? { redirectTo } : {}),
  });

  if (error) {
    // Log the real error server-side so it shows in Netlify/server logs
    console.error('[FORGOT-PASSWORD] Supabase error:', error.message, error);

    // Expose the error in dev so it's easier to debug; hide in production
    const isDev = import.meta.env.DEV;
    return new Response(
      JSON.stringify({
        success: false,
        error: isDev
          ? `Failed to send reset email: ${error.message}`
          : 'Failed to send reset email. Please try again or contact dertownleavenworth@gmail.com.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  console.log('[FORGOT-PASSWORD] Reset email sent successfully to:', email);
  return new Response(
    JSON.stringify({
      success: true,
      message: 'Check your email for a password reset link.',
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
