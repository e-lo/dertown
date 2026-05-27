/**
 * App-level configuration — customize this file to localize for a new town.
 *
 * To adapt for another community:
 *   1. Edit every value in APP_CONFIG below.
 *   2. Update app.json (name, slug, ios.bundleIdentifier, android.package).
 *   3. Point EXPO_PUBLIC_API_BASE_URL at the new backend.
 */
export const APP_CONFIG = {
  /** Display name of the town shown in the UI (e.g. header, empty states). */
  townName: 'Leavenworth',

  /** Base URL of the web app — used for share links. No trailing slash. */
  webBaseUrl: 'https://dertown.com',

  /** Prefix for AsyncStorage keys. Change if deploying multiple apps on the same device. */
  storageKeyPrefix: 'dertown',

  /** Android notification channel display name. */
  notificationChannelName: 'Dertown',
} as const;
