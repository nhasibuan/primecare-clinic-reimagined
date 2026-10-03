import { eq, desc, count } from "drizzle-orm";
import { users, type InsertUser } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { MIN_ADMIN_COUNT_SAFE } from "@shared/const";
import { getDb, getDbOrFail, requireDb } from "../db";

export function resolveUserRole(
  incomingRole: InsertUser["role"],
  existingRole: "admin" | "user" | undefined,
  openId: string,
  ownerOpenId: string | undefined
): "admin" | "user" {
  return (
    incomingRole ?? existingRole ?? (openId === ownerOpenId ? "admin" : "user")
  );
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDbOrFail();

  const [existing] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.openId, user.openId))
    .limit(1);
  const role = resolveUserRole(
    user.role,
    existing?.role,
    user.openId,
    ENV.ownerOpenId
  );
  const values: InsertUser = {
    openId: user.openId,
    lastSignedIn: user.lastSignedIn ?? new Date(),
    role,
  };
  const updateSet: Record<string, unknown> = {
    lastSignedIn: values.lastSignedIn,
    role,
  };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  await db
    .insert(users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDbOrFail();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result[0] || null;
}

export type UserListItem = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  lastSignedIn: Date;
};

/** Shared column selection for user list queries — avoids repeating the column map. */
const USER_LIST_COLUMNS = {
  id: users.id,
  openId: users.openId,
  name: users.name,
  email: users.email,
  role: users.role,
  lastSignedIn: users.lastSignedIn,
} as const;

export async function listUsers(): Promise<UserListItem[]> {
  const db = requireDb(await getDb());
  return db
    .select(USER_LIST_COLUMNS)
    .from(users)
    .orderBy(desc(users.lastSignedIn));
}

export async function getUserById(id: number) {
  const db = requireDb(await getDb());
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user || null;
}

export async function countAdmins(): Promise<number> {
  const db = requireDb(await getDb());
  const [result] = await db
    .select({ value: count() })
    .from(users)
    .where(eq(users.role, "admin"));
  return result?.value ?? 0;
}

/** Fetches a single user's list-safe fields by ID. Throws if not found. */
async function requireUserById(
  db: Awaited<ReturnType<typeof getDb>> & object,
  id: number
): Promise<UserListItem> {
  const [user] = await db
    .select(USER_LIST_COLUMNS)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!user) throw new Error("Pengguna tidak ditemukan setelah diperbarui.");
  return user;
}

export async function promoteUser(targetUserId: number): Promise<UserListItem> {
  const db = requireDb(await getDb());
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!user) throw new Error("Pengguna tidak ditemukan.");
  if (user.role === "admin")
    throw new Error("Pengguna sudah menjadi administrator.");
  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, targetUserId));
  return requireUserById(db, targetUserId);
}

export async function demoteUser(targetUserId: number): Promise<UserListItem> {
  const db = requireDb(await getDb());
  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  if (!user) throw new Error("Pengguna tidak ditemukan.");
  if (user.role !== "admin") throw new Error("Pengguna bukan administrator.");
  const adminCount = await countAdmins();
  // Hard floor: never demote the final admin (guarantees recovery access).
  if (adminCount <= 1)
    throw new Error(
      "Tidak dapat menurunkan administrator terakhir. Tambahkan administrator lain terlebih dahulu."
    );
  // Soft floor: permit the demotion, but make the thin margin visible so the
  // remaining admins add a backup before an outage or another demotion.
  if (adminCount <= MIN_ADMIN_COUNT_SAFE) {
    console.warn(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "warn",
        component: "admin",
        message: `Admin count (${adminCount}) is at or below the safe minimum (${MIN_ADMIN_COUNT_SAFE}) after demotion request.`,
        targetUserId,
      })
    );
  }
  await db
    .update(users)
    .set({ role: "user" })
    .where(eq(users.id, targetUserId));
  return requireUserById(db, targetUserId);
}
