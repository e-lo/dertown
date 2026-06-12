/**
 * Content moderation utilities (App Store Guideline 1.2).
 *
 * - Terms agreement flag: the welcome gate requires agreeing to the Terms of
 *   Use (zero tolerance for objectionable content) before using the app.
 * - Blocked organizers: locally hides all content from a blocked organizer
 *   and notifies the developer so abusive submitters can be removed.
 * - Content reports: flag objectionable events/announcements/organizations;
 *   reports are emailed to the maintainer and acted on within 24 hours.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CONFIG } from './app-config';

const pfx = APP_CONFIG.storageKeyPrefix;

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:4321';

// ── Terms agreement ───────────────────────────────────────────────────────────

const TERMS_KEY = `${pfx}:terms_agreed:v1`;

export async function loadTermsAgreed(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(TERMS_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function saveTermsAgreed(): Promise<void> {
  try {
    await AsyncStorage.setItem(TERMS_KEY, 'true');
  } catch {
    // Best-effort persistence — the gate will simply show again next launch
  }
}

// ── Blocked organizers ────────────────────────────────────────────────────────

/** A blocked organizer with its display name (for the manage-blocked list). */
export interface BlockedOrg {
  id: string;
  name: string;
}

const BLOCKED_ORGS_KEY = `${pfx}:blocked_orgs`;

export async function loadBlockedOrgs(): Promise<BlockedOrg[]> {
  try {
    const raw = await AsyncStorage.getItem(BLOCKED_ORGS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BlockedOrg[];
  } catch {
    return [];
  }
}

export async function saveBlockedOrgs(orgs: BlockedOrg[]): Promise<void> {
  try {
    await AsyncStorage.setItem(BLOCKED_ORGS_KEY, JSON.stringify(orgs));
  } catch {
    // Best-effort persistence — silently discard errors
  }
}

// ── Content reports ───────────────────────────────────────────────────────────

export type ReportContentType = 'event' | 'announcement' | 'organization';

export interface ContentReport {
  action: 'report' | 'block';
  contentType: ReportContentType;
  contentId: string;
  contentTitle: string;
  reason: string;
  details?: string;
}

/**
 * Send a content report (or block notification) to the developer.
 * Resolves true on success; never throws — moderation UX should not break
 * on network failure (blocks still apply locally regardless).
 */
export async function submitReport(report: ContentReport): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/mobile/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    return res.ok;
  } catch {
    return false;
  }
}
