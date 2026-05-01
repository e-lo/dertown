# Permission System Refactor - Summary

## What Changed

Migrated from hardcoded email-based admin identification to a database-driven permission system using the `user_permissions` table.

### Before
- Super admin status checked via hardcoded email `'dertown@gmail.com'` in RLS policies
- Not scalable for multiple admins
- Not maintainable if email changes
- Fragile and error-prone

### After
- Super admin status stored in `user_permissions` table
- `is_admin` boolean flag marks system administrators
- `org_access_enabled` boolean flag marks organization-scoped editors
- Database-driven, extensible for future permission types

## Files Changed

### New Migrations
- `supabase/migrations/20260430000003_add_user_permissions_table.sql`
  - Creates `user_permissions` table
  - Seeds dertown@gmail.com as super admin
  - Enables RLS for the table

- `supabase/migrations/20260430000004_update_rls_for_permissions.sql`
  - Replaces `is_super_admin()` with `has_admin_access()`
  - Updates all RLS policies to use new function
  - Updates `user_organization_ids()` to check admin status first

### Modified Files
- `src/lib/session.ts`
  - Updated `checkAdminAccess()` to query `user_permissions` table
  - Removed hardcoded email list
  - Handles missing permission records gracefully

### New Files
- `src/pages/api/admin/users.ts`
  - GET: List all users and their permissions
  - POST: Create/upsert user permissions
  - PUT: Update user permissions
  - DELETE: Revoke admin access (with safeguard for dertown@gmail.com)

## How It Works

### Permission Model

**Super Admin** (`is_admin = true`)
- Has full access to all tables and organizations
- No organization filtering applied
- Can manage permissions for other users

**Organization Editor** (`org_access_enabled = true`)
- Access determined by entries in `org_users` table
- Can only see/edit their assigned organizations' content
- Can create announcements as drafts (requiring super admin approval)

**No Access** (no `user_permissions` entry or both flags false)
- Cannot access admin features
- Cannot modify any content

### Database Query Flow

1. **User logs in** → Session established with auth.users entry
2. **Session check** → `checkAdminAccess()` queries `user_permissions` table
3. **Permission lookup** → Returns `role: 'super_admin'` or `'org_editor'` or `null`
4. **RLS policies apply** → Uses `has_admin_access()` function for fine-grained access

## Testing

### Verify dertown@gmail.com Still Works

```bash
# 1. Check migrations applied
supabase db inspect

# 2. Verify user_permissions table exists
SELECT * FROM public.user_permissions WHERE is_admin = true;

# 3. Login as dertown@gmail.com via browser
# Should have full access to all admin features

# 4. Test admin API
curl -X GET http://localhost:3000/api/admin/organizations \
  -H "Cookie: <your-auth-cookies>"
# Should return all organizations

# 5. Test org editor isolation still works
# Register an org editor with email from allowlist
# Should only see their assigned organization
```

### Adding New Admins

```bash
# Via API
curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-auth-cookies>" \
  -d '{
    "user_id": "<existing-auth-user-id>",
    "is_admin": true,
    "org_access_enabled": false
  }'

# Or directly in database
INSERT INTO user_permissions (user_id, is_admin, org_access_enabled)
VALUES ('<user-id>', true, false);
```

### Revoking Admin Access

```bash
# Via API
curl -X DELETE "http://localhost:3000/api/admin/users?user_id=<user-id>" \
  -H "Cookie: <your-auth-cookies>"

# Or in database
DELETE FROM user_permissions WHERE user_id = '<user-id>';
```

**Note:** dertown@gmail.com has safeguard preventing deletion via API

## Future Extensibility

This system supports adding new permission types by adding columns to `user_permissions`:

```sql
ALTER TABLE public.user_permissions ADD COLUMN location_manager boolean DEFAULT false;
ALTER TABLE public.user_permissions ADD COLUMN announcement_moderator boolean DEFAULT false;
```

Then update RLS functions to check these new flags.

## Rollback Plan

If anything goes wrong:

1. Keep the old RLS policies in git history
2. Restore `is_super_admin()` function that checks email
3. Revert `checkAdminAccess()` to use hardcoded email list
4. The `user_permissions` table data remains intact for reference

```sql
-- Emergency rollback: restore email-based admin check
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN auth.jwt() ->> 'email' IN ('dertown@gmail.com');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Performance

- Added index on `user_permissions.user_id` for fast lookups
- RLS queries use indexed lookups
- No performance regression from original design

## Security

- RLS policies prevent unauthorized access to `user_permissions` table
- Only super admins can read/modify permissions
- Email verification trigger still works for org editors
- dertown@gmail.com protection on DELETE prevents accidental revocation
