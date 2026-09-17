ALTER TABLE `screenshot_assets`
  ADD COLUMN `thumbnail_storage_key` VARCHAR(500) NULL,
  ADD COLUMN `thumbnail_mime_type` VARCHAR(80) NULL,
  ADD COLUMN `thumbnail_byte_size` INTEGER NULL;

ALTER TABLE `daily_productivity`
  ADD COLUMN `productive_seconds` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `unproductive_seconds` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `undefined_seconds` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `activity_sessions` (
  `id` CHAR(36) NOT NULL,
  `organization_id` CHAR(36) NOT NULL,
  `employee_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `resource_type` ENUM('APPLICATION', 'WEBSITE', 'FILE', 'FOLDER', 'WORKSPACE', 'OTHER') NOT NULL,
  `application_name` VARCHAR(160) NOT NULL,
  `process_name` VARCHAR(160) NOT NULL,
  `window_title` VARCHAR(1000) NULL,
  `resource_name` VARCHAR(500) NULL,
  `context_name` VARCHAR(500) NULL,
  `url` VARCHAR(2048) NULL,
  `domain` VARCHAR(253) NULL,
  `started_at` DATETIME(3) NOT NULL,
  `ended_at` DATETIME(3) NOT NULL,
  `duration_seconds` INTEGER NOT NULL,
  `idle_seconds` INTEGER NOT NULL DEFAULT 0,
  `keyboard_activity` INTEGER NOT NULL DEFAULT 0,
  `mouse_activity` INTEGER NOT NULL DEFAULT 0,
  `window_switches` INTEGER NOT NULL DEFAULT 0,
  `classification` ENUM('PRODUCTIVE', 'UNPRODUCTIVE', 'UNDEFINED') NOT NULL DEFAULT 'UNDEFINED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `activity_sessions_organization_id_employee_id_started_at_idx` (`organization_id`, `employee_id`, `started_at`),
  INDEX `activity_sessions_organization_id_resource_type_started_at_idx` (`organization_id`, `resource_type`, `started_at`),
  INDEX `activity_sessions_employee_id_classification_started_at_idx` (`employee_id`, `classification`, `started_at`),
  INDEX `activity_sessions_session_id_started_at_idx` (`session_id`, `started_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `activity_sessions`
  ADD CONSTRAINT `activity_sessions_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `activity_sessions_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `activity_sessions_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `work_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
