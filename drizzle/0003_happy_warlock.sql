CREATE TABLE `whatsapp_follow_up_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`appointmentRequestId` int NOT NULL,
	`messageStatus` enum('draft_copied','whatsapp_opened') NOT NULL,
	`finalDraftLength` int NOT NULL,
	`recordedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_follow_up_activities_id` PRIMARY KEY(`id`)
);
