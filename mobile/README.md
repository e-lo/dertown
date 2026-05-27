# Dertown Mobile

React Native app for the Dertown community events platform (Leavenworth, WA). Built with Expo SDK 52, Expo Router v4, and React Native 0.76. Talks to the Astro/Supabase backend via a REST API.

---

## Prerequisites

- Node 20+
- Expo CLI: `npm install -g expo-cli`
- [Expo Go](https://expo.dev/go) app on a physical device or simulator

---

## Setup

```bash
git clone <repo>
cd mobile
npm install
cp .env.example .env.local
# Edit .env.local and set EXPO_PUBLIC_API_BASE_URL
```

---

## Running

```bash
npx expo start
```

Then press:
- `i` — open iOS simulator
- `a` — open Android emulator
- Scan the QR code with Expo Go on a physical device

---

## Environment Variables

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | Base URL of the Dertown backend API |

**Dev:** `http://localhost:4321`
**Prod:** `https://dertown.com` (or your custom domain)

All `EXPO_PUBLIC_` variables are inlined at build time by Metro. For EAS builds, set this in the EAS dashboard or `eas.json` (see `docs/mobile-deployment.md`).

---

## Project Structure

```
mobile/
  app/              # Screens and navigation (Expo Router file-based routing)
  components/       # Reusable UI components
  lib/
    api.ts          # Fetch helpers (events, announcements, push token registration)
    types.ts        # Shared TypeScript types
    theme.ts        # Brand colors and theme tokens
    dateUtils.ts    # Date formatting helpers
    notifications.ts # Push notification setup (permission request + token registration)
    app-config.ts   # Town-specific config (single file to edit when deploying to a new town)
  contexts/
    StarContext.tsx  # Starred events state (persisted via AsyncStorage)
  __tests__/        # Jest tests
```

`src/lib/config.ts` in the repo root defines the shared color palette and category list; `mobile/lib/theme.ts` imports from it.

---

## Running Tests

From the `mobile/` directory:

```bash
npx jest
# or
npm test
```

Watch mode: `npm run test:watch`

---

## Building for Production (EAS)

1. Install EAS CLI: `npm install -g eas-cli`
2. Log in: `eas login`
3. Build:
   ```bash
   eas build --platform ios
   eas build --platform android
   ```

`EXPO_PUBLIC_API_BASE_URL` must be set to the production URL in your EAS environment variables before building — values baked into JS at build time cannot be changed after the fact. See [Expo EAS Build docs](https://docs.expo.dev/build/introduction/) for full setup.

---

## Push Notifications

Push tokens are requested at app startup via `lib/notifications.ts`. On a physical device, the app requests permission, retrieves an Expo push token, and registers it with the backend at `POST /api/mobile/register-push-token`. Tokens are stored in the `push_tokens` Supabase table. When an admin approves an announcement, the backend fans out push notifications to all registered tokens via Expo's Push Service.

Push notifications do not work on simulators — a physical device is required.

---

## Localization / Customization

To deploy this app for a different town:

1. **`mobile/lib/app-config.ts`** — edit `townName`, `webBaseUrl`, `notificationChannelName`, and `storageKeyPrefix`. This is the single file intended for town-specific overrides.
2. **`mobile/app.json`** — update `name`, `slug`, `ios.bundleIdentifier`, and `android.package` to match your new app identity.
3. Set `EXPO_PUBLIC_API_BASE_URL` to your new backend deployment in EAS environment variables.
4. Submit as a new app to the App Store and Google Play.
