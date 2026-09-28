CREATE TABLE `audit_logs` (
  `id` int AUTO_INCREMENT NOT NULL,
  `actorId` int,
  `action` varchar(100) NOT NULL,
  `entityType` varchar(50) NOT NULL,
  `entityId` varchar(50),
  `detail` text,
  `ipAddress` varchar(45),
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`),
  CONSTRAINT `audit_logs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX `audit_logs_action_idx` ON `audit_logs` (`action`);
--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`, `entityId`);
--> statement-breakpoint
CREATE INDEX `audit_logs_created_idx` ON `audit_logs` (`createdAt`);
