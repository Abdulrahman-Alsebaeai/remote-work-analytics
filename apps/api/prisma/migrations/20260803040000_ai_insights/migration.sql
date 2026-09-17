CREATE TABLE `activity_classifications` (
  `id` CHAR(36) NOT NULL, `organization_id` CHAR(36) NOT NULL, `employee_id` CHAR(36) NOT NULL, `event_id` CHAR(36) NOT NULL,
  `category` ENUM('WORK','COMMUNICATION','BROWSING','ENTERTAINMENT','IDLE','OTHER') NOT NULL, `confidence` DOUBLE NOT NULL, `productive` BOOLEAN NOT NULL,
  `explanation` JSON NOT NULL, `model_key` VARCHAR(80) NOT NULL, `model_version` VARCHAR(40) NOT NULL, `classified_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `activity_classifications_event_id_key`(`event_id`), INDEX `activity_classifications_organization_id_classified_at_idx`(`organization_id`,`classified_at`), INDEX `activity_classifications_employee_id_category_classified_at_idx`(`employee_id`,`category`,`classified_at`),
  CONSTRAINT `activity_classifications_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `activity_classifications_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `activity_classifications_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `agent_events`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ai_analysis_jobs` (
  `id` CHAR(36) NOT NULL, `organization_id` CHAR(36) NOT NULL, `requested_by_id` CHAR(36) NOT NULL, `from_date` DATE NOT NULL, `to_date` DATE NOT NULL,
  `status` ENUM('PENDING','RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING', `model_key` VARCHAR(80) NOT NULL, `model_version` VARCHAR(40) NOT NULL,
  `summary` JSON NULL, `insights` JSON NULL, `recommendations` JSON NULL, `error_message` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `started_at` DATETIME(3) NULL, `completed_at` DATETIME(3) NULL,
  INDEX `ai_analysis_jobs_organization_id_created_at_idx`(`organization_id`,`created_at`), INDEX `ai_analysis_jobs_status_created_at_idx`(`status`,`created_at`),
  CONSTRAINT `ai_analysis_jobs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `ai_analysis_jobs_requested_by_id_fkey` FOREIGN KEY (`requested_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
