export const COOKIE_NAME = "app_session_id";
// Session lifetime: 30 days (reduced from 1 year for security)
export const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;
// Legacy alias — kept for backward compatibility during migration
export const ONE_YEAR_MS = SESSION_MAX_AGE_MS;
export const AXIOS_TIMEOUT_MS = 30_000;
export const UNAUTHED_ERR_MSG = 'Please login (10001)';
export const NOT_ADMIN_ERR_MSG = 'You do not have required permission (10002)';
