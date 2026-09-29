
import { z } from "zod";

const KNOWN_DEV_JWT_SECRET = "dev_jwt_secret_k8xP2mQ9vR3nT6wY1bF4hJ7dL0cA5eG";

const envSchema = z.object({
  appId: z.string().optional().default(""),
  cookieSecret: z.string().optional().default(""),
  databaseUrl: z.string().optional().default(""),
  oAuthServerUrl: z.string().optional().default(""),
  ownerOpenId: z.string().optional().default(""),
  isProduction: z.boolean(),
  forgeApiUrl: z.string().optional().default(""),
  forgeApiKey: z.string().optional().default(""),
  turnstileSecretKey: z.string().optional().default(""),
  turnstileAllowTestKey: z.coerce.boolean(),
});

const parsedEnv = envSchema.parse({
  appId: process.env.VITE_APP_ID,
  cookieSecret: process.env.JWT_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  oAuthServerUrl: process.env.OAUTH_SERVER_URL,
  ownerOpenId: process.env.OWNER_OPEN_ID,
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL,
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY,
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
  turnstileAllowTestKey: process.env.TURNSTILE_ALLOW_TEST_KEY === "true",
});

export const ENV = parsedEnv;

/**
 * Fail-fast validation that runs once at server startup.
 * Blocks production launches with known-insecure defaults.
 */
export function validateProductionEnv(): void {
  if (ENV.isProduction) {
    const errors: string[] = [];
    if (!ENV.cookieSecret || ENV.cookieSecret === KNOWN_DEV_JWT_SECRET) {
      errors.push("JWT_SECRET must be set to a unique, secret value in production (the committed dev default is not safe).");
    }
    if (ENV.cookieSecret.length < 32) {
      errors.push("JWT_SECRET must be at least 32 characters.");
    }
    if (!ENV.ownerOpenId) {
      errors.push("OWNER_OPEN_ID must be set in production so at least one admin exists.");
    }
    if (!ENV.oAuthServerUrl) {
      errors.push("OAUTH_SERVER_URL must be set in production for authentication.");
    }
    if (!ENV.databaseUrl) {
      errors.push("DATABASE_URL must be set in production.");
    }

    if (errors.length > 0) {
      throw new Error(`Production environment validation failed:\n${errors.join("\n")}`);
    }
  }
}
