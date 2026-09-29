import { eq, desc, count } from "drizzle-orm";
import { users, type InsertUser } from "../../drizzle/schema";
import { ENV } from "../_core/env";
import { getDb, getDbOrFail, requireDb } from "../db";

export function resolveUserRole(
  incomingRole: InsertUser["role"],
  existingRole: "admin" | "user" | undefined,
  openId: string,
  ownerOpenId: string | undefined,
): "admin" | "user" {
  return incomingRole ?? existingRole ?? (openId === ownerOpenId ? "admin" : "user");
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDbOrFail();

  const [existing] = await db.select({ role: users.role }).from(users).where(eq(users.openId, user.openId)).limit(1);
  const role = resolveUserRole(user.role, existing?.role, user.openId, ENV.ownerOpenId);
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date(), role };
  const updateSet: Record<string, unknown> = { lastSignedIn: values.lastSignedIn, role };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDbOrFail();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
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

export async function listUsers(): Promise<UserListItem[]> {
  const db = requireDb(await getDb());
  return db
    .select({
      id: users.id,
      openId: users.openId,
      name: users.name,
      email: users.email,
      role: users.role,
      lastSignedIn: users.lastSignedIn,
    })
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
  const [result] = await db.select({ value: count() }).from(users).where(eq(users.role, "admin"));
  return result?.value ?? 0;
}

export async function promoteUser(targetUserId: number): Promise<UserListItem> {
  const db = requireDb(await getDb());
  const [user] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!user) throw new Error("Pengguna tidak ditemukan.");
  if (user.role === "admin") throw new Error("Pengguna sudah menjadi administrator.");
  await db.update(users).set({ role: "admin" }).where(eq(users.id, targetUserId));
  const [updated] = await db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!updated) throw new Error("Pengguna tidak ditemukan setelah diperbarui.");
  return updated;
}

export async function demoteUser(targetUserId: number): Promise<UserListItem> {
  const db = requireDb(await getDb());
  const [user] = await db.select().from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!user) throw new Error("Pengguna tidak ditemukan.");
  if (user.role !== "admin") throw new Error("Pengguna bukan administrator.");
  const adminCount = await countAdmins();
  if (adminCount <= 1) throw new Error("Tidak dapat menurunkan administrator terakhir. Tambahkan administrator lain terlebih dahulu.");
  await db.update(users).set({ role: "user" }).where(eq(users.id, targetUserId));
  const [updated] = await db.select({ id: users.id, openId: users.openId, name: users.name, email: users.email, role: users.role, lastSignedIn: users.lastSignedIn }).from(users).where(eq(users.id, targetUserId)).limit(1);
  if (!updated) throw new Error("Pengguna tidak ditemukan setelah diperbarui.");
  return updated;
}
