import type { CookieOptions, Request } from "express";
import { PROD_COOKIE_NAME } from "@shared/const";

/**
 * Session cookie name resolver.
 *
 * Production uses the `__Host-` prefix: browsers then refuse the cookie
 * unless it is Secure, Path=/, and host-only (no Domain attribute) — blocking
 * sibling-subdomain cookie-injection attacks. The prefix is omitted outside
 * production because `__Host-` requires HTTPS, which would break local
 * development over plain HTTP.
 */
export function getSessionCookieName(): string {
  return process.env.NODE_ENV === "production"
    ? PROD_COOKIE_NAME
    : PROD_COOKIE_NAME.slice("__Host-".length);
}

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
 * Session cookie attributes, paired with {@link getSessionCookieName}.
 *
 * `sameSite: "lax"` is retained as one CSRF layer (blocks cross-site POSTs
 * from carrying the cookie); the `__Host-` prefix (production) and HttpOnly
 * are the others.
 */
export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = isProduction || isSecureRequest(req);

  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure,
    // __Host- mandates no Domain attribute; only set one when the prefix is off.
    domain:
      !isProduction && shouldSetDomain(req)
        ? resolveCookieDomain(req)
        : undefined,
  };
}

function shouldSetDomain(req: Request): boolean {
  const hostname = req.hostname;
  return Boolean(
    hostname && !LOCAL_HOSTS.has(hostname) && !isIpAddress(hostname)
  );
}

function resolveCookieDomain(req: Request): string | undefined {
  const hostname = req.hostname;
  if (!hostname) return undefined;
  return hostname.startsWith(".") ? hostname : `.${hostname}`;
}
