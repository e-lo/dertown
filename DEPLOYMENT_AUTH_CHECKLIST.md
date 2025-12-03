# Authentication Deployment Checklist for Netlify + Supabase

## Critical Issues Fixed ✅

1. **Cookie Security**: Updated `secure` flag to automatically detect production (HTTPS) vs development (HTTP)
   - Cookies now use `secure: true` in production (Netlify uses HTTPS)
   - Cookies use `secure: false` in local development (HTTP)

2. **SSR Session Check**: Fixed `login.astro` to use cookie-based session check instead of client-side Supabase session
   - Now uses `checkAdminAccess()` which reads from cookies (works in SSR)
   - Previously used `supabase.auth.getSession()` which doesn't work in SSR context

## Pre-Deployment Checklist

### 1. Environment Variables in Netlify

Ensure these are set in Netlify's environment variables (Site settings → Environment variables):

- ✅ `PUBLIC_SUPABASE_URL` - Your production Supabase project URL
- ✅ `PUBLIC_SUPABASE_KEY` - Your production Supabase anon/public key
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Your production Supabase service role key (for admin operations)
- ❌ **DO NOT SET** `USE_LOCAL_DB` - Leave this unset or set to `false` in production

### 2. Supabase Dashboard Configuration

#### Redirect URLs
In your Supabase Dashboard → Authentication → URL Configuration:

1. **Site URL**: Set to your Netlify domain (e.g., `https://your-site.netlify.app` or your custom domain)
2. **Redirect URLs**: Add your production URLs:
   - `https://your-site.netlify.app/**`
   - `https://your-site.netlify.app/login`
   - `https://your-site.netlify.app/admin`
   - If using a custom domain, add those URLs too

#### Email Templates (if using email auth)
- Verify email templates are configured
- Update any hardcoded localhost URLs in templates to your production domain

### 3. Cookie Configuration

The following cookie settings are now automatically configured:
- ✅ `httpOnly: true` - Prevents JavaScript access (security)
- ✅ `sameSite: 'lax'` - CSRF protection while allowing navigation
- ✅ `secure: true` in production (HTTPS) - Prevents transmission over HTTP
- ✅ `secure: false` in development (HTTP) - Allows local testing

### 4. JWT Token Expiration

- **Access Token**: Expires in 1 hour (3600 seconds) - matches Supabase default
- **Refresh Token**: Expires in 7 days
- **Note**: There's currently no automatic token refresh logic. Users will need to log in again after 1 hour of inactivity.

### 5. Testing Checklist

Before deploying, test locally with production-like settings:

1. **Test with production Supabase** (temporarily):
   ```bash
   # In .env.local, comment out USE_LOCAL_DB and use production credentials
   # PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   # PUBLIC_SUPABASE_KEY=your-production-anon-key
   ```

2. **Verify cookie behavior**:
   - Check that cookies are set with `secure: true` when using HTTPS
   - Verify cookies persist across page navigations
   - Test logout clears cookies

3. **Test authentication flow**:
   - Login → redirect to admin
   - Access protected routes
   - Logout → verify access is denied

## Potential Issues to Monitor

### 1. Token Refresh (Not Currently Implemented)

**Issue**: Access tokens expire after 1 hour. Users will be logged out after 1 hour of inactivity.

**Current Behavior**: Users must log in again after token expiration.

**Future Enhancement**: Implement automatic token refresh using the refresh token before the access token expires.

### 2. Session Persistence Across Deployments

**Issue**: If Netlify redeploys while users are logged in, sessions should persist (cookies are client-side).

**Expected Behavior**: Sessions should persist across deployments since cookies are stored in the browser.

### 3. CORS Configuration

**Current Setup**: Using same-origin cookies (`sameSite: 'lax'`), so CORS shouldn't be an issue.

**If Issues Arise**: Check Supabase Dashboard → Settings → API → CORS settings if you need to allow specific origins.

### 4. Domain/Subdomain Issues

**If using custom domain or subdomains**:
- Ensure cookies are set with appropriate `domain` attribute if needed
- Verify Supabase redirect URLs include all domains/subdomains
- Check that `sameSite: 'lax'` works with your domain setup

## Post-Deployment Verification

1. ✅ Login works on production domain
2. ✅ Cookies are set with `secure: true` (check in browser DevTools → Application → Cookies)
3. ✅ Session persists across page navigations
4. ✅ Logout clears cookies
5. ✅ Protected routes (admin) require authentication
6. ✅ Redirect after login works correctly

## Troubleshooting

### "Missing required environment variables" Error

- Check Netlify environment variables are set correctly
- Verify variable names match exactly (case-sensitive)
- Ensure `USE_LOCAL_DB` is NOT set (or set to `false`)

### "No session cookies found" Error

- Check browser DevTools → Application → Cookies
- Verify cookies are being set (check Network tab → Response Headers)
- Check that `secure: true` cookies work with HTTPS
- Verify `sameSite: 'lax'` isn't blocking cookies

### Login works but session doesn't persist

- Check cookie expiration times
- Verify `httpOnly` and `secure` flags are correct
- Check browser console for cookie-related errors
- Test in incognito mode to rule out browser extension issues

### Redirect URL errors

- Verify Supabase Dashboard → Authentication → Redirect URLs includes your production domain
- Check that redirect URLs match exactly (including trailing slashes, protocols)

