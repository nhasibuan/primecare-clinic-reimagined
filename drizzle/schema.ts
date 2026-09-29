import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar, index } from "drizzle-orm/mysql-core";

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
  captchaEnabled: boolean("captchaEnabled").default(true).notNull(),
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

/** @deprecated Unused — retained for migration compatibility. Will be removed in a future cleanup. */
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

/** @deprecated Unused — retained for migration compatibility. Will be removed in a future cleanup. */
export const openingSchedules = mysqlTable("opening_schedules", {
  id: int("id").autoincrement().primaryKey(),
  clinicianId: int("clinicianId").references(() => clinicians.id, { onDelete: "set null" }),
  serviceId: int("serviceId").references(() => services.id, { onDelete: "set null" }),
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
  uploadedBy: int("uploadedBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});

export const appointmentRequests = mysqlTable("appointment_requests", {
  id: int("id").autoincrement().primaryKey(),
  fullName: varchar("fullName", { length: 160 }).notNull(),
  contactNumber: varchar("contactNumber", { length: 40 }).notNull(),
  service: varchar("service", { length: 160 }).notNull(),
  preferredDate: varchar("preferredDate", { length: 10 }).notNull(),
  preferredTime: varchar("preferredTime", { length: 8 }),
  note: varchar("note", { length: 600 }),
  consentedAt: timestamp("consentedAt").defaultNow().notNull(),
  status: mysqlEnum("status", ["new", "contacted", "closed"]).default("new").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  // Data tambahan pasien (diisi oleh staf setelah kontak)
  nik: varchar("nik", { length: 30 }),
  tempatLahir: varchar("tempatLahir", { length: 100 }),
  tanggalLahir: varchar("tanggalLahir", { length: 10 }),
  alamatLengkap: varchar("alamatLengkap", { length: 500 }),
  agama: varchar("agama", { length: 50 }),
  email: varchar("email", { length: 255 }),
  instagramUrl: varchar("instagramUrl", { length: 255 }),
}, (table) => ({
  statusCreatedIdx: index("appointment_requests_status_created_idx").on(table.status, table.createdAt),
}));

export const whatsappFollowUpActivities = mysqlTable("whatsapp_follow_up_activities", {
  id: int("id").autoincrement().primaryKey(),
  appointmentRequestId: int("appointmentRequestId").notNull().references(() => appointmentRequests.id, { onDelete: "cascade" }),
  messageStatus: mysqlEnum("messageStatus", ["draft_copied", "whatsapp_opened"]).notNull(),
  finalDraftLength: int("finalDraftLength").notNull(),
  recordedBy: int("recordedBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const whatsappSignatureTemplates = mysqlTable("whatsapp_signature_templates", {
  id: int("id").autoincrement().primaryKey(),
  content: varchar("content", { length: 1000 }).notNull(),
  updatedBy: int("updatedBy").notNull().references(() => users.id, { onDelete: "restrict" }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const queueEntries = mysqlTable("queue_entries", {
  id: int("id").autoincrement().primaryKey(),
  queueNumber: int("queueNumber").notNull(),
  patientName: varchar("patientName", { length: 160 }).notNull(),
  poli: varchar("poli", { length: 160 }).notNull(),
  doctorName: varchar("doctorName", { length: 160 }).notNull(),
  appointmentRequestId: int("appointmentRequestId").unique().references(() => appointmentRequests.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["waiting", "serving", "done", "skipped"]).default("waiting").notNull(),
  queueDate: varchar("queueDate", { length: 10 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  dateNumIdx: index("queue_entries_date_num_idx").on(table.queueDate, table.queueNumber),
}));

export const osdSettings = mysqlTable("osd_settings", {
  id: int("id").autoincrement().primaryKey(),
  runningText: varchar("runningText", { length: 1000 }).default("Selamat datang di Klinik Berkat Insani. Mohon menunggu hingga nomor antrean Anda dipanggil.").notNull(),
  youtubeUrl: varchar("youtubeUrl", { length: 500 }).default("").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  actorId: int("actorId").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entityType", { length: 50 }).notNull(),
  entityId: varchar("entityId", { length: 50 }),
  detail: text("detail"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  actionIdx: index("audit_logs_action_idx").on(table.action),
  entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  createdIdx: index("audit_logs_created_idx").on(table.createdAt),
}));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ClinicProfile = typeof clinicProfiles.$inferSelect;
export type Service = typeof services.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type AppointmentRequest = typeof appointmentRequests.$inferSelect;
export type WhatsAppFollowUpActivity = typeof whatsappFollowUpActivities.$inferSelect;
export type WhatsAppSignatureTemplate = typeof whatsappSignatureTemplates.$inferSelect;
export type QueueEntry = typeof queueEntries.$inferSelect;
export type OsdSetting = typeof osdSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
