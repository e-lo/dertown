# Dertown Mobile

React Native app for the Dertown community events platform (Leavenworth, WA). Built with Expo SDK 54, Expo Router v6, and React Native 0.81. Talks to the Astro/Supabase backend via a REST API.

For full build, deployment, and store submission instructions see [`docs/mobile-deployment.md`](../docs/mobile-deployment.md).

---

## Prerequisites

- Node 20+
- npm 10+

No global CLI installs required — all commands use `npx`.

---

## Setup

```bash
git clone <repo>
cd mobile
npm install
cp .env.example .env.local
# Edit .env.local — see Environment Variables below
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | ✅ | Backend API base URL (`http://localhost:4321` for dev) |
| `EXPO_PUBLIC_MAPBOX_TOKEN` | ✅ | Mapbox public `pk.` token for map rendering |
| `EXPO_PUBLIC_SENTRY_DSN` | optional | Sentry DSN for error reporting (leave blank to disable locally) |

All `EXPO_PUBLIC_` variables are inlined into the JS bundle at build time.

---

## Running Locally (Simulator)

```bash
npx expo start
```

Then press `i` (iOS simulator) or `a` (Android emulator).

> **Note:** Expo Go is not supported — the app uses native modules (Mapbox, Sentry) that require a compiled build. Use the simulator workflow above, or a [development build](#development-build-physical-device) for physical device testing.

---

## Development Build (Physical Device)

A development build is a compiled app you install directly on your device. Required for testing push notifications, calendar integration, and any native module behavior.

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios    # or android, or all
```

Once built, install the `.ipa` / `.apk` on your device. Then run:

```bash
npx expo start --dev-client
```

And scan the QR code — the dev client connects to your local Metro server.

See [`docs/mobile-deployment.md`](../docs/mobile-deployment.md) for EAS account setup and required secrets.

---

## Running Tests

```bash
npm test           # single run
npm run test:watch # watch mode
```

---

## Project Structure

```
mobile/
  app/              # Screens and navigation (Expo Router file-based routing)
  components/       # Reusable UI components
  lib/
    api.ts          # API fetch helpers
    app-config.ts   # Town-specific config — edit this to localize for a new community
    cache.ts        # Two-layer cache (memory + AsyncStorage)
    dateUtils.ts    # Date formatting helpers
    icalUtils.ts    # Calendar export and iCal file generation
    notifications.ts # Push notification permission + token registration
    theme.ts        # Brand colors and theme tokens
    types.ts        # Shared TypeScript interfaces
  contexts/
    StarContext.tsx  # Starred events state (persisted via AsyncStorage)
  __tests__/        # Jest tests
  assets/           # App icon, splash screen, adaptive icon
```

`src/lib/config.ts` in the repo root defines the shared color palette and category list; `mobile/lib/theme.ts` imports from it.

---

## Localizing for a New Community

See the full checklist in [`docs/mobile-deployment.md`](../docs/mobile-deployment.md#localizing-for-a-new-community). The short version:

1. **`lib/app-config.ts`** — all town-specific strings, URLs, coordinates, and timezone live here
2. **`app.json`** — app name, slug, bundle ID, and package name
3. **EAS environment variables** — API URL, Mapbox token, Sentry DSN
4. **Store listings** — new apps in App Store Connect and Google Play Console
