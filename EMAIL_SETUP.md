# Email Setup Guide

> **See also:** [DEVELOPING.md](./DEVELOPING.md) for general development setup and [PROJECT_REQUIREMENTS.md](./PROJECT_REQUIREMENTS.md) for system architecture.

## Current Implementation

The event edit suggestion form now sends emails using:

1. **Local Development (Inbucket)**: When `USE_LOCAL_DB=true`, emails are logged to the console and can be viewed in Inbucket at `http://localhost:54324`
2. **Production (Resend API)**: When `RESEND_API_KEY` is set, emails are sent via Resend API

## Local Development Setup

### Option 1: View Emails in Inbucket (Recommended for Testing)

1. Start your Supabase local instance: `supabase start`
2. Inbucket email testing interface is available at: `http://localhost:54324`
3. When you submit the suggest edit form, check the console logs for email details
4. To actually send emails to Inbucket via SMTP:
   - Uncomment the SMTP port in `supabase/config.toml`:
     ```toml
     smtp_port = 54325
     ```
   - Restart Supabase: `supabase stop && supabase start`
   - The code will automatically use Inbucket when `USE_LOCAL_DB=true`

### Option 2: Use Resend for Local Testing

1. Sign up for a free Resend account at https://resend.com
2. Get your API key from the dashboard
3. Add to `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   RECIPIENT_EMAIL=dertown@gmail.com
   ```
4. Restart your dev server

## Production Setup

1. Sign up for Resend at https://resend.com
2. Verify your domain (or use the default `onboarding@resend.dev` for testing)
3. Get your API key from the dashboard
4. Add to your production environment variables:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   RECIPIENT_EMAIL=dertown@gmail.com
   ```
5. Update the `from` address in `src/pages/api/events/suggest-edit.ts` to use your verified domain

## Environment Variables

- `RESEND_API_KEY`: Your Resend API key (required for production)
- `RECIPIENT_EMAIL`: Email address to receive suggestions (defaults to `dertown@gmail.com`)
- `USE_LOCAL_DB`: Set to `true` for local development (uses Inbucket)

## Testing

1. Submit the suggest edit form on an event page
2. Check:
   - **Local**: Console logs and Inbucket at `http://localhost:54324`
   - **Production**: Resend dashboard for sent emails

## Troubleshooting

- **No emails in local**: Check console logs. Emails are logged when `USE_LOCAL_DB=true`
- **Resend errors**: Verify your API key and domain verification status
- **SMTP errors**: Make sure Inbucket SMTP port is enabled in `supabase/config.toml`


