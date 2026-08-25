CREATE TABLE `appointment_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fullName` varchar(160) NOT NULL,
	`contactNumber` varchar(40) NOT NULL,
	`service` varchar(160) NOT NULL,
	`preferredDate` varchar(10) NOT NULL,
	`note` varchar(600),
	`consentedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appointment_requests_id` PRIMARY KEY(`id`)
);
