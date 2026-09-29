/**
 * Shared Zod input schemas for the tRPC router layer.
 *
 * Centralising schemas here keeps each domain router focused on
 * orchestration while making validation rules easy to discover, reuse
 * and test in isolation.
 */

import { z } from "zod";
import { MAX_WHATSAPP_DRAFT_LENGTH } from "../../shared/whatsappMessageMetrics";

// ── Clinic ────────────────────────────────────────────────────────────────────

export const profileInput = z.object({
  name: z.string().min(2).max(160),
  tagline: z.string().min(2).max(255),
  address: z.string().min(8).max(2000),
  whatsappUrl: z
    .string()
    .url()
    .refine(
      (value) => /^https:\/\/wa\.me\/\d+$/.test(value),
      "Use an official wa.me WhatsApp link.",
    ),
  instagramUrl: z.string().url().nullable().optional(),
});

export const serviceInput = z.object({
  id: z.number().int().positive().optional(),
  name: z.string().min(2).max(160),
  summary: z.string().min(8).max(4000),
  imageUrl: z
    .string()
    .min(1)
    .max(2000)
    .refine(
      (value) =>
        value.startsWith("/manus-storage/") || value.startsWith("data:image/"),
      "Image URL must reference an uploaded asset.",
    ),
  sortOrder: z.number().int().min(0).max(999),
  isPublished: z.boolean(),
});

export const uploadMediaInput = z.object({
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  dataBase64: z.string().min(1).max(7_000_000),
  altText: z.string().min(2).max(255),
  category: z.enum(["brand", "service", "clinician", "facility", "document"]),
});

// ── Appointments ──────────────────────────────────────────────────────────────

export const appointmentInput = z.object({
  fullName: z.string().trim().min(2).max(160),
  contactNumber: z
    .string()
    .trim()
    .min(8)
    .max(40)
    .regex(
      /^[0-9+\-\s]*[0-9][0-9+\-\s]*$/,
      "Gunakan nomor telepon atau WhatsApp yang valid.",
    ),
  service: z.string().trim().min(2).max(160),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Gunakan tanggal pilihan yang valid."),
  preferredHour: z.string().regex(/^\d{1,2}$/, "Gunakan jam yang valid."),
  preferredMinute: z
    .string()
    .regex(/^(00|15|30|45)$/, "Gunakan menit yang valid."),
  preferredPeriod: z.enum(["AM", "PM"]),
  note: z.string().trim().max(600).optional(),
  consent: z.literal(true),
  /** Honeypot field — must be absent or empty. */
  website: z.string().max(255).optional(),
  captchaToken: z.string().trim().max(2048).optional(),
});

export const updatePatientDataInput = z.object({
  id: z.number().int().positive(),
  nik: z
    .string()
    .trim()
    .max(30)
    .refine(
      (value) => {
        if (!value) return true;
        return /^\d{1,16}$/.test(value);
      },
      { message: "NIK harus berupa angka 1-16 digit." },
    )
    .optional(),
  tempatLahir: z.string().trim().max(100).optional(),
  tanggalLahir: z
    .string()
    .trim()
    .max(10)
    .refine(
      (value) => {
        if (!value) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        if (isNaN(date.getTime())) return false;
        const today = new Date();
        const todayUtc = Date.UTC(
          today.getUTCFullYear(),
          today.getUTCMonth(),
          today.getUTCDate(),
        );
        return date.getTime() < todayUtc;
      },
      { message: "Tanggal lahir tidak valid atau bukan tanggal di masa lalu." },
    )
    .optional(),
  alamatLengkap: z.string().trim().max(500).optional(),
  agama: z
    .string()
    .trim()
    .max(50)
    .refine(
      (value) => {
        if (!value) return true;
        return [
          "Islam",
          "Kristen",
          "Katolik",
          "Hindu",
          "Buddha",
          "Khonghucu",
          "Tidak ada",
          "",
        ].includes(value);
      },
      { message: "Agama tidak dikenali. Gunakan salah satu yang tersedia." },
    )
    .optional(),
  email: z
    .string()
    .trim()
    .max(255)
    .refine(
      (value) => {
        if (!value) return true;
        return (
          /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254
        );
      },
      { message: "Format email tidak valid." },
    )
    .optional(),
  instagramUrl: z
    .string()
    .trim()
    .max(255)
    .refine(
      (value) => {
        if (!value) return true;
        try {
          const url = new URL(
            value.startsWith("@")
              ? `https://instagram.com/${value.slice(1)}`
              : value,
          );
          return (
            url.hostname === "instagram.com" ||
            url.hostname === "www.instagram.com"
          );
        } catch {
          return false;
        }
      },
      { message: "URL Instagram tidak valid." },
    )
    .optional(),
});

export const followUpActivityFilterInput = z
  .object({
    messageStatus: z.enum(["draft_copied", "whatsapp_opened"]).optional(),
    startAt: z.date().optional(),
    endAt: z.date().optional(),
  })
  .superRefine((input, context) => {
    if (input.startAt && input.endAt && input.startAt > input.endAt) {
      context.addIssue({
        code: "custom",
        message: "Tanggal mulai tidak boleh setelah tanggal akhir.",
        path: ["endAt"],
      });
    }
  });

export const recordFollowUpActivityInput = z.object({
  appointmentRequestId: z.number().int().positive(),
  messageStatus: z.enum(["draft_copied", "whatsapp_opened"]),
  finalDraftLength: z.number().int().min(0).max(MAX_WHATSAPP_DRAFT_LENGTH),
});

// ── Queue ─────────────────────────────────────────────────────────────────────

export const addQueueEntryInput = z.object({
  patientName: z.string().trim().min(1).max(160),
  poli: z.string().trim().min(1).max(160),
  doctorName: z.string().trim().min(1).max(160),
  appointmentRequestId: z.number().int().positive().optional(),
});

export const queueEntryIdInput = z.object({
  id: z.number().int().positive(),
});

export const updateOsdSettingsInput = z.object({
  runningText: z.string().max(1000).optional(),
  youtubeUrl: z.string().max(500).optional(),
});

// ── Admin ─────────────────────────────────────────────────────────────────────

export const userIdInput = z.object({
  userId: z.number().int().positive(),
});

export const toggleCaptchaInput = z.object({
  enabled: z.boolean(),
});
