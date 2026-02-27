// Rate limiting
export const SPAM_RATE_LIMIT_MS = 3000;

// Announcements
export const ANNOUNCEMENT_DEFAULT_EXPIRY_DAYS = 14;

// Session / cookies
export const ACCESS_TOKEN_DEFAULT_TTL = 3600; // 1 hour (seconds)
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days (seconds)

// Validation field limits
export const MAX_TITLE = 255;
export const MAX_DESCRIPTION = 2000;
export const MAX_NAME = 255;
export const MAX_ADDRESS = 500;
export const MAX_PHONE = 20;
export const MAX_COST = 100;
export const MAX_COMMENTS = 2000;
export const MAX_ALT_TEXT = 255;
