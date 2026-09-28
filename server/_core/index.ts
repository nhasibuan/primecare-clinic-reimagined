import "dotenv/config";
import { validateProductionEnv } from "./env";
import express from "express";
import crypto from "crypto";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerDevAuthRoutes } from "./devAuth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateProductionEnv();
  const app = express();
  const server = createServer(app);
  // The production gateway is the single trusted proxy that resolves req.ip.
  app.set("trust proxy", 1);
  // ── Request ID for tracing ──
  app.use((req, _res, next) => {
    req.headers["x-request-id"] = req.headers["x-request-id"] || crypto.randomUUID();
    next();
  });
  // The media-upload tRPC mutation sends base64-encoded files (up to 5 MB raw →
  // ~7 MB base64), so it needs a larger limit on its specific path.
  // Mounted BEFORE the global 1 MB parser so Express applies this limit first.
  app.use("/api/trpc/clinic.uploadMedia", express.json({ limit: "7mb" }));
  // Default body limit — kept small to reduce request-body DoS surface.
  // Must come AFTER route-specific overrides (Express uses the first matching parser).
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  // ── Security headers (defence-in-depth, complements reverse-proxy) ──
  const cspBase = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.manus.space https://i.imgur.com https://*.imgur.com https://*.iili.io",
    "font-src 'self'",
    "connect-src 'self' https://*.manus.space",
    "frame-src https://www.youtube.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  // Vite HMR injects inline scripts; production keeps strict self-only policy.
  const cspDev  = [...cspBase, "script-src 'self' 'unsafe-inline' 'unsafe-eval'"].join("; ");
  const cspProd = [...cspBase, "script-src 'self'"].join("; ");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0"); // modern browsers use CSP instead
    res.setHeader("Content-Security-Policy", process.env.NODE_ENV === "production" ? cspProd : cspDev);
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
    }
    next();
  });
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerDevAuthRoutes(app);
  // Health check — returns 503 when the database is unreachable.
  app.get("/healthz", async (_req, res) => {
    const { getDb } = await import("../db");
    const db = await getDb();
    if (db) {
      // Optionally ping the DB to verify the connection is alive
      try {
        await db.execute("SELECT 1");
        res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
      } catch (error) {
        res.status(503).json({
          status: "degraded",
          db: "connected_but_failing",
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      res.status(503).json({
        status: "degraded",
        db: "unavailable",
        timestamp: new Date().toISOString(),
      });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
