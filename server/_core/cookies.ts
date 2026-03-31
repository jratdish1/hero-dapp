import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isIpAddress(host: string) {
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

/**
 * Session cookie options — hardened for production:
 * - httpOnly: true — prevents JavaScript access (XSS mitigation)
 * - secure: true in production — cookie only sent over HTTPS
 * - sameSite: "none" — required for cross-origin OAuth callback flow
 *   NOTE: We use "none" because the Manus OAuth flow redirects from a
 *   different origin (api.manus.im) back to our app. SameSite=Lax would
 *   block the cookie set during this cross-origin redirect. The cookie is
 *   still protected by httpOnly + secure flags.
 * - path: "/" — cookie available site-wide
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);
  const isDev = process.env.NODE_ENV === "development";

  return {
    httpOnly: true,
    path: "/",
    // SameSite=None is required for cross-origin OAuth callback
    // In dev without HTTPS, fall back to Lax to avoid cookie rejection
    sameSite: secure ? "none" : (isDev ? "lax" : "none"),
    // Always secure in production; in dev, only if HTTPS is available
    secure: secure || !isDev,
  };
}
