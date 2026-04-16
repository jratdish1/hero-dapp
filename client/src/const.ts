export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;

  // Guard: If OAuth portal URL is not configured, return "#"
  // This prevents TypeError: Failed to construct 'URL': Invalid URL
  if (!oauthPortalUrl) {
    console.warn("[HERO Dapp] VITE_OAUTH_PORTAL_URL not configured - OAuth login disabled");
    return "#";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  try {
    const url = new URL(`${oauthPortalUrl}/app-auth`);
    url.searchParams.set("appId", appId || "");
    url.searchParams.set("redirectUri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    return url.toString();
  } catch (e) {
    console.error("[HERO Dapp] Invalid OAuth URL:", e);
    return "#";
  }
};
