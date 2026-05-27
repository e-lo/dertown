# Mobile Deployment Guide

This guide covers building, submitting, and operating the Dertown mobile app in production.

---

## Architecture Overview

- **Expo managed workflow** — no native Xcode/Android Studio project files checked in; Expo manages the native layer.
- **EAS Build** — Expo Application Services compiles native iOS and Android binaries in the cloud.
- **Expo Push Service** — Expo acts as a relay between your backend and APNs (Apple) / FCM (Google). The backend sends push messages to `https://exp.host/--/api/v2/push/send`; Expo delivers them to each device.

---

## First-Time App Store Setup

### Apple (iOS)
1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/) ($99/year).
2. In App Store Connect, create a new app with bundle ID `com.dertown.app` (or your custom ID).
3. Fill in metadata: name, description, screenshots, privacy policy URL.
4. EAS will handle provisioning profiles and signing certificates automatically.

### Google (Android)
1. Create a [Google Play Console](https://play.google.com/console) account ($25 one-time fee).
2. Create a new app, set the package name to `com.dertown.app` (or your custom package).
3. Complete the store listing, content rating questionnaire, and privacy policy.

---

## EAS Build Setup

### Install and authenticate
```bash
npm install -g eas-cli
eas login
eas build:configure   # generates eas.json if it doesn't exist
```

### `eas.json` build profiles

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

| Profile | Purpose |
|---|---|
| `development` | Builds a dev client for testing with `expo-dev-client` |
| `preview` | Internal distribution (TestFlight / Google Play internal track) |
| `production` | App store release build |

---

## Building

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# Both at once
eas build --platform all --profile production
```

Builds run in the cloud. Monitor progress at [expo.dev](https://expo.dev) or in the terminal.

---

## Submitting to App Stores

After a successful production build:

```bash
# Submit to App Store (iOS)
eas submit --platform ios

# Submit to Google Play (Android)
eas submit --platform android
```

EAS will prompt for credentials on first run. For iOS it needs an App Store Connect API key; for Android it needs a Google Play service account JSON file. Store these in EAS Secrets (see EAS dashboard).

---

## OTA Updates

JavaScript-only changes (no new native modules) can be pushed without going through app store review:

```bash
eas update --branch production --message "Fix event date display"
```

Users receive the update on next app launch. Use OTA updates for bug fixes and UI tweaks. Any change that adds or modifies native dependencies requires a full `eas build` + store submission.

---

## Environment Variables in EAS

`EXPO_PUBLIC_API_BASE_URL` is inlined into the JS bundle at build time. Set it before building:

**Option A — EAS dashboard:**
Go to your project on [expo.dev](https://expo.dev) > Environment Variables > add `EXPO_PUBLIC_API_BASE_URL` scoped to the `production` build profile.

**Option B — `eas.json`:**
```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://dertown.com"
      }
    }
  }
}
```

Note: do not commit production URLs to `eas.json` if the file is public. Prefer the EAS dashboard for secrets.

---

## Push Notification Credentials

### iOS — APNs
EAS manages the APNs key automatically when you run `eas build` while authenticated with an Apple Developer account. If you need to supply your own:
1. Generate an APNs Auth Key (`.p8`) in the Apple Developer portal under Certificates, Identifiers & Profiles > Keys.
2. Upload it in the EAS dashboard under Credentials > iOS.

### Android — FCM
Expo's push service handles FCM automatically for managed-workflow apps with no extra configuration needed. If you are using a custom FCM sender ID, upload the `google-services.json` to the EAS dashboard under Credentials > Android.

---

## Localizing for a New Town

Use this checklist when deploying the app for a community other than Leavenworth:

- [ ] **`mobile/lib/app-config.ts`** — update:
  - `townName` — display name shown in UI
  - `webBaseUrl` — public URL of the web app (used for deep links)
  - `notificationChannelName` — Android notification channel label
  - `storageKeyPrefix` — AsyncStorage key prefix (prevents data collisions if multiple instances installed)
- [ ] **`mobile/app.json`** — update:
  - `name` — app display name
  - `slug` — Expo project slug (must be unique on expo.dev)
  - `ios.bundleIdentifier` — e.g. `com.yourtown.app`
  - `android.package` — e.g. `com.yourtown.app`
- [ ] **EAS environment variables** — set `EXPO_PUBLIC_API_BASE_URL` to the new backend deployment URL.
- [ ] **App store listings** — create new apps in App Store Connect and Google Play Console using the new bundle ID / package name.
- [ ] **Push credentials** — configure APNs and FCM credentials for the new bundle ID.
- [ ] Run `eas build --platform all --profile production` and submit.
