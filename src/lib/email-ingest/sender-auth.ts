import { supabaseAdmin } from '@/lib/supabase';

export async function isSuperAdminEmail(email: string): Promise<boolean> {
  // Look up all auth users (admin user counts are small, typically < 100)
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data) return false;

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) return false;

  // user_permissions is not in the generated DB types (same workaround as session.ts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perm } = await (supabaseAdmin as any)
    .from('user_permissions')
    .select('is_admin')
    .eq('user_id', user.id)
    .eq('is_admin', true)
    .single();

  return !!perm;
}
