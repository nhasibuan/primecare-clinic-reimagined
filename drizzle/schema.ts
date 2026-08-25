import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const clinicProfiles = mysqlTable("clinic_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  tagline: varchar("tagline", { length: 255 }).notNull(),
  address: text("address").notNull(),
  whatsappUrl: varchar("whatsappUrl", { length: 500 }).notNull(),
  instagramUrl: varchar("instagramUrl", { length: 500 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  summary: text("summary").notNull(),
  imageUrl: text("imageUrl").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const clinicians = mysqlTable("clinicians", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  credentials: varchar("credentials", { length: 160 }),
  specialty: varchar("specialty", { length: 160 }),
  bio: text("bio"),
  photoUrl: text("photoUrl"),
  isPublished: boolean("isPublished").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const openingSchedules = mysqlTable("opening_schedules", {
  id: int("id").autoincrement().primaryKey(),
  clinicianId: int("clinicianId"),
  serviceId: int("serviceId"),
  dayLabel: varchar("dayLabel", { length: 120 }).notNull(),
  startTime: varchar("startTime", { length: 16 }),
  endTime: varchar("endTime", { length: 16 }),
  notes: text("notes"),
  isPublished: boolean("isPublished").default(false).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const mediaAssets = mysqlTable("media_assets", {
  id: int("id").autoincrement().primaryKey(),
  storageKey: varchar("storageKey", { length: 500 }).notNull().unique(),
  publicUrl: text("publicUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  altText: varchar("altText", { length: 255 }).notNull(),
  mimeType: varchar("mimeType", { length: 120 }).notNull(),
  category: mysqlEnum("category", ["brand", "service", "clinician", "facility", "document"]).default("service").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ClinicProfile = typeof clinicProfiles.$inferSelect;
export type Service = typeof services.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
