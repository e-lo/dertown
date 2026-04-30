# Organization User Management

## Overview

Organization editors can now manage events, series, locations, and announcements for their assigned organizations. Each organization can have multiple users (typically 2-3), and each user can manage multiple organizations.

## For Super Admins

### Adding User Access

1. Go to `/admin/organizations`
2. Find the organization
3. Click "Users" or "Manage users"
4. Click "Add email"
5. Enter the email address
6. Click "Add"

The user will be able to register with that email.

### Revoking Access

1. Go to the organization's users page
2. Find the email
3. Click "Remove"
4. Confirm the removal

The user loses access immediately. If they were already registered, they can no longer login.

### Approving Announcements

Only super admins can publish announcements. Organization editors can create them as drafts.

1. Go to admin announcements page
2. Find draft announcements
3. Click "Approve" to publish
4. Click "Reject" to delete

## For Organization Editors

### Registering

1. Navigate to `/register`
2. Enter your email (must be allowlisted by super admin)
3. Enter a password (at least 8 characters)
4. Check your email for verification link
5. Click the link to verify
6. Login with your email and password

### Creating Content

- **Events:** Can create, edit, and delete events for your organization. Published immediately.
- **Series:** Can create, edit, and delete event series. Published immediately.
- **Locations:** Can create, edit, and delete locations. Published immediately.
- **Announcements:** Can create announcements as drafts. Super admin must approve before publishing.

### Resetting Password

1. Go to `/forgot-password`
2. Enter your email
3. Check your email for reset link
4. Click the link
5. Set your new password

## Technical Details

- Users are linked to organizations via the `org_users` table
- Email allowlisting is managed in `allowlisted_org_emails`
- All data access is enforced via Supabase RLS policies
- Super admins are identified by hardcoded email list
- Email verification triggers automatic org_users creation

## Support

For access issues, email dertown@gmail.com.
