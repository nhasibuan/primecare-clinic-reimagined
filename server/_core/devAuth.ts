import type { Express, Request, Response } from "express";
import { SESSION_TTL_MS } from "../../shared/const";
import * as db from "../db";
import { getSessionCookieName, getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const DEV_ADMIN_OPEN_ID = "dev-admin-local-001";
const DEV_ADMIN_NAME = "Dev Admin";
const DEV_ADMIN_EMAIL = "admin@localhost.dev";

/**
 * Dev-only login endpoint.
 * Only available when NODE_ENV=development.
 * Creates a local admin session without requiring Manus OAuth.
 */
export function registerDevAuthRoutes(app: Express) {
  // Dev-only login — creates an admin session directly
  app.get("/api/dev/login", async (_req: Request, res: Response) => {
    if (process.env.NODE_ENV !== "development") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }

    try {
      // Upsert dev admin user in database
      await db.upsertUser({
        openId: DEV_ADMIN_OPEN_ID,
        name: DEV_ADMIN_NAME,
        email: DEV_ADMIN_EMAIL,
        loginMethod: "dev",
        lastSignedIn: new Date(),
        role: "admin",
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(DEV_ADMIN_OPEN_ID, {
        name: DEV_ADMIN_NAME,
        expiresInMs: SESSION_TTL_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(_req);
      _req.res?.cookie(getSessionCookieName(), sessionToken, {
        ...cookieOptions,
        maxAge: SESSION_TTL_MS,
      });

      console.log("[Dev Auth] Admin session created for dev-admin-local-001");

      // Redirect to admin page
      res.redirect(302, "/admin");
    } catch (error) {
      console.error("[Dev Auth] Login failed:", error);
      res.status(500).json({ error: "Dev login failed" });
    }
  });

  // Dev-only logout
  app.get("/api/dev/logout", (_req: Request, res: Response) => {
    if (process.env.NODE_ENV !== "development") {
      res.status(404).json({ error: "Not available in production" });
      return;
    }

    const cookieOptions = getSessionCookieOptions(_req);
    res.clearCookie(getSessionCookieName(), { ...cookieOptions, maxAge: -1 });
    res.redirect(302, "/");
  });
}
