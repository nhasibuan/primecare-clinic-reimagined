import { and, asc, count, desc, eq, gte, lte, type SQL } from "drizzle-orm";
export { eq, and, asc, count, desc, gte, lte, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
export { clinicProfiles } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;
let _lastConnectionAttempt = 0;
const RECONNECT_INTERVAL_MS = 30_000;

function logDb(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = { timestamp: new Date().toISOString(), level, component: "database", message, ...meta };
  if (level === "error") console.error(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

export async function getDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    logDb("error", "DATABASE_URL is not configured");
    return null;
  }

  const now = Date.now();
  if (now - _lastConnectionAttempt < RECONNECT_INTERVAL_MS) {
    logDb("warn", "Reconnection throttled", { elapsed: now - _lastConnectionAttempt });
    return null;
  }
  _lastConnectionAttempt = now;

  try {
    _db = drizzle(process.env.DATABASE_URL);
    logDb("info", "Database connection established");
  } catch (error) {
    _db = null;
    logDb("error", "Failed to create database connection", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return _db;
}

export async function getDbOrFail() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is temporarily unavailable. Check DATABASE_URL and ensure the database server is running.");
  }
  return db;
}

export function requireDb(db: Awaited<ReturnType<typeof getDb>>) {
  if (!db) throw new Error("Database is temporarily unavailable. Check DATABASE_URL and ensure the database server is running.");
  return db;
}

// Re-exports to maintain backwards compatibility
export * from "./repositories/userRepository";
export * from "./repositories/clinicRepository";
export * from "./repositories/appointmentRepository";
export * from "./repositories/queueRepository";
export * from "./services/clinicValidation";
