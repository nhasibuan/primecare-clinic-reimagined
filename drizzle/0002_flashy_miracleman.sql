CREATE TABLE `whatsapp_signature_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`content` varchar(1000) NOT NULL,
	`updatedBy` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_signature_templates_id` PRIMARY KEY(`id`)
);
