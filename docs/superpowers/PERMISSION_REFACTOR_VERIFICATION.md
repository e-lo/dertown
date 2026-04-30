# Permission Refactor Verification Steps

After applying migrations `20260430000003` and `20260430000004`, verify the refactor works correctly using these steps.

## 1. Verify Migration Execution

```bash
# Check that migrations were applied
supabase migration list

# Expected output should show both:
# 20260430000003_add_user_permissions_table.sql
# 20260430000004_update_rls_for_permissions.sql
```

## 2. Verify Database Schema

```bash
# Connect to Supabase directly or use dashboard

# Check user_permissions table exists
SELECT * FROM public.user_permissions;

# Verify dertown@gmail.com is seeded as super admin
SELECT user_id, is_admin, org_access_enabled FROM public.user_permissions 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'dertown@gmail.com');

# Expected: one row with is_admin=true, org_access_enabled=false
```

## 3. Verify RLS Functions

```bash
# Check has_admin_access() function exists and works
SELECT has_admin_access();

# Note: When run as anon, should return false
# When run as authenticated dertown@gmail.com, should return true
```

## 4. Test Authentication Flow (Browser)

### 4a. Login as dertown@gmail.com

1. Go to application login page
2. Sign in with dertown@gmail.com credentials
3. Should successfully authenticate and get auth cookie

### 4b. Verify Admin Access

1. Navigate to `/admin/organizations`
2. Should see organization list (means has_admin_access() returned true in RLS)
3. Try navigating to `/admin/organizations/[id]/users`
4. Should load org user management page

## 5. Test API Endpoints

### 5a. List All Users (Requires super admin)

```bash
curl -X GET http://localhost:3000/api/admin/users \
  -H "Cookie: <your-session-cookies>"

# Expected: 200 OK with list of user_permissions entries
# If not logged in: 403 Unauthorized
```

### 5b. Create New Admin (Requires super admin)

```bash
# First, get an existing user_id from auth.users
# Then create admin permission:

curl -X POST http://localhost:3000/api/admin/users \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookies>" \
  -d '{
    "user_id": "actual-user-uuid",
    "is_admin": true,
    "org_access_enabled": false
  }'

# Expected: 201 Created with user_permissions object
```

### 5c. Verify dertown@gmail.com Protection

```bash
# Try to revoke dertown@gmail.com's admin access

curl -X DELETE "http://localhost:3000/api/admin/users?user_id=$(supabase sql 'SELECT id FROM auth.users WHERE email = ''dertown@gmail.com'' LIMIT 1')" \
  -H "Cookie: <your-session-cookies>"

# Expected: 403 Forbidden with message "Cannot revoke admin access from dertown@gmail.com"
```

## 6. Test Session Logic

The `checkAdminAccess()` function in `src/lib/session.ts` now:

1. Fetches user_permissions for the authenticated user
2. Returns `role: 'super_admin'` if `is_admin = true`
3. Returns `role: 'org_editor'` if `org_access_enabled = true` and user has org_users entries
4. Returns `role: null` if neither flag is true

Test this by:
- Logging in as dertown@gmail.com → should see role='super_admin' in server logs
- Creating an org editor user → should see role='org_editor' when they access their org

## 7. Test Organization Access Isolation

### 7a. Create Test Org Editor

1. Use `/api/admin/users` to create new permission with:
   - `is_admin: false`
   - `org_access_enabled: true`
2. Manually add them to org_users for one organization:
   ```sql
   INSERT INTO org_users (user_id, organization_id) 
   VALUES ('user-uuid', 'org-uuid');
   ```

### 7b. Verify Isolation

1. Login as that org editor
2. Should only see their assigned organization in `/admin/organizations` (via RLS)
3. Should only see their org's data (events, series, locations, announcements)
4. Should NOT see other organizations' data

## 8. Rollback Test (If Needed)

If anything breaks, rollback is available:

```bash
# Revert the two new migrations
supabase db reset  # This resets to last working migration

# Or manually:
# - Drop has_admin_access() function
# - Restore is_super_admin() function (check git history)
# - Revert RLS policies (check git history)
# - Revert src/lib/session.ts (check git history)
```

## Success Criteria

✅ dertown@gmail.com can login and access all admin pages
✅ dertown@gmail.com cannot be deleted via API
✅ Admin API endpoints work correctly
✅ Organization editors have access to their org data only
✅ Non-admin users cannot access admin features
✅ RLS policies enforce all access rules
✅ Session logic correctly identifies user roles

## Debugging

If something fails:

**"Cannot access admin pages"**
- Check: does dertown@gmail.com have a row in user_permissions with is_admin=true?
- Check: did migrations apply successfully?
- Check: browser cookies and session validity

**"API returns 403 Unauthorized"**
- Check: is user logged in? (session cookies present?)
- Check: does user's session have is_admin=true in permissions?
- Check: is API endpoint calling checkAdminAccess() correctly?

**"Organization data not visible to org editor"**
- Check: does user have is_admin=false and org_access_enabled=true?
- Check: does user have entries in org_users table?
- Check: are RLS policies updated to call has_admin_access()?
