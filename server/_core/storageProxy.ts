import type { Express } from "express";
import { ENV } from "./env";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Tiny inline 1x1 transparent PNG as fallback when forge is unavailable
 * (development mode without BUILT_IN_FORGE_API_URL configured).
 */
const FALLBACK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

export function registerStorageProxy(app: Express) {
  app.get("/manus-storage/*", async (req, res) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      // Development fallback: serve favicon from public dir if present,
      // otherwise return a tiny transparent PNG (clients don't break).
      const publicFavicon = resolve(__dirname, "../../client/public", key);
      if (key.endsWith(".png") || key.endsWith(".ico")) {
        try {
          const stat = await import("node:fs").then(fs =>
            fs.promises.stat(publicFavicon)
          );
          if (stat) {
            const buf = await import("node:fs").then(fs =>
              fs.promises.readFile(publicFavicon)
            );
            if (buf) {
              res.set("Content-Type", "image/png");
              res.send(buf);
              return;
            }
          }
        } catch {
          // file not found, fall through to inline PNG
        }
      }
      res.set("Content-Type", "image/png");
      res.send(FALLBACK_PNG);
      return;
    }

    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);

      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
      });

      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(
          `[StorageProxy] forge error: ${forgeResp.status} ${body}`
        );
        res.status(502).send("Storage backend error");
        return;
      }

      const { url } = (await forgeResp.json()) as { url: string };
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }

      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}
