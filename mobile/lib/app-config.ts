/**
 * App-level configuration — customize this file to localize for a new town.
 *
 * To adapt for another community:
 *   1. Edit every value in APP_CONFIG below.
 *   2. Update app.json (name, slug, ios.bundleIdentifier, android.package).
 *   3. Point EXPO_PUBLIC_API_BASE_URL at the new backend.
 *
 * Note: icalUtils.ts uses `timezone` for iCal/calendar string identifiers but
 * contains Pacific-specific DST offset math in getPacificOffsetMinutes — update
 * that function if deploying to a non-Pacific timezone.
 */
export const APP_CONFIG = {
  /** Display name of the town shown in the UI (e.g. header, empty states). */
  townName: 'Leavenworth',

  /** Base URL of the web app — used for share links and submit forms. No trailing slash. */
  webBaseUrl: 'https://dertown.org',

  /** Prefix for AsyncStorage keys. Change if deploying multiple apps on the same device. */
  storageKeyPrefix: 'dertown',

  /** Android notification channel display name. */
  notificationChannelName: 'Dertown',

  /** IANA timezone identifier for the community. Used in calendar exports and event date handling. */
  timezone: 'America/Los_Angeles',

  /** Town center as [longitude, latitude] for the map's initial camera position. */
  mapCenter: { longitude: -120.6615, latitude: 47.5962 },

  /** Contact email for feedback, event corrections, and org admin inquiries. */
  contactEmail: 'dertownleavenworth@gmail.com',

  /** URL to submit a new event on the web app. */
  submitEventUrl: 'https://dertown.org/submit',

  /** URL to submit a community announcement. */
  submitAnnouncementUrl: 'https://dertown.org/submit-announcement',

  /** URL to the terms of use page. */
  termsUrl: 'https://dertown.org/terms',

  /** URL to file a bug report (GitHub or equivalent). */
  bugReportUrl: 'https://github.com/e-lo/dertown/issues/new?template=bug_report.yml',

  /** URL to file a feature request (GitHub or equivalent). */
  featureRequestUrl: 'https://github.com/e-lo/dertown/issues/new?template=feature_request.yml',
} as const;
