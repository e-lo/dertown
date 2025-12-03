# Testing Authentication Locally

## Quick Setup Guide

### 1. Start Local Supabase

First, make sure Docker is running, then start Supabase:

```bash
supabase start
```

This will:
- Start local Supabase on `http://127.0.0.1:54321`
- Start Supabase Studio on `http://127.0.0.1:54323`
- Start local database on port `54322`

### 2. Enable Local Database Mode

Add this to your `.env.local` file:

```bash
USE_LOCAL_DB=true
```

This tells the app to use the local Supabase instance instead of the remote one.

### 3. Create a Test User

You can create a test user in two ways:

#### Option A: Via Supabase Studio (Easiest)

1. Open Supabase Studio: http://127.0.0.1:54323
2. Go to **Authentication** → **Users**
3. Click **Add User** → **Create new user**
4. Enter:
   - Email: `test@example.com` (or any email)
   - Password: `testpassword123` (or any password)
   - Auto Confirm User: ✅ (check this box)
5. Click **Create User**

#### Option B: Via Supabase CLI

```bash
# Create a user via SQL
supabase db execute "
  INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES (
    'test@example.com',
    crypt('testpassword123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW()
  );
"
```

### 4. Start the Dev Server

```bash
npm run dev
# or
make dev
```

The app will be available at `http://localhost:4321`

### 5. Test the Authentication Flow

1. **Test Login:**
   - Navigate to `http://localhost:4321/login`
   - Enter your test user credentials
   - Should redirect to `/admin` on success

2. **Test Protected Endpoints:**
   - Without login: Try accessing `/api/admin/events-staged` → Should return 401
   - After login: Should return data

3. **Test Admin Dashboard:**
   - After logging in, visit `http://localhost:4321/admin`
   - Should see the admin dashboard with events/announcements

4. **Test Logout:**
   - Click logout button
   - Try accessing admin endpoints again → Should return 401

## Troubleshooting

### Docker Not Running

If you see "Cannot connect to the Docker daemon":
- Start Docker Desktop (or your Docker service)
- Then run `supabase start` again

### Can't Create User

If user creation fails:
- Make sure Supabase is running: `supabase status`
- Check Supabase Studio logs
- Try using the CLI method instead

### Authentication Not Working

If login fails:
- Check that `USE_LOCAL_DB=true` is in `.env.local`
- Verify Supabase is running: `supabase status`
- Check browser console for errors
- Check server logs for authentication errors

### Session Not Persisting

If you get logged out immediately:
- Check that cookies are being set (browser DevTools → Application → Cookies)
- Make sure `httpOnly` cookies are supported (they should be)
- Try clearing all cookies and logging in again

## Using Remote Supabase for Testing

If you prefer to test against your remote Supabase instance:

1. **Don't set** `USE_LOCAL_DB` (or set it to `false`)
2. Make sure `.env.local` has your remote Supabase credentials:
   ```
   PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   PUBLIC_SUPABASE_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```
3. Create a test user in your remote Supabase dashboard
4. Test as described above

## Default Local Supabase Credentials

When using local Supabase (`USE_LOCAL_DB=true`), these are automatically used:

- **URL:** `http://127.0.0.1:54321`
- **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0`
- **Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU`

These are hardcoded in the code and don't need to be in your `.env` file when using local mode.

