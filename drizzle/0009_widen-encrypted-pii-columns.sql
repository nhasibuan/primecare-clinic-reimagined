-- Widen encrypted PII columns for AES-256-GCM envelopes (server/encryption.ts).
-- Envelope length = 20 + 4*ceil((n+16)/3) for an n-character plaintext; widths
-- hold the longest plaintext accepted by the Zod input schemas. Contract test:
-- server/encryption.test.ts ("envelope capacity contract").
-- NOTE: only ALTERs here — audit_logs DDL/indexes were created by the
-- hand-written 0008 migration and must not be re-created.
ALTER TABLE `appointment_requests` MODIFY COLUMN `fullName` varchar(400) NOT NULL;--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY COLUMN `contactNumber` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY COLUMN `note` varchar(1024);--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY COLUMN `nik` varchar(128);--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY COLUMN `tempatLahir` varchar(192);--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY COLUMN `tanggalLahir` varchar(64);--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY COLUMN `alamatLengkap` varchar(768);--> statement-breakpoint
ALTER TABLE `appointment_requests` MODIFY COLUMN `email` varchar(400);--> statement-breakpoint
ALTER TABLE `queue_entries` MODIFY COLUMN `patientName` varchar(400) NOT NULL;
