CREATE TABLE `osd_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runningText` varchar(1000) NOT NULL DEFAULT 'Selamat datang di Klinik Berkat Insani. Mohon menunggu hingga nomor antrean Anda dipanggil.',
	`youtubeUrl` varchar(500) NOT NULL DEFAULT '',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `osd_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `queue_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`queueNumber` int NOT NULL,
	`patientName` varchar(160) NOT NULL,
	`poli` varchar(160) NOT NULL,
	`doctorName` varchar(160) NOT NULL,
	`status` enum('waiting','serving','done','skipped') NOT NULL DEFAULT 'waiting',
	`queueDate` varchar(10) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `queue_entries_id` PRIMARY KEY(`id`)
);
